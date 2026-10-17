import { monthShift } from './data'
import type { Entry } from './data'

/** Same recognition dates as the financial ledger. Bill payments are not expenses. */
export function monthlyReport(entries: Entry[], endMonth: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const month = monthShift(endMonth, index - count + 1)
    const records = entries.filter(entry => entry.date.slice(0, 7) === month && entry.type !== 'adjustment' && !entry.cardPaymentId)
    const income = records.filter(entry => entry.type === 'income').reduce((total, entry) => total + entry.amountCents, 0)
    const expenses = records.filter(entry => entry.type === 'expense').reduce((total, entry) => total + entry.amountCents, 0)
    return { month, income, expenses, result: income - expenses, records }
  })
}
