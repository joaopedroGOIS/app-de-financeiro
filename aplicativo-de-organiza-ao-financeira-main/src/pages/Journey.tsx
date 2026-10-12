import { Award, CheckCircle2, Coins, Flame, Gem, LockKeyhole, Medal, ShieldCheck, Sparkles, Target, Zap } from 'lucide-react'
import { Badge, Card, CardHeader, EmptyState, ProgressRing } from '../ui'
import type { PageProps } from './shared'

/* ==========================================================================
   Jornada — camada de jogo. Só exibe o que o servidor realmente registra:
   XP, nível, Graninha, sequência e marcos de objetivos.
   ========================================================================== */

export function JourneyPage({ state, go }: PageProps) {
  const milestones = state.goals.flatMap(goal => goal.milestones.map(milestone => ({ goal, milestone })))
  const xpProgress = state.progress.nextLevelXp ? Math.min(100, (state.progress.xp_total / state.progress.nextLevelXp) * 100) : 0

  return (
    <>
      <div className="journey-hero">
        <div>
          <span className="hero-kicker"><Sparkles size={15} /> SEU PROGRESSO</span>
          <h2>Nível {state.progress.level}</h2>
          <p>A evolução nasce de hábitos financeiros saudáveis. Sem atalhos e sem apostar sua grana.</p>
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
          <small>Experiência registrada no servidor</small>
          <small>{state.progress.nextLevelXp ? `Progresso para o nível ${state.progress.level + 1}` : 'Curva oficial de XP ainda não configurada — nada é estimado aqui.'}</small>
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

      <div className="journey-details">
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
          <CardHeader title="Uma evolução de verdade." description="XP, Graninha e recompensas com regras versionadas e processamento no servidor." icon={Gem} />
          <p className="card-description">
            Como os valores oficiais da economia ainda não estão definidos neste repositório, nenhuma ação gera recompensa inventada. Seu progresso mostrado aqui vem direto do banco.
          </p>
          <div className="economy-list">
            <div><LockKeyhole size={16} />Sem comprar XP ou Graninha</div>
            <div><ShieldCheck size={16} />Sem recompensar gastos artificiais</div>
            <div><CheckCircle2 size={16} />Marcos históricos preservados</div>
            <div><Target size={16} />Dificuldade dos Sonhos calculada no servidor</div>
          </div>
        </Card>
      </div>
    </>
  )
}
