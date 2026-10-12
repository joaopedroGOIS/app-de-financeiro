import { Activity, ArrowDownLeft, ArrowUpRight, Award, Banknote, BookOpen, CalendarClock, CarFront, Clapperboard, Coins, Flame, Gem, HeartPulse, House, Landmark, Pencil, Plus, Repeat2, Shapes, ShieldCheck, ShoppingBag, Sparkles, Target, Trash2, TrendingDown, TrendingUp, Utensils, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { categories, categoryColor, compact, currency, dateToday, displayDate, monthName, monthShift, percent, signed } from '../data'
import type { Entry, Goal } from '../data'
import { Badge, Button, Card, CardHeader, DonutChart, EmptyState, EvolutionChart, ProgressBar, StatCard } from '../ui'
import type { EvolutionPoint } from '../ui'
import type { PageProps } from './shared'

/* ==========================================================================
   Dashboard — visão consolidada da situação financeira + camada de jogo.
   Nenhum valor é inventado: sem dados, o componente mostra o estado vazio.
   ========================================================================== */

const categoryIcons: Record<string, LucideIcon> = {
  'Alimentação': Utensils, 'Moradia': House, 'Transporte': CarFront, 'Compras': ShoppingBag,
  'Saúde': HeartPulse, 'Lazer': Clapperboard, 'Educação': BookOpen, 'Outros': Shapes,
}

export function CategoryGlyph({ name, type, size = 18 }: { name: string; type?: Entry['type']; size?: number }) {
  const Icon = type === 'income' ? ArrowDownLeft : type === 'adjustment' ? Repeat2 : categoryIcons[name] ?? Shapes
  return <Icon size={size} strokeWidth={2} />
}

export function DashboardPage({ state, month, go, open, editEntry, editGoal, contributeTo, requestRemove }: PageProps & { month: string }) {
  const firstName = state.user.name.split(' ')[0]
  const today = dateToday()
  const previousMonth = monthShift(month, -1)
  const previousLabel = monthName(previousMonth).split(' de ')[0]
  const monthEntries = state.entries.filter(entry => entry.date.slice(0, 7) === month)
  const previousEntries = state.entries.filter(entry => entry.date.slice(0, 7) === previousMonth)
  const income = monthEntries.filter(entry => entry.type === 'income').reduce((sum, entry) => sum + entry.amountCents, 0)
  const expenses = monthEntries.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + entry.amountCents, 0)
  const previousIncome = previousEntries.filter(entry => entry.type === 'income').reduce((sum, entry) => sum + entry.amountCents, 0)
  const previousExpenses = previousEntries.filter(entry => entry.type === 'expense').reduce((sum, entry) => sum + entry.amountCents, 0)
  const balance = state.accounts.reduce((sum, account) => sum + account.balanceCents, 0)
  const categoryTotals = categories
    .map(category => ({ ...category, cents: monthEntries.filter(entry => entry.type === 'expense' && entry.category === category.name).reduce((sum, entry) => sum + entry.amountCents, 0) }))
    .filter(category => category.cents > 0)
    .sort((a, b) => b.cents - a.cents)
  const upcoming = state.entries.filter(entry => entry.date > today).sort((a, b) => a.date.localeCompare(b.date))
  const evolution: EvolutionPoint[] = Array.from({ length: 6 }, (_, index) => {
    const key = monthShift(month, index - 5)
    const value = state.entries.filter(entry => entry.date.slice(0, 7) === key && entry.type !== 'adjustment').reduce((sum, entry) => sum + signed(entry), 0)
    return { key, label: monthName(key).split(' de ')[0].slice(0, 3), value, formatted: compact(value) }
  })
  const hasEvolution = evolution.some(point => point.value !== 0)

  // Comparativo só aparece quando o mês anterior tem registros reais.
  const compare = (current: number, previous: number, inverted = false) => {
    if (!previous) return undefined
    const variation = Math.round(((current - previous) / previous) * 100)
    if (!variation) return { direction: 'flat' as const, label: 'igual a ' + previousLabel, tone: 'neutral' as const }
    const grew = variation > 0
    return {
      direction: grew ? 'up' as const : 'down' as const,
      label: `${grew ? '+' : ''}${variation}% vs ${previousLabel}`,
      tone: (inverted ? !grew : grew) ? 'good' as const : 'bad' as const,
    }
  }

  const xpProgress = state.progress.nextLevelXp ? Math.min(100, (state.progress.xp_total / state.progress.nextLevelXp) * 100) : 0
  const openEntry = () => { if (!state.accounts.length) return go('accounts'); editEntry(null); open('entry') }
  const newEntryButton = <Button onClick={openEntry}><Plus size={18} />Nova movimentação</Button>

  return (
    <>
      <div className="dash-hero">
        <div className="hero-greeting">
          <span className="hero-kicker"><Sparkles size={15} /> SEU PAINEL DE EVOLUÇÃO</span>
          <h2>Olá, {firstName}</h2>
          <p>Sua grana, seus objetivos e sua evolução em um só lugar. Organize o presente e cuide do futuro um passo de cada vez.</p>
          <div className="hero-actions">
            <Button variant="on-hero" onClick={openEntry}><Plus size={18} />Nova movimentação</Button>
            <Button variant="on-hero" onClick={() => go('journey')}><Award size={18} />Minha jornada</Button>
          </div>
        </div>

        <div className="level-panel">
          <div className="level-head">
            <span className="level-badge">{state.progress.level}</span>
            <span className="level-head-text">
              <small>NÍVEL ATUAL</small>
              <strong>{state.progress.xp_total} XP</strong>
            </span>
          </div>
          <div>
            <div className="level-xp">
              <span>Progresso para o nível {state.progress.level + 1}</span>
              <strong>{state.progress.nextLevelXp ? `${state.progress.xp_total}/${state.progress.nextLevelXp}` : 'sem curva'}</strong>
            </div>
            <ProgressBar value={xpProgress} onHero size="thick" />
            <p className="level-note">
              {state.progress.nextLevelXp
                ? 'Progresso calculado pela curva oficial de XP do servidor.'
                : 'A curva oficial de XP ainda não está configurada neste servidor. Mostramos seu XP registrado, sem estimar nada.'}
            </p>
          </div>
          <div className="hero-chips">
            <span className="hero-chip">
              <Coins size={17} />
              <span className="hero-chip-text"><strong>{state.progress.graninha_balance} Graninha</strong><small>Moeda virtual</small></span>
            </span>
            <span className="hero-chip">
              <Flame size={17} />
              <span className="hero-chip-text"><strong>{state.stats.streak} {state.stats.streak === 1 ? 'dia' : 'dias'}</strong><small>de sequência</small></span>
            </span>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard icon={Wallet} label="Saldo total das contas" value={currency(balance)} hint={`${state.accounts.length} ${state.accounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}`} />
        <StatCard icon={TrendingUp} tone="success" label={`Receitas em ${monthName(month)}`} value={currency(income)} hint={previousEntries.length ? undefined : 'Sem registros no mês anterior para comparar.'} trend={compare(income, previousIncome)} />
        <StatCard icon={TrendingDown} tone="danger" label={`Despesas em ${monthName(month)}`} value={currency(expenses)} hint={previousEntries.length ? undefined : 'Sem registros no mês anterior para comparar.'} trend={compare(expenses, previousExpenses, true)} />
        <StatCard icon={ShieldCheck} tone="info" label="Reserva financeira" value={currency(state.stats.reserveCents)} hint="Somente contas marcadas como reserva" />
      </div>

      <div className="dashboard-grid">
        <div className="span-6"><StatCard icon={Gem} label="Patrimônio registrado" value={currency(state.stats.netWorthCents)} hint="Contas + bens − dívidas" /></div>
        <div className="span-6">
          <div className="stat-card">
            <div className="stat-head">
              <span className="stat-icon warning"><Sparkles size={19} /></span>
              <Badge tone="warning">Critérios em definição</Badge>
            </div>
            <span className="stat-label">Classe financeira</span>
            <strong className="stat-value small">A definir</strong>
            <small className="stat-hint">Nenhuma classe é atribuída por saldo ou reserva enquanto os critérios oficiais não estiverem definidos.</small>
          </div>
        </div>

        <Card className="span-8">
          <CardHeader title="Evolução financeira" description="Resultado mensal de receitas menos gastos — sem ajustes, bens ou reserva." icon={Activity} />
          {hasEvolution ? (
            <>
              <EvolutionChart data={evolution} />
              <div className="chart-legend">
                <span><i className="legend-dot" />Resultado do mês</span>
                <span><i className="legend-dot warning" />Mês negativo</span>
              </div>
            </>
          ) : (
            <EmptyState icon={<TrendingUp size={26} />} title="Sua evolução começa agora" text="Registre receitas e gastos para acompanhar os resultados mês a mês." action={newEntryButton} />
          )}
        </Card>

        <Card className="span-4">
          <CardHeader title="Para onde foi sua grana?" description={`Distribuição dos gastos em ${monthName(month)}`} action={<Button variant="ghost" size="sm" onClick={() => go('entries')}>Ver todas <ArrowUpRight size={15} /></Button>} />
          {categoryTotals.length ? (
            <div className="category-panel">
              <DonutChart
                segments={categoryTotals.map(category => ({ label: category.name, value: category.cents, color: categoryColor(category.name).color }))}
                centerValue={currency(expenses)}
                centerLabel="gasto no mês"
              />
              <div className="category-list">
                {categoryTotals.slice(0, 5).map(category => {
                  const tone = categoryColor(category.name)
                  return (
                    <div className="category-row" key={category.name}>
                      <span className="category-glyph" style={{ background: tone.soft, color: tone.color }}><CategoryGlyph name={category.name} /></span>
                      <div className="category-row-body">
                        <div className="category-line"><strong>{category.name}</strong><span>{percent(category.cents, expenses)}%</span></div>
                        <ProgressBar value={percent(category.cents, expenses)} size="thin" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <EmptyState icon={<Activity size={26} />} title="Tudo tranquilo por aqui" text="Quando você registrar gastos neste mês, verá seus hábitos por categoria." />
          )}
        </Card>

        {upcoming.length > 0 && (
          <Card className="span-12">
            <CardHeader title="Próximas contas a vencer" description="Lançamentos com data futura na sua linha do tempo." icon={CalendarClock} />
            <div className="entry-list">
              {upcoming.slice(0, 5).map(entry => <EntryRow key={entry.id} entry={entry} account={accountOf(state, entry)} onEdit={() => { editEntry(entry); open('entry') }} onRemove={() => requestRemove(archiveRequest(entry))} />)}
            </div>
          </Card>
        )}

        <Card className="span-7">
          <CardHeader title="Movimentações recentes" description="Os últimos passos da sua organização" action={<Button variant="ghost" size="sm" onClick={() => go('entries')}>Ver todas <ArrowUpRight size={15} /></Button>} />
          {state.entries.length ? (
            <div className="entry-list">
              {state.entries.slice(0, 5).map(entry => (
                <EntryRow key={entry.id} entry={entry} account={accountOf(state, entry)} onEdit={() => { editEntry(entry); open('entry') }} onRemove={() => requestRemove(archiveRequest(entry))} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Banknote size={26} />}
              title="Seu histórico começa aqui"
              text={state.accounts.length ? 'Adicione uma movimentação e veja sua evolução ganhar forma.' : 'Crie uma conta para começar a registrar entradas e gastos.'}
              action={state.accounts.length ? newEntryButton : <Button onClick={() => go('accounts')}><Landmark size={17} />Criar conta</Button>}
            />
          )}
        </Card>

        <Card className="span-5">
          <CardHeader title="Metas & Sonhos" description="Progresso real, sem usar a reserva" icon={Target} action={<Button variant="ghost" size="sm" onClick={() => go('goals')}>Ver todos <ArrowUpRight size={15} /></Button>} />
          {state.goals.length ? (
            <div className="preview-goals">
              {state.goals.slice(0, 3).map(goal => <GoalPreview key={goal.id} goal={goal} onOpen={() => { contributeTo(goal); open('contribution') }} />)}
            </div>
          ) : (
            <EmptyState icon={<Target size={26} />} title="Qual é o próximo sonho?" text="Crie um objetivo e acompanhe seu progresso passo a passo." action={<Button variant="secondary" onClick={() => { editGoal(null); open('goal') }}><Plus size={17} />Criar objetivo</Button>} />
          )}
        </Card>
      </div>
    </>
  )
}

const accountOf = (state: PageProps['state'], entry: Entry) => state.accounts.find(account => account.id === entry.accountId)?.name ?? 'Conta'
const archiveRequest = (entry: Entry) => ({
  path: `/entries/${entry.id}`,
  title: 'Arquivar movimentação',
  description: `Arquivar “${entry.title}”? O registro fica preservado no histórico do servidor, mas deixa de compor seus saldos.`,
})

export function EntryRow({ entry, account, onEdit, onRemove }: { entry: Entry; account: string; onEdit: () => void; onRemove: () => void }) {
  const tone = categoryColor(entry.category)
  const value = signed(entry)
  const isExpense = entry.type === 'expense'
  return (
    <div className="entry-row">
      <span
        className="entry-glyph"
        style={{
          background: entry.type === 'income' ? 'var(--success-soft)' : entry.type === 'adjustment' ? 'var(--info-soft)' : tone.soft,
          color: entry.type === 'income' ? 'var(--success)' : entry.type === 'adjustment' ? 'var(--info)' : tone.color,
        }}
      >
        <CategoryGlyph name={entry.category} type={entry.type} />
      </span>
      <div className="entry-main">
        <strong>{entry.title}</strong>
        <span className="entry-meta">{entry.category}<span className="sep">·</span>{account}<span className="sep">·</span>{displayDate(entry.date)}</span>
      </div>
      <strong className={`entry-value ${entry.type}`}>{value > 0 ? '+' : value < 0 ? '−' : ''}{currency(Math.abs(entry.amountCents))}</strong>
      <div className="entry-actions">
        <button type="button" className="icon-button" onClick={onEdit} aria-label={`Editar ${entry.title}`} title="Editar"><Pencil size={16} /></button>
        <button type="button" className="icon-button danger" onClick={onRemove} aria-label={`Arquivar ${entry.title}`} title="Arquivar"><Trash2 size={16} /></button>
      </div>
    </div>
  )
}

function GoalPreview({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const progress = percent(goal.savedCents, goal.targetCents)
  const done = goal.savedCents >= goal.targetCents
  return (
    <div className="preview-goal">
      <span className="preview-goal-icon">{goal.icon}</span>
      <div className="preview-goal-body">
        <strong>{goal.title}</strong>
        <small>{currency(goal.savedCents)} de {currency(goal.targetCents)}</small>
        <ProgressBar value={progress} tone={done ? 'success' : ''} size="thin" />
      </div>
      <button type="button" className="text-action" onClick={onOpen} disabled={done}>{progress}%</button>
    </div>
  )
}
