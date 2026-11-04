import { Award, CheckCircle2, Coins, Flame, Gem, LockKeyhole, Medal, ShieldCheck, Sparkles, Target, Zap } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, ProgressRing } from '../ui'
import type { PageProps } from './shared'
import { levelProgress, RewardHistory } from '../gamification'
import { FinancialRoutines } from '../FinancialRoutines'
import { MissionsSection } from '../Missions'

/* ==========================================================================
   Jornada — camada de jogo. Só exibe o que o servidor realmente registra:
   XP, nível, Graninha, sequência e marcos de objetivos.
   ========================================================================== */

export function JourneyPage({ state, go, onUpdated }: PageProps & { onUpdated?:()=>Promise<void> }) {
  const milestones = state.gamification?.milestones.map(m=>({goal:{id:m.goal_id,title:m.title},milestone:m.milestone})) ?? state.goals.flatMap(goal => goal.milestones.map(milestone => ({ goal, milestone })))
  const xpBar = levelProgress(state.progress), xpProgress = xpBar.percent

  return (
    <>
      <div className="journey-hero">
        <div>
          <span className="hero-kicker"><Sparkles size={15} /> SEU PROGRESSO</span>
          <h2>Nível {state.progress.level}</h2>
          <p>Cada cuidado conta.</p>
        </div>
        <span className="journey-hero-orb"><Gem size={34} /></span>
      </div>

      <div className="journey-grid">
        <div className="journey-stat journey-stat-xp">
          <div className="journey-xp-overview">
            <div className="journey-xp-value">
              <span className="stat-icon"><Zap size={20} /></span>
              <strong>{state.progress.xp_total} <span>XP</span></strong>
            </div>
            {state.progress.nextLevelXp && (
              <ProgressRing value={xpProgress} label={`Progresso de XP para o nível ${state.progress.level + 1}`} size={64} strokeWidth={6}>
                <span aria-hidden="true">{Math.round(xpProgress)}%</span>
              </ProgressRing>
            )}
          </div>
          <small>Experiência acumulada</small>
          <small>{xpBar.label}</small>
        </div>
        <div className="journey-stat">
          <span className="stat-icon info"><Coins size={20} /></span>
          <strong>{state.progress.graninha_balance} <span>Graninha</span></strong>
          <small>Moeda virtual, sem valor em reais</small>
        </div>
        <div className="journey-stat">
          <span className="stat-icon warning"><Flame size={20} /></span>
          <strong>{state.stats.streak} <span>{state.stats.streak === 1 ? 'dia' : 'dias'}</span></strong>
          <small>Sequência de dias com ações financeiras</small>
        </div>
      </div>

      <MissionsSection missions={state.missions} onRegister={()=>go('entries')}/>
      <div className="journey-details">
        {onUpdated && <section id="financial-routines" tabIndex={-1}><FinancialRoutines state={state} onUpdated={onUpdated}/></section>}
        <RewardHistory game={state.gamification} limit={50}/>
        <Card>
          <CardHeader title="Conquistas reais" description="Marcos de progresso dos seus objetivos" icon={Medal} />
          {milestones.length ? (
            <div className="badge-grid">
              {milestones.map(item => (
                <div className="badge-item" key={`${item.goal.id}-${item.milestone}`}>
                  <span className="badge-item-icon"><Medal size={19} /></span>
                  <div className="badge-item-body">
                    <strong>{item.milestone}% de {item.goal.title}</strong>
                    <small>Marco registrado uma única vez</small>
                  </div>
                  <Badge tone="success" icon={CheckCircle2}>Alcançado</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Award size={27} />} title="O melhor ainda está por vir" text="Quando seus objetivos avançarem, suas conquistas aparecem aqui." action={<button type="button" className="text-action" onClick={() => go('goals')}>Ver metas & sonhos</button>} />
          )}
        </Card>

        <Card>
          <CardHeader title="Uma evolução de verdade." description="Seus hábitos se transformam em experiência e conquistas." icon={Gem} />
          <p className="card-description">
            {state.gamification?.configVersion ? 'Suas recompensas seguem as regras ativas. Cada conquista fica registrada no seu histórico.' : 'As regras de recompensas estão em preparação. Você já pode organizar suas finanças e acompanhar seus objetivos.'}
          </p>
          <div className="economy-list">
            <div><LockKeyhole size={16} />Sem comprar XP ou Graninha</div>
            <div><ShieldCheck size={16} />Sem recompensar gastos artificiais</div>
            <div><CheckCircle2 size={16} />Marcos históricos preservados</div>
            <div><Target size={16} />Dificuldade dos Sonhos calculada no servidor</div>
          </div>
        </Card>
        {!!state.gamification?.behaviors.length && <Card><CardHeader title="Hábitos e missões concluídos" icon={CheckCircle2}/><ul className="reward-history">{state.gamification.behaviors.map(item=><li key={`${item.code}:${item.period_start}`}><CheckCircle2 size={18}/><div><strong>{item.kind==='habit'?'Hábito':'Missão'} concluído</strong><small>{item.period_start} · {item.code}</small></div></li>)}</ul></Card>}
        {!!state.gamification?.streakMilestones.length && <Card><CardHeader title="Marcos da sua sequência" icon={Flame}/><ul className="reward-history">{state.gamification.streakMilestones.map(item=><li key={`${item.cycle_start}:${item.milestone}`}><Flame size={18}/><div><strong>{item.milestone} dias de constância</strong><small>Ciclo iniciado em {item.cycle_start}</small></div></li>)}</ul></Card>}
        {!!state.financialClass?.history.length && <Card><CardHeader title="Sua trajetória financeira" description="As classes acompanham a reserva de cada momento" icon={Gem}/><ul className="reward-history">{state.financialClass.history.map(item=><li key={item.id}><Gem size={18}/><div><strong>{item.class_code}</strong><small>{new Date(item.created_at).toLocaleDateString('pt-BR')}</small></div></li>)}</ul></Card>}
      </div>
    </>
  )
}
