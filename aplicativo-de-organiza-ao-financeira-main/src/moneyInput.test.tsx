import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeMoneyInput, displayMoneyInput } from './moneyInput'
import { toCents } from './data'

test('monetary input keeps Brazilian thousands and cents without changing stored amounts', () => {
  for (const [input, canonical, cents] of [
    ['1.250,50', '1250.50', 125050],
    ['R$ 12.345.678,90', '12345678.90', 1234567890],
    ['0,01', '0.01', 1],
    ['-1.250,50', '-1250.50', -125050],
    ['12.50', '12.50', 1250],
    ['1.250', '1250', 125000],
    ['0,00', '0.00', 0],
  ] as const) {
    assert.equal(normalizeMoneyInput(input), canonical)
    assert.equal(toCents(normalizeMoneyInput(input)!), cents)
    assert.equal(normalizeMoneyInput(displayMoneyInput(canonical, true)), canonical.includes('.') ? canonical : canonical + '.00')
  }
})
test('editing preserves a trailing decimal separator and rejects excessive precision or invalid values', () => {
  assert.equal(displayMoneyInput('1234.'), '1.234,')
  assert.equal(displayMoneyInput('1234.5'), '1.234,5')
  assert.equal(displayMoneyInput('1234.5', true), '1.234,50')
  assert.equal(normalizeMoneyInput(''), '')
  for (const value of ['1,234', '1e6', '12,50,20', 'abc', 'Infinity']) assert.equal(normalizeMoneyInput(value), null)
})