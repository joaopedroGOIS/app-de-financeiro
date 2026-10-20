import type { Entry } from './data'

export type CreditCard = { id: string; name: string; lastFour: string; limitCents: number; closingDay: number; dueDay: number; archivedAt: string | null }
export type CardPurchase = { id: string; cardId: string; title: string; category: string; subcategory: string; amountCents: number; interestCents?: number; date: string; installments: number; note: string }
export type CardInstallment = { id: string; purchaseId: string; cardId: string; number: number; amountCents: number; dueDate: string; billMonth: string }
export type CardPayment = { id: string; cardId: string; accountId: string; billMonth: string; amountCents: number; date: string; note: string }
export type CardState = { cards: CreditCard[]; purchases: CardPurchase[]; installments: CardInstallment[]; payments: CardPayment[] }
export const emptyCardState = (): CardState => ({ cards: [], purchases: [], installments: [], payments: [] })
// Percentual total com até duas casas; arredonda uma única vez para centavos.
export function percentageInterestCents(principalCents: number, percentage: string): number | null {
  const normalized = percentage.trim().replace(',', '.')
  if (!Number.isSafeInteger(principalCents) || principalCents <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const [whole, decimal = ''] = normalized.split('.')
  const basisPoints = BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'))
  const cents = (BigInt(principalCents) * basisPoints + 5000n) / 10000n
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null
}
export type CardBill = { cardId: string; month: string; dueDate: string; totalCents: number; paidCents: number; remainingCents: number; installments: CardInstallment[] }

export function cardBills(state: CardState): CardBill[] {
  const bills = new Map<string, CardBill>()
  for (const item of state.installments) {
    const key = `${item.cardId}:${item.billMonth}`
    const bill = bills.get(key) ?? { cardId: item.cardId, month: item.billMonth, dueDate: item.dueDate, totalCents: 0, paidCents: 0, remainingCents: 0, installments: [] }
    bill.totalCents += item.amountCents
    if (item.dueDate < bill.dueDate) bill.dueDate = item.dueDate
    bill.installments.push(item)
    bills.set(key, bill)
  }
  for (const payment of state.payments) {
    const bill = bills.get(`${payment.cardId}:${payment.billMonth}`)
    if (bill) bill.paidCents += payment.amountCents
  }
  return [...bills.values()].map(bill => ({ ...bill, remainingCents: Math.max(0, bill.totalCents - bill.paidCents) })).sort((a, b) => a.month.localeCompare(b.month))
}

export function cardOutstanding(state: CardState, cardId?: string) {
  return cardBills(state).filter(bill => !cardId || bill.cardId === cardId).reduce((sum, bill) => sum + bill.remainingCents, 0)
}

/** Oldest overdue balance first, then the next unpaid bill; paid history stays accessible. */
export function relevantCardBill(bills: CardBill[], today: string): CardBill | undefined {
  const sorted = [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return sorted.find(bill => bill.remainingCents > 0 && bill.dueDate < today)
    ?? sorted.find(bill => bill.remainingCents > 0)
    ?? sorted.find(bill => bill.month === today.slice(0, 7))
    ?? sorted[sorted.length - 1]
}

/** Remaining recorded commitments, including partial payments and empty calendar months. */
export function cardCommitmentForecast(bills: CardBill[], startMonth: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const month = shiftMonth(startMonth, index)
    const matches = bills.filter(bill => bill.month === month)
    return { month, totalCents: matches.reduce((sum, bill) => sum + bill.totalCents, 0),
      remainingCents: matches.reduce((sum, bill) => sum + bill.remainingCents, 0),
      installments: matches.reduce((sum, bill) => sum + bill.installments.length, 0) }
  })
}

const purchaseSearchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
export function filterCardPurchases(purchases: CardPurchase[], cardId: string, query: string, category: string, kind: 'all' | 'single' | 'installments') {
  const needle = purchaseSearchText(query.trim())
  return purchases.filter(purchase => purchase.cardId === cardId
    && (!category || purchase.category === category)
    && (kind === 'all' || (kind === 'single' ? purchase.installments === 1 : purchase.installments > 1))
    && purchaseSearchText(`${purchase.title} ${purchase.category} ${purchase.subcategory} ${purchase.note}`).includes(needle))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export function cardExpenseEntries(state: CardState): Entry[] {
  const purchases = new Map(state.purchases.map(purchase => [purchase.id, purchase]))
  const bills = new Map(cardBills(state).map(bill => [`${bill.cardId}:${bill.month}`, bill]))
  return state.installments.flatMap(item => {
    const purchase = purchases.get(item.purchaseId)
    if (!purchase) return []
    return [{ id: `card:${item.id}`, accountId: item.cardId, cardId: item.cardId, settled: bills.get(`${item.cardId}:${item.billMonth}`)?.remainingCents === 0,
      title: `${purchase.title}${purchase.installments > 1 ? ` (${item.number}/${purchase.installments})` : ''}`,
      category: purchase.category, subcategory: purchase.subcategory, type: 'expense' as const,
      amountCents: item.amountCents, date: item.dueDate, note: purchase.note }]
  })
}

export function cardCashPayments(state: CardState, accountId: string) {
  return state.payments.filter(payment => payment.accountId === accountId).reduce((sum, payment) => sum + payment.amountCents, 0)
}

function calendarDay(month: string, day: number) {
  const [year, m] = month.split('-').map(Number)
  return `${month}-${String(Math.min(day, new Date(Date.UTC(year, m, 0)).getUTCDate())).padStart(2, '0')}`
}
function shiftMonth(month: string, offset: number) {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m - 1 + offset, 1)).toISOString().slice(0, 7)
}
export function firstCardBill(date: string, closingDay: number, dueDay: number) {
  if (!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date) || !Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return ''
  let closingMonth = date.slice(0, 7)
  // Compras no dia do fechamento entram na próxima fatura.
  if (date >= calendarDay(closingMonth, closingDay)) closingMonth = shiftMonth(closingMonth, 1)
  const dueMonth = dueDay <= closingDay ? shiftMonth(closingMonth, 1) : closingMonth
  return dueMonth
}
export function installmentPreview(totalCents: number, count: number, firstMonth: string, dueDay: number) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(firstMonth) || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return []
  if (!Number.isSafeInteger(totalCents) || !Number.isInteger(count) || count < 1 || count > 60 || totalCents < count) return []
  const base = Math.floor(totalCents / count), remainder = totalCents % count
  return Array.from({ length: count }, (_, index) => ({ number: index + 1, amountCents: base + (index < remainder ? 1 : 0), dueDate: calendarDay(shiftMonth(firstMonth, index), dueDay) }))
}
