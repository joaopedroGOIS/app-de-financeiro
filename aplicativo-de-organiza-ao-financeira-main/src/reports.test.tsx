import { test } from 'node:test'
import assert from 'node:assert/strict'
import { monthlyReport } from './reports'
import type { Entry } from './data'

const entry = (changes: Partial<Entry>): Entry => ({ id: 'e', accountId: 'a', type: 'expense', title: 'Registro', category: 'Personalizada', amountCents: 1000, date: '2026-01-10', note: '', ...changes })

test('relatório atravessa anos e preserva meses vazios e resultados negativos', () => {
  const report = monthlyReport([entry({}), entry({ date: '2025-12-10', type: 'income', amountCents: 2500 })], '2026-02', 3)
  assert.deepEqual(report.map(({ month, income, expenses, result }) => ({ month, income, expenses, result })), [
    { month: '2025-12', income: 2500, expenses: 0, result: 2500 },
    { month: '2026-01', income: 0, expenses: 1000, result: -1000 },
    { month: '2026-02', income: 0, expenses: 0, result: 0 },
  ])
})

test('parcelas são contadas uma vez sem pagamentos de fatura ou ajustes', () => {
  const entries = [entry({ id: 'card', cardId: 'c' }), entry({ id: 'income', type: 'income' }),
    entry({ id: 'payment', type: 'adjustment', cardPaymentId: 'p', amountCents: -1000 }),
    entry({ id: 'adjust', type: 'adjustment', amountCents: 5000 }), entry({ id: 'outside', date: '2026-02-10' })]
  const [report] = monthlyReport(entries, '2026-01', 1)
  assert.equal(report.income, 1000)
  assert.equal(report.expenses, 1000)
  assert.equal(report.result, 0)
  assert.equal(report.records.length, 2, 'resultado zero também deve exibir atividade')
  assert.equal(entries.length, 5, 'não modifica o histórico')
})
