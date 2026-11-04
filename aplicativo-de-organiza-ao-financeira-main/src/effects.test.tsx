import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { confirmedRewardEffect, enqueueRewardEffect, RewardCelebration } from './ActionEffects'

const before={user:{id:'a'},progress:{xp_total:95,level:1,graninha_balance:20,nextLevelXp:100}}
test('effects require a confirmed gain in the same session; initial load and account switch stay quiet',()=>{
  assert.equal(confirmedRewardEffect(null,before),null)
  assert.equal(confirmedRewardEffect(before,{...before,user:{id:'b'}}),null)
  assert.equal(confirmedRewardEffect(before,before),null)
  assert.equal(confirmedRewardEffect(before,{...before,progress:{...before.progress,xp_total:90,graninha_balance:10}}),null)
})
test('combined rewards show actual deltas and the final level, with no repeat on an identical refresh',()=>{
  const after={...before,progress:{xp_total:150,level:3,graninha_balance:45,nextLevelXp:250}}
  assert.deepEqual(confirmedRewardEffect(before,after),{xp:55,coins:25,level:3})
  assert.equal(confirmedRewardEffect(after,after),null)
  assert.deepEqual(confirmedRewardEffect(before,{...before,progress:{...before.progress,graninha_balance:30}}),{xp:0,coins:10,level:null})
})
test('rapid rewards preserve totals in a bounded queue without replacing the active celebration',()=>{
  const queue=Array.from({length:4},(_,id)=>({id,xp:5,coins:1,level:null}))
  const next=enqueueRewardEffect(queue,{id:5,xp:20,coins:10,level:2})
  assert.equal(next.length,4)
  assert.equal(next[0],queue[0])
  assert.deepEqual(next[3],{id:3,xp:25,coins:11,level:2})
  assert.equal(queue[3].xp,5)
})
test('celebration is dismissible and announces confirmed gains without a modal focus trap',()=>{
  const html=renderToStaticMarkup(<RewardCelebration effect={{id:1,xp:5,coins:10,level:2}} onClose={()=>{}}/>)
  assert.match(html,/Você chegou ao nível 2/)
  assert.match(html,/aria-live="polite"/)
  assert.match(html,/Fechar recompensa/)
  assert.doesNotMatch(html,/aria-modal/)
  const xpOnly=renderToStaticMarkup(<RewardCelebration effect={{id:2,xp:5,coins:0,level:null}} onClose={()=>{}}/>)
  assert.doesNotMatch(xpOnly,/Graninhas/)
})
