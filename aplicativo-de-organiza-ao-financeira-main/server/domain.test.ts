import { test } from 'node:test'
import assert from 'node:assert/strict'
import { balanceOf, reserveAndNetWorth, streakFromDates, crossedMilestones, difficultyByEffort, difficultyByMonths, analyzeDream } from './domain'

test('saldos, reserva e patrimônio usam centavos inteiros e permanecem separados', () => {
  const accounts = [{ id: 'a', openingCents: 10000, isReserve: false }, { id: 'b', openingCents: 30000, isReserve: true }]
  const entries = [{ id: 'i', accountId: 'a', type: 'income' as const, amountCents: 12345, date: '2026-10-08' }, { id: 'e', accountId: 'a', type: 'expense' as const, amountCents: 500, date: '2026-10-08' }]
  assert.equal(balanceOf(accounts[0], entries), 21845)
  const result = reserveAndNetWorth(accounts, entries, [{ kind: 'asset', amountCents: 90000 }, { kind: 'liability', amountCents: 15000 }])
  assert.equal(result.reserveCents, 30000)
  assert.equal(result.netWorthCents, 126845)
})
test('streak conta dias distintos e pode começar ontem', () => {
  assert.equal(streakFromDates(['2026-10-05', '2026-10-07', '2026-10-07', '2026-10-08'], '2026-10-08'), 2)
  assert.equal(streakFromDates(['2026-10-06', '2026-10-07'], '2026-10-08'), 2)
  assert.equal(streakFromDates(['2026-10-05'], '2026-10-08'), 0)
})
test('um aporte pode cruzar vários marcos oficiais uma única vez', () => {
  assert.deepEqual(crossedMilestones(0, 8000, 10000), [10, 25, 50, 75])
  assert.deepEqual(crossedMilestones(8000, 10000, 10000), [100])
  assert.deepEqual(crossedMilestones(10000, 10000, 10000), [])
})
test('limiares oficiais do esforço com prazo', () => {
  const cases: [number, string][] = [[.5, 'Fácil'], [.51, 'Moderada'], [.75, 'Moderada'], [.76, 'Difícil'], [1, 'Difícil'], [1.01, 'Muito difícil'], [1.5, 'Muito difícil'], [1.51, 'Lendária']]
  for (const [index, expected] of cases) assert.equal(difficultyByEffort(index), expected)
})
test('limiares sem prazo, inclusive o caso explícito de 48 meses do documento', () => {
  const cases: [number, string][] = [[6, 'Fácil'], [6.1, 'Moderada'], [12, 'Moderada'], [12.1, 'Difícil'], [24, 'Difícil'], [24.1, 'Muito difícil'], [47.9, 'Muito difícil'], [48, 'Muito difícil'], [49, 'Lendária']]
  for (const [months, expected] of cases) assert.equal(difficultyByMonths(months), expected)
})
test('sem seis meses completos, analisador não inventa capacidade', () => {
  assert.deepEqual(analyzeDream({ remainingCents: 100000, entries: [], today: '2026-10-08' }), { status: 'insufficient', confidence: 'baixa', monthsRecorded: 0 })
})
test('mediana dos saldos mensais positivos, sem usar patrimônio, reserva ou salário bruto', () => {
  const entries = [1, 2, 3, 4, 5, 6].map(month => ({ type: 'income' as const, amountCents: month * 10000, date: `2026-${String(month).padStart(2, '0')}-10` }))
  entries.push({ type: 'income', amountCents: 20000, date: '2026-09-10' })
  entries.push({ type: 'income', amountCents: 20000, date: '2026-08-10' })
  entries.push({ type: 'income', amountCents: 20000, date: '2026-07-10' })
  const result = analyzeDream({ remainingCents: 100000, entries, today: '2026-10-08' })
  assert.equal(result.status, 'ready')
  assert.equal(result.capacityCents, 21000)
})
