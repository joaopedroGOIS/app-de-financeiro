import type { Gamification, Progress, Reward } from './data'
import { Card, CardHeader, ProgressBar } from './ui'
import { Award, Coins, Sparkles } from 'lucide-react'

export function levelProgress(progress: Progress) {
  if (progress.level===100 && progress.curveVersion) return { percent:100,earned:0,required:0,remaining:0,label:'Nível máximo alcançado' }
  const start=progress.currentLevelXp, end=progress.nextLevelXp
  if (start==null || end==null || end<=start) return {percent:0,earned:0,required:0,remaining:0,label:'Progressão aguardando configuração'}
  const earned=Math.max(0,progress.xp_total-start), required=end-start
  return {percent:Math.min(100,earned/required*100),earned,required,remaining:Math.max(0,end-progress.xp_total),label:`${earned}/${required} XP neste nível`}
}
export function rewardReason(reward: Reward) {
  if (reward.adjustment_of) return 'Ajuste auditado de recompensa'
  const habit=({daily_record:'Registro financeiro diário',no_expense_day:'Dia sem gastos',weekly_review:'Fechamento semanal',monthly_review:'Revisão mensal'} as Record<string,string>)[reward.reason_code]
  if(habit) return habit
  if(reward.reason_code==='daily_saving') return 'Economia diária confirmada'
  const mission=({mission_first_step:'Primeiro Passo',mission_organized_week:'Semana Organizada',mission_true_control:'Controle de Verdade',mission_control_master:'Mestre do Controle'} as Record<string,string>)[reward.reason_code]
  if(mission) return `Missão: ${mission}`
  switch(reward.metadata?.kind) {
    case 'habit': return 'Hábito concluído'
    case 'mission': return 'Missão concluída'
    case 'streak': return `Sequência de ${reward.metadata.milestone} dias`
    case 'goal': return `Marco de ${reward.metadata.milestone}% do objetivo`
    default: return 'Registro financeiro concluído'
  }
}
export function rewardFeedback(before: Progress, after: Progress) {
  const xp=after.xp_total-before.xp_total, coins=after.graninha_balance-before.graninha_balance
  const parts=[xp>0?`+${xp} XP`:'',coins>0?`+${coins} Graninhas`:''].filter(Boolean)
  if(after.level>before.level) parts.push(`Você chegou ao nível ${after.level}!`)
  return parts.join(' · ')
}
export function RewardHistory({ game, limit=10 }: { game?: Gamification; limit?:number }) {
  return <Card>
    <CardHeader title="Últimas recompensas" description="Seu histórico de evolução" icon={Award}/>
    {!game ? <p className="card-description">Não foi possível consultar a evolução agora. Seus registros financeiros continuam disponíveis.</p>
      : <>
        {!game.configVersion && <p className="card-description">As regras de recompensas estão em preparação. Seu histórico financeiro está preservado.</p>}
        {game.pending>0 && <p className="info-note" role="status">Há ações aguardando processamento. As recompensas aparecerão após a confirmação.</p>}
        {!!game.awaitingDifficulty && <p className="card-description">Há marcos de Sonhos aguardando histórico suficiente para calcular a dificuldade. Eles ficam registrados para processamento posterior.</p>}
        {game.rewards.length ? <ul className="reward-history">{game.rewards.slice(0,limit).map(reward=><li key={reward.id}>
          <span className="reward-history-icon">{reward.reward_type==='xp'?<Sparkles size={18}/>:<Coins size={18}/>}</span>
          <div><strong>{rewardReason(reward)}</strong><small>{new Date(reward.created_at).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})} · {reward.config_version}</small></div>
          <strong>{reward.amount>0?'+':''}{reward.amount} {reward.reward_type==='xp'?'XP':'Graninha'}</strong>
        </li>)}</ul>:<p className="card-description">Você ainda não tem recompensas registradas.</p>}
      </>}
  </Card>
}
export function PlayerSummary({ progress, streak }: {progress:Progress;streak:number}) {
  const bar=levelProgress(progress)
  return <section className="profile-progress" aria-label="Seu progresso">
    <h3>Nível {progress.level}</h3><p>{progress.xp_total} XP · {progress.graninha_balance} Graninha · {streak} dias de sequência</p>
    <ProgressBar value={bar.percent} label="Progresso de XP para o próximo nível"/>
    <small>{bar.label}{bar.remaining>0?` · faltam ${bar.remaining} XP`:''}</small>
  </section>
}
