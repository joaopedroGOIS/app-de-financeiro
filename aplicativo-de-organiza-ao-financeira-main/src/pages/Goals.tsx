import { Activity, ArrowRight, Check, CircleHelp, Pencil, Plus, Sparkles, Target, Trash2 } from 'lucide-react'
import { currency, displayDate, percent } from '../data'
import type { Analysis, Goal } from '../data'
import { Badge, Button, EmptyState, ProgressBar, rarityOf } from '../ui'
import type { PageProps } from './shared'

export function GoalsPage({ state, analysis, analysisLoading, analyze, open, editGoal, contributeTo, requestRemove }: PageProps & {
  analysis: Record<string, Analysis>
  analysisLoading: string | null
  analyze: (goal: Goal) => void
}) {
  const openGoal = () => { editGoal(null); open('goal') }
  const savedTotal = state.goals.reduce((sum, goal) => sum + goal.savedCents, 0)

  return (
    <>
      <div className="goals-hero">
        <div>
          <span className="hero-kicker"><Sparkles size={15} /> CADA PASSO TEM VALOR</span>
          <h2>O futuro se constrói um pouquinho por vez.</h2>
          <p>Você já registrou {currency(savedTotal)} em progresso de objetivos — sempre sem tocar na sua reserva.</p>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <h2>Seus objetivos</h2>
          <p>Marcos de 10%, 25%, 50%, 75% e 100% ficam registrados uma única vez.</p>
        </div>
        <span className="count-pill">{state.goals.length} {state.goals.length === 1 ? 'objetivo' : 'objetivos'}</span>
      </div>

      {state.goals.length ? (
        <div className="tile-grid">
          {state.goals.map(goal => {
            const progress = percent(goal.savedCents, goal.targetCents)
            const done = goal.savedCents >= goal.targetCents
            const result = analysis[goal.id]
            const rarity = rarityOf(result?.difficulty)
            return (
              <article className="tile goal-tile" key={goal.id}>
                <div className="tile-top">
                  <span className="goal-icon">{goal.icon}</span>
                  <div className="tile-actions">
                    <button type="button" className="icon-button" onClick={() => { editGoal(goal); open('goal') }} aria-label={`Editar ${goal.title}`} title="Editar"><Pencil size={16} /></button>
                    <button type="button" className="icon-button danger" onClick={() => requestRemove({ path: `/goals/${goal.id}`, title: 'Arquivar objetivo', description: `Arquivar “${goal.title}”? O histórico de contribuições e marcos será preservado no servidor.` })} aria-label={`Arquivar ${goal.title}`} title="Arquivar"><Trash2 size={16} /></button>
                  </div>
                </div>
                <Badge tone={goal.kind === 'sonho' ? 'primary' : 'neutral'}>{goal.kind === 'sonho' ? 'Sonho' : 'Meta'}</Badge>
                <h3>{goal.title}</h3>
                <p className="goal-deadline">{goal.deadline ? `Até ${displayDate(goal.deadline)}` : 'Sem prazo definido'}</p>
                <div className="goal-values">
                  <strong>{currency(goal.savedCents)}</strong>
                  <span>de {currency(goal.targetCents)}</span>
                </div>
                <ProgressBar value={progress} tone={done ? 'success' : ''} />
                <div className="goal-progress-label">
                  <span>{progress}% concluído</span>
                  <span>Faltam {currency(Math.max(0, goal.targetCents - goal.savedCents))}</span>
                </div>
                <div className="milestones">
                  {[10, 25, 50, 75, 100].map(milestone => (
                    <span key={milestone} className={`milestone ${goal.milestones.includes(milestone) ? 'reached' : ''}`} title={`Marco de ${milestone}%`}>
                      {goal.milestones.includes(milestone) ? <Check size={13} /> : milestone}
                    </span>
                  ))}
                </div>
                <Button variant="secondary" wide disabled={done} onClick={() => { contributeTo(goal); open('contribution') }}>
                  {done ? <><Check size={17} />Objetivo alcançado</> : <><Plus size={17} />Registrar progresso</>}
                </Button>
                {goal.kind === 'sonho' && (
                  <div className="analysis-box">
                    <button type="button" className="analysis-trigger" onClick={() => analyze(goal)} disabled={analysisLoading === goal.id}>
                      <Activity size={15} />
                      {analysisLoading === goal.id ? 'Analisando...' : result ? 'Atualizar análise' : 'Analisar dificuldade'}
                      <ArrowRight size={14} />
                    </button>
                    {result && <AnalysisResult result={result} rarity={rarity} />}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={<Target size={30} />} title="Todo sonho começa com um primeiro passo" text="Crie uma Meta ou um Sonho e acompanhe seu caminho até lá." action={<Button onClick={openGoal}><Plus size={17} />Criar objetivo</Button>} />
      )}

      <div className="info-note">
        <CircleHelp size={19} />
        <p><strong>Importante:</strong> criar um objetivo não gera XP. Contribuições são registros de progresso e não movimentam contas automaticamente. A dificuldade dos Sonhos usa o histórico de 6 meses completos, nunca o patrimônio ou a reserva.</p>
      </div>
    </>
  )
}

function AnalysisResult({ result, rarity }: { result: Analysis; rarity?: { tone: Parameters<typeof Badge>[0]['tone']; label: string } }) {
  if (result.status !== 'ready') {
    return (
      <div className="analysis-result">
        <strong>{result.status === 'expired' ? 'Prazo encerrado' : 'Dados insuficientes'}</strong>
        <p>{result.status === 'expired' ? 'Ajuste o prazo para uma nova análise.' : 'Estamos conhecendo seu ritmo financeiro. Continue registrando suas movimentações para analisarmos melhor a dificuldade deste sonho.'}</p>
      </div>
    )
  }
  return (
    <div className="analysis-result">
      <strong>
        {result.difficulty}
        {rarity && <Badge tone={rarity.tone}>{rarity.label}</Badge>}
        <Badge tone="outline">Confiança {result.confidence}</Badge>
      </strong>
      <p>
        Capacidade sustentável estimada: {currency(result.capacityCents ?? 0)}/mês.{' '}
        {result.monthsLeft ? `Necessidade mensal: ${currency(result.needMonthlyCents ?? 0)}.` : `Tempo estimado: ${Math.ceil(result.estimatedMonths ?? 0)} meses.`}
      </p>
    </div>
  )
}
