import {test} from 'node:test'
import assert from 'node:assert/strict'
import {budgetRows,unbudgetedSpending} from './budgets'

test('limites distinguem saldo restante, proximidade e excesso sem omitir gastos não planejados',()=>{
 const state={budgets:[{id:'a',category:'Mercado',limitCents:10000},{id:'b',category:'Casa',limitCents:10000},{id:'c',category:'Saúde',limitCents:10000}],spending:[{category:'Mercado',spentCents:8000},{category:'Casa',spentCents:12500},{category:'Saúde',spentCents:10000},{category:'Lazer',spentCents:2500}]}
 const rows=budgetRows(state)
 assert.deepEqual(rows.map(r=>r.status),['near','exceeded','reached'])
 assert.deepEqual(rows.map(r=>r.remainingCents),[2000,-2500,0])
 assert.equal(rows[1].percent,125)
 assert.equal(unbudgetedSpending(state),2500)
 assert.equal(budgetRows({budgets:[{id:'x',category:'Nova',limitCents:1}],spending:[]})[0].status,'within')
 assert.equal(unbudgetedSpending({budgets:[],spending:state.spending}),33000)
})
