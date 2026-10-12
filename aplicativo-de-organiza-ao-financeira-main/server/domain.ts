/** All monetary values handled by the domain are integer centavos. */
export type Entry = { id: string; accountId: string; type: 'income' | 'expense' | 'adjustment'; amountCents: number; date: string }
export type Account = { id: string; openingCents: number; isReserve: boolean }

export function balanceOf(account: Account, entries: Entry[]) {
  return account.openingCents + entries.filter(e => e.accountId === account.id).reduce((sum, e) => sum + (e.type === 'expense' ? -e.amountCents : e.amountCents), 0)
}
export function reserveAndNetWorth(accounts: Account[], entries: Entry[], assets: { kind: 'asset' | 'liability'; amountCents: number }[]) {
  const balances = accounts.map(a => ({ ...a, balanceCents: balanceOf(a, entries) }))
  const reserveCents = balances.filter(a => a.isReserve).reduce((sum, a) => sum + Math.max(0, a.balanceCents), 0)
  const netWorthCents = balances.reduce((sum, a) => sum + a.balanceCents, 0) + assets.reduce((sum, a) => sum + (a.kind === 'asset' ? a.amountCents : -a.amountCents), 0)
  return { balances, reserveCents, netWorthCents }
}
export function streakFromDates(dates: string[], today: string) {
  const valid = new Set(dates)
  const cursor = new Date(`${today}T12:00:00Z`)
  const toDate = (d: Date) => d.toISOString().slice(0, 10)
  if (!valid.has(toDate(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1)
  let count = 0
  while (valid.has(toDate(cursor))) { count++; cursor.setUTCDate(cursor.getUTCDate() - 1) }
  return count
}
export const MILESTONES = [10, 25, 50, 75, 100] as const
export function crossedMilestones(before: number, after: number, target: number) {
  return MILESTONES.filter(p => before * 100 < target * p && after * 100 >= target * p)
}
export type Difficulty = 'Fácil' | 'Moderada' | 'Difícil' | 'Muito difícil' | 'Lendária'
export function difficultyByEffort(index: number): Difficulty {
  if (index <= .5) return 'Fácil'
  if (index <= .75) return 'Moderada'
  if (index <= 1) return 'Difícil'
  if (index <= 1.5) return 'Muito difícil'
  return 'Lendária'
}
export function difficultyByMonths(months: number): Difficulty {
  if (months <= 6) return 'Fácil'
  if (months <= 12) return 'Moderada'
  if (months <= 24) return 'Difícil'
  if (months < 48) return 'Muito difícil'
  return 'Lendária'
}
export function analyzeDream(input: { remainingCents: number; deadline?: string | null; entries: Pick<Entry, 'type' | 'amountCents' | 'date'>[]; today: string }) {
  const month = input.today.slice(0, 7)
  // Conservative data sufficiency policy: six completed months with recorded income/expenses.
  const [year, m] = month.split('-').map(Number)
  const keys = Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(year, m - 2 - i, 1)); return d.toISOString().slice(0, 7) })
  const monthly = keys.map(key => {
    const records = input.entries.filter(e => e.date.slice(0, 7) === key && e.type !== 'adjustment')
    return { month: key, count: records.length, balanceCents: records.reduce((sum, e) => sum + (e.type === 'income' ? e.amountCents : -e.amountCents), 0) }
  })
  const positive = monthly.filter(m => m.balanceCents > 0).map(m => m.balanceCents)
  if (monthly.some(m => !m.count) || !positive.length) return { status: 'insufficient' as const, confidence: 'baixa' as const, monthsRecorded: monthly.filter(m => m.count).length }
  const ordered = [...positive].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  const twiceMedian = ordered.length % 2 ? ordered[middle] * 2 : ordered[middle - 1] + ordered[middle]
  // Exact integer arithmetic: capacity = median * 7/10, including half-cent medians.
  const capacityCents = Number(BigInt(twiceMedian) * 7n / 20n)
  if (capacityCents <= 0) return { status: 'insufficient' as const, confidence: 'baixa' as const, monthsRecorded: 6 }
  const remainingCents = Math.max(0, input.remainingCents)
  if (remainingCents === 0) return { status: 'ready' as const, difficulty: 'Fácil' as Difficulty, confidence: 'alta' as const, capacityCents, remainingCents, estimatedMonths: 0, monthsRecorded: 6 }
  if (input.deadline) {
    const [dy, dm, dd] = input.deadline.split('-').map(Number)
    const [ty, tm, td] = input.today.split('-').map(Number)
    const monthsLeft = Math.max(0, (dy - ty) * 12 + dm - tm + (dd > td ? 1 : 0))
    if (!monthsLeft) return { status: 'expired' as const, confidence: 'alta' as const, capacityCents, remainingCents, monthsRecorded: 6 }
    const needMonthlyCents = Number((BigInt(remainingCents) + BigInt(monthsLeft) - 1n) / BigInt(monthsLeft))
    const effortIndex = needMonthlyCents / capacityCents
    return { status: 'ready' as const, difficulty: difficultyByEffort(effortIndex), confidence: 'alta' as const, capacityCents, remainingCents, monthsLeft, needMonthlyCents, effortIndex, monthsRecorded: 6 }
  }
  const estimatedMonths = remainingCents / capacityCents
  return { status: 'ready' as const, difficulty: difficultyByMonths(estimatedMonths), confidence: 'alta' as const, capacityCents, remainingCents, estimatedMonths, monthsRecorded: 6 }
}
