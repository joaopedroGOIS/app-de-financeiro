/** Monthly planning only: schedules never create expenses or debit an account. */
export function debtInstallments(totalCents: number, count: number, firstDueDate: string) {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || totalCents > 100000000000 || !Number.isInteger(count) || count < 1 || count > 360 || totalCents < count) return []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) return []
  const [year, month, day] = firstDueDate.split('-').map(Number)
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || year + Math.floor((month - 1 + count - 1) / 12) > 9999) return []
  const base = Math.floor(totalCents / count), remainder = totalCents % count
  return Array.from({ length: count }, (_, index) => {
    const dueMonth = new Date(Date.UTC(year, month - 1 + index, 1))
    const dueDay = Math.min(day, new Date(Date.UTC(dueMonth.getUTCFullYear(), dueMonth.getUTCMonth() + 1, 0)).getUTCDate())
    return { number: index + 1, amountCents: base + (index < remainder ? 1 : 0), dueDate: `${dueMonth.toISOString().slice(0, 7)}-${String(dueDay).padStart(2, '0')}` }
  })
}
