import { CheckCircle2, Flag, Coins, Zap, CalendarDays } from 'lucide-react'
import type { Mission, Missions } from './data'
import { displayDate } from './data'
import { Badge, Card, CardHeader, ProgressBar } from './ui'

const statusNames={available:'Disponível',in_progress:'Em andamento',completed:'Concluída',expired:'Expirada'}
export function missionRemaining(mission:Mission) {
 return {days:Math.max(0,mission.requiredDays-mission.days),reviews:Math.max(0,mission.requiredReviews-mission.reviews)}
}
export function MissionCard({mission,onRegister}:{mission:Mission;onRegister?:()=>void}) {
 const done=mission.status==='completed', expired=mission.status==='expired', remaining=missionRemaining(mission)
 return <Card className={`quest-panel ${done?'quest-panel-complete':''}`}>
  <div className="quest-heading"><span className="quest-emblem" aria-hidden="true">{done?<CheckCircle2/>:<Flag/>}</span><div><small>{mission.period==='quarter'?'DESAFIO TRIMESTRAL':mission.period==='month'?'DESAFIO MENSAL':'DESAFIO SEMANAL'}</small><h3>{mission.name}</h3></div></div>
  <div className="quest-labels"><Badge tone="primary">{mission.difficulty}</Badge><Badge tone={done?'success':expired?'neutral':'outline'}>{statusNames[mission.status]}</Badge></div>
  <p className="card-description">{mission.description}</p>
  <p className="quest-period"><CalendarDays size={15}/>{displayDate(mission.start)} a {displayDate(mission.end)}</p>
  <div className="quest-objective"><p><span>Dias financeiros</span><strong>{Math.min(mission.days,mission.requiredDays)}/{mission.requiredDays}</strong></p><ProgressBar value={mission.requiredDays>0?mission.days/mission.requiredDays*100:0} label={`Dias financeiros de ${mission.name}`}/></div>
  {mission.requiredReviews>0&&<div className="quest-objective"><p><span>{mission.period==='quarter'?'revisões mensais':'revisões semanais'}</span><strong>{Math.min(mission.reviews,mission.requiredReviews)}/{mission.requiredReviews}</strong></p><ProgressBar value={mission.reviews/mission.requiredReviews*100} label={`Revisões de ${mission.name}`}/></div>}
  <div className="quest-prizes"><span><Zap size={16}/><strong>{mission.xp} XP</strong></span><span><Coins size={16}/><strong>{mission.graninha} Graninhas</strong></span></div>
  <div className="quest-footer"><small>{done?'Recompensa registrada no seu histórico.':expired?'Este período terminou. O próximo é uma nova oportunidade.':remaining.days===0&&remaining.reviews===0?'Requisitos atingidos. A recompensa é automática após a conclusão validada.':`Faltam ${remaining.days} dia(s) financeiro(s)${mission.requiredReviews?` e ${remaining.reviews} revisão(ões)`:''}. A recompensa é automática após a conclusão validada.`}</small>
  {!done&&!expired&&onRegister&&<div className="quest-actions">{remaining.days>0&&<button type="button" className="text-action" onClick={onRegister}>Ver movimentações →</button>}{remaining.reviews>0&&<button type="button" className="text-action" onClick={()=>{const section=document.getElementById('financial-routines');section?.scrollIntoView({behavior:'smooth',block:'start'});section?.focus({preventScroll:true})}}>Revisar meus registros →</button>}</div>}</div>
 </Card>
}
export function MissionsSection({missions,onRegister}:{missions?:Missions;onRegister?:()=>void}) {
 if(!missions)return <Card><CardHeader title="Missões indisponíveis" icon={Flag}/><p>Não foi possível carregar suas missões. Atualize a página para tentar novamente.</p></Card>
 const completed=missions.current.filter(m=>m.status==='completed').length
 return <section className="missions-section" aria-label="Missões financeiras">
  <div className="section-heading"><div><h2>Suas missões</h2><p>Pequenos hábitos, conquistas de verdade.</p></div><Badge tone="primary">{completed}/{missions.current.length} concluídas neste período</Badge></div>
  <div className="quest-guide"><Flag size={23}/><div><strong>Um dia organizado pode avançar várias missões</strong><p>Receitas e despesas registradas contam uma vez por dia. Se não teve gastos, confirme na rotina abaixo. Revise a semana e o mês para cumprir os outros objetivos.</p><small>Compras no cartão não geram o hábito de registro diário. Acompanhe-as nas revisões. Não faça gastos só para ganhar pontos.</small></div></div>
  {missions.current.length?<div className="quest-grid">{missions.current.map(m=><MissionCard key={`${m.code}:${m.start}`} mission={m} onRegister={onRegister}/>)}</div>:<p>Nenhuma missão ativa neste momento.</p>}
  {!!missions.previous.length&&<details className="quest-history"><summary>Períodos anteriores</summary><p>As conquistas concluídas ficam preservadas. Missões expiradas não descontam XP.</p><div className="quest-grid">{missions.previous.map(m=><MissionCard key={`${m.code}:${m.start}`} mission={m}/>)}</div></details>}
 </section>
}
