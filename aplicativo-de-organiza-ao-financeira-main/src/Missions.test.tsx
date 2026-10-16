import {test} from 'node:test'
import assert from 'node:assert/strict'
import {renderToStaticMarkup} from 'react-dom/server'
import {MissionsSection,MissionCard} from './Missions'
import {ContributionForm} from './forms'
import type {Mission} from './data'

const mission:Mission={code:'mission_organized_week',name:'Semana Organizada',difficulty:'Média',description:'Acompanhe 5 dias e revise sua semana.',days:4,reviews:0,requiredDays:5,requiredReviews:1,start:'2026-10-12',end:'2026-10-18',xp:25,graninha:25,period:'week',status:'in_progress',configVersion:'test-only'}
test('missão mostra dias, revisões, período e recompensas sem botão de resgate',()=>{
 const html=renderToStaticMarkup(<MissionCard mission={mission}/>)
 for(const text of ['Semana Organizada','Em andamento','4/5','0/1','25','Graninhas','revisões semanais','recompensa é automática'])assert(html.includes(text),text)
 assert.doesNotMatch(html,/Resgatar|<button/)
 assert.match(html,/Dias financeiros de Semana Organizada/)
})
test('seção distingue disponível, concluída e expirada com períodos separados',()=>{
 const html=renderToStaticMarkup(<MissionsSection missions={{timezone:'America/Sao_Paulo',current:[{...mission,status:'available'},{...mission,code:'other',name:'Outra missão',status:'completed'}],previous:[{...mission,status:'expired',start:'2026-10-05',end:'2026-10-11'}]}}/>)
 for(const text of ['Disponível','Concluída','Expirada','Períodos anteriores','Recompensa registrada'])assert(html.includes(text),text)
})
test('formulário exige confirmação explícita de economia real e explica independência das contas',()=>{
 const html=renderToStaticMarkup(<ContributionForm goal={{id:'g',title:'Meta',kind:'meta',targetCents:200000,savedCents:0,icon:'🎯',deadline:null,milestones:[]}} error="" onSubmit={async()=>true}/>)
 assert.match(html,/type="checkbox" required=""/)
 assert.match(html,/não foi contabilizado em outro objetivo/)
 assert.match(html,/5 XP uma vez por dia/)
 assert.match(html,/não movimenta contas/)
})
