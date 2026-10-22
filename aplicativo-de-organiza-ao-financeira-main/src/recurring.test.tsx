import {test} from 'node:test'
import assert from 'node:assert/strict'
import {recurringDueDate} from './recurring'
test('vencimentos mensais mantêm o dia original e respeitam calendário',()=>{
 assert.equal(recurringDueDate('2024-02',31),'2024-02-29')
 assert.equal(recurringDueDate('2025-02',31),'2025-02-28')
 assert.equal(recurringDueDate('2025-03',31),'2025-03-31')
 assert.equal(recurringDueDate('2025-04',31),'2025-04-30')
 assert.equal(recurringDueDate('2025-12',1),'2025-12-01')
 for(const [month,day] of [['2025-13',10],['2025-01',0],['2025-01',32],['2025-01',1.2],['abc',10]] as [string,number][])assert.equal(recurringDueDate(month,day),'')
})
