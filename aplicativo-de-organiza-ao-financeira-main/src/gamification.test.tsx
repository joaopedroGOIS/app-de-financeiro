import {test} from 'node:test'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {levelProgress,rewardFeedback,PlayerSummary,RewardHistory} from './gamification'
import type {Gamification,State} from './data'
import {DashboardPage} from './pages/Dashboard'
import {JourneyPage} from './pages/Journey'

const progress={xp_total:110,level:2,graninha_balance:25,currentLevelXp:100,nextLevelXp:250,curveVersion:'test-only'}
const game:Gamification={progress,streak:3,configVersion:'test-only',pending:0,awaitingConfig:0,milestones:[],behaviors:[],streakMilestones:[],rewards:[{id:'r',event_id:'e',reward_type:'xp',amount:5,reason_code:'daily_record',config_version:'test-only',created_at:'2026-10-15T12:00:00Z',metadata:{kind:'habit'}}]}
test('barra usa o intervalo do nível, e nível 100 não mostra 101',()=>{
 assert.deepEqual(levelProgress(progress),{percent:10/150*100,earned:10,required:150,remaining:140,label:'10/150 XP neste nível'})
 assert.equal(levelProgress({...progress,level:100,nextLevelXp:null}).label,'Nível máximo alcançado')
 assert.equal(levelProgress({...progress,currentLevelXp:null,nextLevelXp:null}).percent,0)
})
test('feedback só anuncia aumentos confirmados e identifica passagem por vários níveis',()=>{
 assert.equal(rewardFeedback(progress,progress),'')
 assert.equal(rewardFeedback(progress,{...progress,xp_total:105}),'')
 assert.equal(rewardFeedback(progress,{...progress,xp_total:125,graninha_balance:35,level:4}),'+15 XP · +10 Graninhas · Você chegou ao nível 4!')
})
test('dashboard, perfil e evolução apresentam a mesma projeção e histórico do servidor',()=>{
 const state:State={user:{id:'u',name:'Ana',email:''},accounts:[],entries:[],archivedEntries:[],assets:[],goals:[],progress,gamification:game,preferences:{theme:'dark'},stats:{reserveCents:200000,netWorthCents:200000,streak:3,financialClass:'Poupador'}}
 const noop=()=>{};const props={state,go:noop,open:noop,editEntry:noop,editAccount:noop,editAsset:noop,editGoal:noop,contributeTo:noop,requestRemove:noop,toast:noop}
 const profile=renderToStaticMarkup(<><PlayerSummary progress={progress} streak={3}/><RewardHistory game={game}/></>)
 const dashboard=renderToStaticMarkup(<DashboardPage {...props} month="2026-10"/> )
 const journey=renderToStaticMarkup(<JourneyPage {...props}/> )
 for(const html of [profile,dashboard,journey]){assert.match(html,/110/);assert.match(html,/25/);assert.match(html,/Registro financeiro diário/);assert.match(html,/test-only/)}
 assert.match(dashboard,/Poupador/)
})
test('histórico distingue pendências de recompensas confirmadas e preserva ajustes',()=>{
 const html=renderToStaticMarkup(<RewardHistory game={{...game,pending:1,rewards:[{...game.rewards[0],amount:-2,adjustment_of:'old'}]}}/> )
 assert.match(html,/aguardando processamento/);assert.match(html,/Ajuste auditado/);assert.match(html,/-2/)
})
