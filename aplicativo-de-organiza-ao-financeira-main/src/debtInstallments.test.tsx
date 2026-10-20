import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { debtInstallments } from './debtInstallments'
import { AssetForm } from './forms'
import { DebtSchedule } from './pages/Wealth'

test('empréstimo de R$ 2.000 em 7 parcelas conserva todos os centavos', () => {
  const plan = debtInstallments(200000, 7, '2026-11-10')
  assert.equal(plan.length, 7)
  assert.deepEqual(plan.map(item => item.amountCents), [28572, 28572, 28572, 28571, 28571, 28571, 28571])
  assert.equal(plan.reduce((sum, item) => sum + item.amountCents, 0), 200000)
  assert.equal(plan[6].dueDate, '2027-05-10')
})
test('parcelas preservam o dia original depois de fevereiro e rejeitam planos inválidos', () => {
  assert.deepEqual(debtInstallments(300, 3, '2028-01-31').map(item => item.dueDate), ['2028-01-31', '2028-02-29', '2028-03-31'])
  for (const [total, count, first] of [[1, 7, '2026-10-10'], [2000, 0, '2026-10-10'], [2000, 361, '2026-10-10'], [2000, 7, '2026-02-30'], [2000, 7, ''], [2000, 7, '9999-12-31']] as const) assert.deepEqual(debtInstallments(total, count, first), [])
})
test('plano salvo reaparece ao editar; dívidas antigas continuam sem parcelamento', () => {
  const asset = { id: 'debt', name: 'Empréstimo', kind: 'liability' as const, amountCents: 200000, note: '', installmentCount: 7, firstDueDate: '2026-11-10' }
  const html = renderToStaticMarkup(<AssetForm initial={asset} error="" onSubmit={async () => true} />)
  assert.match(html, /Número de parcelas/)
  assert.match(html, /value="7"/)
  assert.match(html, /R\$\s285,72/)
  assert.match(renderToStaticMarkup(<DebtSchedule asset={asset}/>), /7 parcelas mensais/)
  assert.equal(renderToStaticMarkup(<DebtSchedule asset={{ ...asset, installmentCount: null, firstDueDate: null }}/>), '')
})
