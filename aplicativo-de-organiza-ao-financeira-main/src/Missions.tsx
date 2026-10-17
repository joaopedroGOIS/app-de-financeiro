import { CheckCircle2, Flag } from 'lucide-react'
import type { Mission, Missions } from './data'
import { displayDate } from './data'
import { Badge, Card, CardHeader, ProgressBar } from './ui'

const statusNames={available:'Disponível',in_progress:'Em andamento',completed:'Concluída',expired:'Expirada'}
export function MissionCard({mission}:{mission:Mission}) {
 const done=mission.status==='completed'
 return <Card className="mission-card">
  <CardHeader title={mission.name} description={mission.description} icon={done?CheckCircle2:Flag}/>
  <div className="mission-labels"><Badge tone="primary">{mission.difficulty}</Badge><Badge tone={done?'success':mission.status==='expired'?'neutral':'outline'}>{statusNames[mission.status]}</Badge></div>
  <p className="card-description">{displayDate(mission.start)} a {displayDate(mission.end)}</p>
  <p><strong>{Math.min(mission.days,mission.requiredDays)}/{mission.requiredDays}</strong> dias financeiros</p>
  <ProgressBar value={mission.days/mission.requiredDays*100} label={`Dias financeiros de ${mission.name}`}/>
  {mission.requiredReviews>0&&<><p><strong>{Math.min(mission.reviews,mission.requiredReviews)}/{mission.requiredReviews}</strong> {mission.period==='quarter'?'revisões mensais':'revisões semanais'}</p><ProgressBar value={mission.reviews/mission.requiredReviews*100} label={`Revisões de ${mission.name}`}/></>}
  <p className="mission-reward"><strong>{mission.xp} XP</strong> · <strong>{mission.graninha} Graninhas</strong></p>
  <small>{done?'Recompensa registrada no seu histórico.':mission.status==='expired'?'Este período terminou. O próximo é uma nova oportunidade.':'A recompensa é automática após a conclusão validada.'}</small>
 </Card>
}
export function MissionsSection({missions}:{missions?:Missions}) {
 if(!missions?.current.length)return null
 return <section className="missions-section" aria-label="Missões financeiras">
  <div className="section-heading"><div><h2>Suas missões</h2><p>Organização e constância, no seu ritmo. Seus dias financeiros também contam para outras missões.</p></div></div>
  <div className="missions-grid">{missions.current.map(m=><MissionCard key={`${m.code}:${m.start}`} mission={m}/>)}</div>
  {!!missions.previous.length&&<details className="mission-history"><summary>Períodos anteriores</summary><div className="missions-grid">{missions.previous.map(m=><MissionCard key={`${m.code}:${m.start}`} mission={m}/>)}</div></details>}
 </section>
}
