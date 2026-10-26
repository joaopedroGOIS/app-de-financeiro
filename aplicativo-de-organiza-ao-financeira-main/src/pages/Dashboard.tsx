import { MonthlyBudgets } from '../MonthlyBudgets'
import { RecurringExpenses } from '../RecurringExpenses'
import {FirstSteps} from '../FirstSteps'
import { useState } from 'react'
import { FinancialReports, ReportDetails } from './FinancialReports'
import { Activity, ArrowDownLeft, ArrowUpRight, Award, Banknote, BookOpen, CalendarClock, CarFront, Clapperboard, Coins, Flame, Gem, HeartPulse, House, Landmark, Pencil, Plus, Repeat2, Shapes, ShieldCheck, ShoppingBag, Sparkles, Target, Trash2, TrendingDown, TrendingUp, Utensils, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { categoryColor, currency, dateToday, displayDate, monthName, monthShift, percent, signed } from '../data'
import type { Entry, Goal } from '../data'
import { Badge, Button, Card, CardHeader, DonutChart, EmptyState, GoalCard, ProgressBar } from '../ui'

import type { PageProps } from './shared'
import { levelProgress, RewardHistory } from '../gamification'

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

export function DashboardPage({ state, month, go, open, editEntry, editGoal, contributeTo, requestRemove, onUpdated,onMonth }: PageProps & { month: string; onUpdated?:()=>Promise<unknown>;onMonth?:(month:string)=>void }) {
  const [budgetRevision,setBudgetRevision]=useState(0)
  const [planningOpen,setPlanningOpen]=useState(false)
  const featuredMission=state.missions?.current.find(m=>m.status==='in_progress') ?? state.missions?.current.find(m=>m.status==='available')
  const [reportCategory, setReportCategory] = useState<string | null>(null)
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
  // O histórico é a fonte dos rótulos, inclusive categorias personalizadas ou arquivadas.
  const expensesByCategory = new Map<string, number>()
  for (const entry of monthEntries) {
    if (entry.type !== 'expense') continue
    expensesByCategory.set(entry.category, (expensesByCategory.get(entry.category) ?? 0) + entry.amountCents)
  }
  const categoryTotals = Array.from(expensesByCategory, ([name, cents]) => ({ name, cents }))
    .filter(category => category.cents > 0)
    .sort((a, b) => b.cents - a.cents)
  const recentEntries = state.entries.filter(entry => entry.date <= today)
  const upcoming = state.entries.filter(entry => entry.date > today && !entry.settled && !entry.cardPaymentId).sort((a, b) => a.date.localeCompare(b.date))
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

  const incomeTrend = compare(income, previousIncome)
  const expenseTrend = compare(expenses, previousExpenses, true)
  const monthlyResult = income - expenses
  const xpBar = levelProgress(state.progress), xpProgress = xpBar.percent
  const openEntry = () => { if (!state.accounts.length) return go('accounts'); editEntry(null); open('entry') }
  const newEntryButton = <Button onClick={openEntry}><Plus size={18} />Nova movimentação</Button>
  const monthlySummary = (
    <MonthlySummary
      month={month}
      income={income}
      expenses={expenses}
      result={monthlyResult}
      incomeTrend={incomeTrend}
      expenseTrend={expenseTrend}
      hasPreviousEntries={previousEntries.length > 0}
    />
  )

  return (
    <>
      <div className="identity-welcome"><span className="eyebrow">Olá, {firstName}</span><h1>Cuide do agora.<br/><em>Conquiste o depois.</em></h1></div>
      <div className="identity-overview">
        <Card className="identity-worth">
          <span className="eyebrow">Patrimônio líquido registrado</span>
          <strong className="identity-money">{currency(state.stats.netWorthCents)}</strong>
          <small>Contas + bens − dívidas, incluindo cartões</small>
          <div className="identity-worth-details"><span><Wallet size={16}/>Contas<strong>{currency(balance)}</strong></span><span><ShieldCheck size={16}/>Reserva<strong>{currency(state.stats.reserveCents)}</strong></span></div>
          <button className="text-action" type="button" onClick={()=>go('wealth')}>Ver patrimônio <ArrowUpRight size={15}/></button>
          <small className="identity-class">Classe financeira: {state.stats.financialClass ?? 'Aguardando sincronização'}</small>
        </Card>
        <Card className="identity-player">
          <div className="identity-player-heading"><span className="identity-crystal" aria-label={`Nível ${state.progress.level}`}>{state.progress.level}</span><div><span className="eyebrow">Sua evolução</span><h2>Nível {state.progress.level}</h2><small>{state.stats.streak} dias de sequência</small></div></div>
          <div className="identity-xp"><span>{state.progress.xp_total} XP</span><small>{xpBar.label}</small></div>
          <ProgressBar value={xpProgress} label="Progresso de XP para o próximo nível"/>
          <div className="identity-player-footer"><span><Coins size={16}/>{state.progress.graninha_balance} Graninhas</span><button className="text-action" type="button" onClick={()=>go('journey')}>Jornada ↗</button></div>
          {!state.progress.curveVersion&&<small className="identity-config-note">A curva oficial de XP ainda não está configurada.</small>}
        </Card>
      </div>
      <nav className="identity-actions" aria-label="Atalhos financeiros">
        <button type="button" onClick={openEntry}><span><Plus size={23}/></span>Registrar</button>
        <button type="button" onClick={()=>go('accounts')}><span><Wallet size={23}/></span>Contas</button>
        <button type="button" onClick={()=>go('goals')}><span><Target size={23}/></span>Objetivos</button>
        <button type="button" onClick={()=>{setPlanningOpen(true);requestAnimationFrame(()=>document.getElementById('identity-planning')?.scrollIntoView({behavior:'smooth',block:'start'}))}}><span><CalendarClock size={23}/></span>Planejar</button>
      </nav>
      {monthlySummary}
      <div className="identity-focus">
        <div className="identity-focus-icon"><Award size={28}/></div>
        <div><span className="eyebrow">Seu próximo passo</span><h3>{featuredMission?.name ?? 'Sua jornada financeira'}</h3>
        {featuredMission ? <><ProgressBar value={Math.min(100,((Math.min(featuredMission.days,featuredMission.requiredDays)+Math.min(featuredMission.reviews,featuredMission.requiredReviews))/(featuredMission.requiredDays+featuredMission.requiredReviews||1))*100)} label={`Progresso de ${featuredMission.name}`}/><small>{featuredMission.days}/{featuredMission.requiredDays} dias{featuredMission.requiredReviews>0?` · ${featuredMission.reviews}/${featuredMission.requiredReviews} revisões`:''} · +{featuredMission.xp} XP · {featuredMission.graninha} Graninhas</small></> : <small>{state.missions?'Acompanhe suas conquistas e rotinas.':'Missões indisponíveis no momento.'}</small>}</div>
        <Button variant="ghost" aria-label="Ver jornada" onClick={()=>go('journey')}><ArrowUpRight size={19}/><span>Ver jornada</span></Button>
      </div>
      <details className="identity-planning" id="identity-planning" open={planningOpen} onToggle={event=>setPlanningOpen(event.currentTarget.open)}>
        <summary><CalendarClock size={19}/>Planejamento do mês<span>Orçamentos e compromissos</span></summary>


      {onMonth&&<FirstSteps key={state.user.id} state={state} budgetRevision={budgetRevision} onAccount={()=>go('accounts')} onEntry={()=>go('entries')} onBudget={()=>{setPlanningOpen(true);onMonth(dateToday().slice(0,7));requestAnimationFrame(()=>{const target=document.getElementById('monthly-budget-guide');target?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target?.focus({preventScroll:true})})}}/>}
      <section id="monthly-budget-guide" tabIndex={-1}><MonthlyBudgets key={`budget:${month}`} month={month} state={state} onChanged={()=>setBudgetRevision(n=>n+1)}/></section>
      {onUpdated&&<RecurringExpenses key={`recurring:${month}`} state={state} month={month} onUpdated={onUpdated} compact onManage={()=>go('entries')}/>}

      </details>
      <details className="identity-planning"><summary><Award size={19}/>Últimas recompensas</summary><RewardHistory game={state.gamification} limit={3}/></details>
      <div className="dashboard-grid">
        <FinancialReports key={month} entries={state.entries} month={month} />

        <Card className="span-4 category-report">
          <CardHeader title="Para onde foi sua grana?" description={`Distribuição dos gastos em ${monthName(month)}`} action={<Button variant="ghost" size="sm" onClick={() => go('entries')}>Ver todas <ArrowUpRight size={15} /></Button>} />
          {categoryTotals.length ? (
            <div className="category-panel">
              <DonutChart
                segments={categoryTotals.map(category => ({ label: category.name, value: category.cents, formattedValue: currency(category.cents), color: categoryColor(category.name).color }))}
                centerValue={currency(expenses)}
                centerLabel="gasto no mês"
              />
              <div className="category-list">
                {categoryTotals.map(category => {
                  const tone = categoryColor(category.name)
                  return (
                    <button type="button" className="category-report-button" key={category.name} onClick={() => setReportCategory(category.name)} aria-label={`Ver lançamentos de ${category.name}`} aria-pressed={reportCategory === category.name}><div className="category-row">
                      <span className="category-glyph" style={{ background: tone.soft, color: tone.color }}><CategoryGlyph name={category.name} /></span>
                      <div className="category-row-body">
                        <div className="category-line"><strong>{category.name}</strong><span>{percent(category.cents, expenses)}%</span></div>
                        <small className="category-amount">{currency(category.cents)}</small>
                        <ProgressBar value={percent(category.cents, expenses)} size="thin" label={`Percentual de ${category.name} nos gastos de ${monthName(month)}`} />
                      </div>
                    </div></button>
                  )
                })}
              </div>
            </div>
          ) : (
            <EmptyState icon={<Activity size={26} />} title="Tudo tranquilo por aqui" text="Quando você registrar gastos neste mês, verá seus hábitos por categoria." />
          )}
        </Card>

        {reportCategory && <Card className="span-12 category-report-details"><CardHeader title="Detalhes por categoria" action={<Button variant="ghost" size="sm" onClick={() => setReportCategory(null)}>Fechar detalhes</Button>} /><ReportDetails key={`${month}-${reportCategory}`} title={`${reportCategory} · ${monthName(month)}`} entries={monthEntries.filter(entry => entry.type === 'expense' && entry.category === reportCategory && !entry.cardPaymentId)} /></Card>}

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
          {recentEntries.length ? (
            <div className="entry-list">
              {recentEntries.slice(0, 5).map(entry => (
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

type MonthlyTrend = { direction: 'up' | 'down' | 'flat'; label: string; tone: 'good' | 'bad' | 'neutral' }

function MonthlySummary({ month, income, expenses, result, incomeTrend, expenseTrend, hasPreviousEntries }: {
  month: string
  income: number
  expenses: number
  result: number
  incomeTrend?: MonthlyTrend
  expenseTrend?: MonthlyTrend
  hasPreviousEntries: boolean
}) {
  return (
    <div className="mini-stats dashboard-month-stats" role="group" aria-label={`Resumo financeiro de ${monthName(month)}`}>
      <div className="mini-stat">
        <span className="mini-stat-label"><TrendingUp size={14} />Receitas</span>
        <strong className="positive">{currency(income)}</strong>
        {incomeTrend ? <small className={`mini-trend ${incomeTrend.tone}`}>{incomeTrend.direction === 'up' ? <TrendingUp size={12} /> : incomeTrend.direction === 'down' ? <TrendingDown size={12} /> : null}{incomeTrend.label}</small> : !hasPreviousEntries && <small className="mini-stat-note">Sem registros no mês anterior para comparar.</small>}
      </div>
      <div className="mini-stat">
        <span className="mini-stat-label"><TrendingDown size={14} />Despesas</span>
        <strong className="negative">{currency(expenses)}</strong>
        {expenseTrend ? <small className={`mini-trend ${expenseTrend.tone}`}>{expenseTrend.direction === 'up' ? <TrendingUp size={12} /> : expenseTrend.direction === 'down' ? <TrendingDown size={12} /> : null}{expenseTrend.label}</small> : !hasPreviousEntries && <small className="mini-stat-note">Sem registros no mês anterior para comparar.</small>}
      </div>
      <div className="mini-stat">
        <span className="mini-stat-label"><Wallet size={14} />Resultado do mês</span>
        <strong className={result < 0 ? 'negative' : 'positive'}>{currency(result)}</strong>
        <small className="mini-stat-note">Receitas menos despesas</small>
      </div>
    </div>
  )
}

const accountOf = (state: PageProps['state'], entry: Entry) => state.accounts.find(account => account.id === entry.accountId)?.name ?? state.creditCards?.cards.find(card => card.id === entry.cardId)?.name ?? 'Conta'
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
        <span className="entry-meta">{entry.category}{entry.subcategory ? <><span className="sep">·</span>{entry.subcategory}</> : null}<span className="sep">·</span>{account}<span className="sep">·</span>{displayDate(entry.date)}</span>
      </div>
      <strong className={`entry-value ${entry.type}`}>{value > 0 ? '+' : value < 0 ? '−' : ''}{currency(Math.abs(entry.amountCents))}</strong>
      <div className="entry-actions">
        {entry.cardId || entry.cardPaymentId ? <small>Em Cartões</small> : <>
        <button type="button" className="icon-button" onClick={onEdit} aria-label={`Editar ${entry.title}`} title="Editar"><Pencil size={16} /></button>
        <button type="button" className="icon-button danger" onClick={onRemove} aria-label={`Arquivar ${entry.title}`} title="Arquivar"><Trash2 size={16} /></button>
      </>}
      </div>
    </div>
  )
}

function GoalPreview({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const progress = percent(goal.savedCents, goal.targetCents)
  const done = goal.savedCents >= goal.targetCents
  return (
    <GoalCard
      compact
      className="preview-goal"
      title={goal.title}
      icon={goal.icon}
      kind={<Badge tone={goal.kind === 'sonho' ? 'primary' : 'neutral'}>{goal.kind === 'sonho' ? 'Sonho' : 'Meta'}</Badge>}
      description={`${currency(goal.savedCents)} de ${currency(goal.targetCents)}`}
      progress={progress}
      actions={<button type="button" className="text-action" onClick={onOpen} disabled={done} aria-label={`Registrar progresso em ${goal.title}, ${progress}% concluído`}>{progress}%</button>}
    >
      <ProgressBar value={progress} tone={done ? 'success' : ''} size="thin" label={`Progresso de ${goal.title}`} />
    </GoalCard>
  )
}
