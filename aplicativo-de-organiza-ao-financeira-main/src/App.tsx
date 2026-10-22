import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowRight, Award, BarChart3, Check, ChevronRight, CreditCard, Download, Gem, LogOut, LockKeyhole, Plus, Search, ShieldCheck, Sparkles, Target, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api, ApiError, currency, dateToday, json, monthName, monthShift, setSessionToken, signed } from './data'
import type { Account, Analysis, Asset, Entry, Goal, State } from './data'
import { useTheme } from './theme'
import type { ThemeMode } from './theme'
import { AccountForm, AssetForm, ContributionForm, EntryForm, GoalForm } from './forms'
import { CategoryManager } from './CategoryManager'
import { PlayerSummary, RewardHistory, rewardFeedback } from './gamification'
import { AccountsPage } from './pages/Accounts'
import { CreditCardsPage } from './pages/CreditCards'
import { DashboardPage } from './pages/Dashboard'
import { EntriesPage } from './pages/Entries'
import { CsvImport } from './CsvImportDialog'
import { RecurringExpenses } from './RecurringExpenses'
import type { EntryFilter } from './pages/Entries'
import { GoalsPage } from './pages/Goals'
import { JourneyPage } from './pages/Journey'
import { WealthPage } from './pages/Wealth'
import type { ModalKind, PageId } from './pages/shared'
import { Brand, Button, ConfirmDialog, InlineError, LoadingScreen, Modal, MonthPicker, PageHeading, ThemeMenu, ThemeSelector, Toast } from './ui'

const pagePaths: Record<PageId, string> = { dashboard: 'visao-geral', entries: 'movimentacoes', accounts: 'contas', cards: 'cartoes', wealth: 'patrimonio', goals: 'objetivos', journey: 'jornada' }
const nav: { id: PageId; label: string; short: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Visão geral', short: 'Início', icon: BarChart3 },
  { id: 'accounts', label: 'Minhas contas', short: 'Contas', icon: Wallet },
  { id: 'cards', label: 'Cartões de crédito', short: 'Cartões', icon: CreditCard },
  { id: 'entries', label: 'Movimentações', short: 'Transações', icon: ArrowDownLeft },
  { id: 'goals', label: 'Metas & Sonhos', short: 'Metas', icon: Target },
  { id: 'wealth', label: 'Reserva & patrimônio', short: 'Patrim.', icon: Gem },
  { id: 'journey', label: 'Evolução', short: 'Evolução', icon: Award },
]

function pageFromHash(): PageId {
  return (Object.keys(pagePaths) as PageId[]).find(page => window.location.hash === `#/${pagePaths[page]}`) ?? 'dashboard'
}

function Authentication({ onReady, sessionError = '' }: { onReady: () => void; sessionError?: string }) {
  const [mode, setMode] = useState<'register' | 'login'>(sessionError ? 'login' : 'register')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(sessionError)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const result = await api<{ ok: boolean; sessionToken?: string }>(`/auth/${mode}`, { ...json('POST', mode === 'register' ? { name, email, password } : { email, password }), headers: { 'X-Session-Transport': 'bearer' } })
      if (!result.sessionToken) {
        setMode('login')
        throw new Error('O servidor não retornou uma sessão para esta prévia. Sua conta pode ter sido criada; tente entrar com o mesmo e-mail e senha.')
      }
      setSessionToken(result.sessionToken)
      onReady()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <Brand light />
        <div className="auth-orbit">
          <div className="auth-orbit-ring"><Sparkles size={54} /></div>
          <span className="orbit-bubble bubble-one"><ArrowRight size={17} /></span>
          <span className="orbit-bubble bubble-two"><Award size={17} /></span>
          <span className="orbit-bubble bubble-three"><Gem size={17} /></span>
        </div>
        <div className="auth-story-copy">
          <span className="auth-eyebrow">BEM-VINDO À SUA EVOLUÇÃO</span>
          <h1>Sua grana.<br />Seu jogo.<br /><em>Sua evolução.</em></h1>
          <p>Organize sua vida financeira de um jeito mais leve. Aqui, quem joga é você. Quem ganha é o seu futuro.</p>
        </div>
        <div className="auth-story-foot"><Sparkles size={14} />Pequenos passos. Grandes conquistas.</div>
      </div>
      <div className="auth-form-side">
        <div className="auth-box">
          <div className="auth-mobile-brand">
            <div className="auth-mobile-brand-head">
              <Brand />
              <span className="auth-mobile-secure"><ShieldCheck size={14} />Seu espaço seguro</span>
            </div>
            <div className="auth-mobile-intro">
              <span className="auth-mobile-mark"><Sparkles size={24} /></span>
              <div>
                <span className="auth-eyebrow">BEM-VINDO À SUA EVOLUÇÃO</span>
                <h1>Sua grana.<br /><em>Sua evolução.</em></h1>
                <p>Organize sua vida financeira com clareza, no seu ritmo.</p>
              </div>
            </div>
          </div>
          <span className="auth-top-icon"><Sparkles size={23} /></span>
          <h2>{mode === 'register' ? 'Comece sua jornada' : 'Que bom ter você de volta!'}</h2>
          <p>{mode === 'register' ? 'Um espaço só seu para cuidar do dinheiro sem planilhas e sem complicação.' : 'Entre para continuar de onde você parou.'}</p>
          <div className="auth-tabs">
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }}>Criar conta</button>
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>Entrar</button>
          </div>
          <form className="form" onSubmit={submit}>
            {mode === 'register' && (
              <label>Seu nome
                <input required maxLength={50} autoComplete="name" placeholder="Como podemos chamar você?" value={name} onChange={event => setName(event.target.value)} />
              </label>
            )}
            <label>E-mail
              <input required type="email" autoComplete="email" placeholder="voce@exemplo.com" value={email} onChange={event => setEmail(event.target.value)} />
            </label>
            <label>Senha
              <input required type="password" minLength={mode === 'register' ? 8 : undefined} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder={mode === 'register' ? 'Pelo menos 8 caracteres' : 'Sua senha'} value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            {error && <InlineError>{error}</InlineError>}
            <Button type="submit" wide disabled={pending}>{pending ? 'Só um instante...' : mode === 'register' ? 'Criar meu espaço' : 'Entrar no Granaê'} <ArrowRight size={18} /></Button>
          </form>
          <div className="auth-privacy"><LockKeyhole size={16} />Seus dados são privados. Nada de cassino, apostas ou recompensas por gastar.</div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<State | null>(null)
  const [checking, setChecking] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [page, setPage] = useState<PageId>(pageFromHash)
  const [returnTo, setReturnTo] = useState<PageId | null>(null)
  const [month, setMonth] = useState(dateToday().slice(0, 7))
  const [modal, setModal] = useState<ModalKind | null>(null)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null)
  const [analysis, setAnalysis] = useState<Record<string, Analysis>>({})
  const [analysisLoading, setAnalysisLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [formError, setFormError] = useState('')
  const [query, setQuery] = useState('')
    const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const globalSearchRef = useRef<HTMLInputElement | null>(null)
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('all')
  const [profileName, setProfileName] = useState('')
  const [pendingRemove, setPendingRemove] = useState<{ path: string; title: string; description: string } | null>(null)
  const { mode, setMode } = useTheme()
  const modeRef = useRef(mode)
  const operationKey = useRef<string | null>(null)
  const rewardNotice = useRef('')
  const lastProgress = useRef<State | null>(null)
  modeRef.current = mode

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => setToast({ message, tone })
  const refresh = async () => {
    const data = await api<State>('/state')
    const before=lastProgress.current
    rewardNotice.current=before?.user.id===data.user.id ? rewardFeedback(before.progress,data.progress) : ''
    if(before?.user.id===data.user.id && data.stats.financialClass && before.stats.financialClass && before.stats.financialClass!==data.stats.financialClass) {
      rewardNotice.current += ` Sua classe financeira agora é ${data.stats.financialClass}.`
    }
    lastProgress.current=data
    setState(data)
    return data
  }

  const boot = (afterAuth = false) => {
    setChecking(true)
    refresh()
      .then(() => setSessionError(''))
      .catch(err => {
        setState(null)
        if (err instanceof ApiError && err.status === 401 && !afterAuth) { setSessionToken(null); setSessionError('') }
        else if (err instanceof ApiError && err.status === 401) {
          setSessionToken(null)
          setSessionError(err.code === 'SESSION_MISSING'
            ? 'O login foi aceito, mas a sessão não chegou ao servidor (SESSION_MISSING). Reabra a prévia e tente entrar novamente.'
            : err.code === 'SESSION_INVALID'
              ? 'O login foi aceito, mas a sessão recebida era inválida (SESSION_INVALID). Reabra a prévia e tente novamente.'
              : 'Não foi possível manter a sessão nesta prévia. Tente entrar novamente com seu e-mail e senha.')
        } else setSessionError((err as Error).message || 'Não foi possível abrir sua sessão. Tente novamente.')
      })
      .finally(() => setChecking(false))
  }

  useEffect(() => { boot() }, [])

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setGlobalSearchOpen(true)
        requestAnimationFrame(() => globalSearchRef.current?.focus())
      }
      if (event.key === 'Escape') setGlobalSearchOpen(false)
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])


  useEffect(() => {
    const syncPage = () => { setPage(pageFromHash()); setReturnTo(null) }
    window.addEventListener('popstate', syncPage)
    window.addEventListener('hashchange', syncPage)
    return () => { window.removeEventListener('popstate', syncPage); window.removeEventListener('hashchange', syncPage) }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(timer)
  }, [toast])

  // A preferência salva na conta vence a preferência local (vale entre dispositivos).
  const remoteTheme = state?.preferences?.theme ?? null
  useEffect(() => {
    if (remoteTheme && remoteTheme !== modeRef.current) setMode(remoteTheme)
  }, [remoteTheme, setMode])

  const changeTheme = async (next: ThemeMode) => {
    setMode(next) // aplicação imediata, sem recarregar
    if (!state) return
    try {
      await api('/preferences', json('PATCH', { theme: next }))
    } catch (err) {
      showToast(`Tema aplicado neste dispositivo, mas não foi possível salvá-lo na sua conta: ${(err as Error).message}`, 'error')
    }
  }

  const execute = async (path: string, options: RequestInit, success: string) => {
    setFormError('')
    try {
      if (options.method==='POST' && (path==='/entries' || path.endsWith('/contributions'))) {
        operationKey.current ??= crypto.randomUUID()
        const requestHeaders=new Headers(options.headers)
        requestHeaders.set('Idempotency-Key',operationKey.current)
        options={...options,headers:requestHeaders}
      }
      await api(path, options)
    } catch (err) {
      const message = (err as Error).message
      setFormError(message)
      showToast(message, 'error')
      return false
    }
    // A operação já está confirmada. Uma falha de leitura não deve oferecer novo envio.
    operationKey.current=null
    setAnalysis({})
    setModal(null)
    try {
      await refresh()
      showToast([success,rewardNotice.current].filter(Boolean).join(' '))
    } catch { showToast(`${success} Não foi possível atualizar o painel agora. Recarregue para sincronizar.`, 'error') }
    return true
  }

  const go = (to: PageId) => {
    if (to !== page) {
      window.history.pushState(null, '', `#/${pagePaths[to]}`)
      setPage(to)
    }
    setReturnTo(null)
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    window.scrollTo({ top: 0, behavior })
  }

  const goHome = () => { const from = page; go('dashboard'); if (from !== 'dashboard') setReturnTo(from) }
  const goBack = () => { if (returnTo) window.history.back() }
  const open = (kind: ModalKind) => { operationKey.current=null; setFormError(''); setModal(kind) }
  const chooseMonth = (offset: number) => setMonth(previous => monthShift(previous, offset))

  const downloadCSV = () => {
    if (!state) return
    const rows = [['Data', 'Tipo', 'Conta', 'Categoria', 'Subcategoria', 'Descrição', 'Valor (R$)', 'Observação', 'Situação'],
    ...[...state.entries.map(entry => ({ ...entry, archived: false })), ...state.archivedEntries.map(entry => ({ ...entry, archived: true }))]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(entry => [
        entry.date,
        entry.cardPaymentId ? 'Pagamento de fatura' : entry.type === 'income' ? 'Receita' : entry.type === 'expense' ? 'Gasto' : 'Ajuste',
        state.accounts.find(account => account.id === entry.accountId)?.name ?? state.creditCards?.cards.find(card => card.id === entry.cardId)?.name ?? '',
        entry.category,
        entry.subcategory ?? '',
        entry.title,
        (signed(entry) / 100).toFixed(2).replace('.', ','),
        entry.note,
        entry.archived ? 'Arquivada' : 'Ativa',
      ])]
    const csv = '\uFEFF' + rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `granae-movimentacoes-${dateToday()}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    showToast('Seu histórico foi exportado!')
  }

  const analyze = async (goal: Goal) => {
    setAnalysisLoading(goal.id)
    try {
      const result = await api<Analysis>(`/goals/${goal.id}/difficulty`)
      setAnalysis(previous => ({ ...previous, [goal.id]: result }))
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setAnalysisLoading(null)
    }
  }

  if (checking) return <LoadingScreen />

  if (!state) return <Authentication onReady={() => boot(true)} sessionError={sessionError} />

  const firstName = state.user.name.split(' ')[0]
  const selected = nav.find(item => item.id === page)
    const searchTerm = query.trim().toLocaleLowerCase('pt-BR')
  const globalSearchResults = searchTerm ? [
    ...state.entries.filter(item => `${item.title} ${item.category} ${item.subcategory ?? ''} ${item.note}`.toLocaleLowerCase('pt-BR').includes(searchTerm)).slice(0, 4).map(item => ({ id: `entry-${item.id}`, title: item.title, detail: `${item.category} · ${currency(Math.abs(signed(item)))}`, destination: 'entries' as PageId, query: item.title })),
    ...(state.creditCards?.cards ?? []).filter(item => !item.archivedAt && item.name.toLocaleLowerCase('pt-BR').includes(searchTerm)).slice(0, 3).map(item => ({ id:`card-${item.id}`,title:item.name,detail:'Cartão de crédito',destination:'cards' as PageId,query:'' })),
    ...state.accounts.filter(item => `${item.name} ${item.type} ${item.description}`.toLocaleLowerCase('pt-BR').includes(searchTerm)).slice(0, 3).map(item => ({ id: `account-${item.id}`, title: item.name, detail: `Conta · ${currency(item.balanceCents)}`, destination: 'accounts' as PageId, query: '' })),
    ...state.goals.filter(item => item.title.toLocaleLowerCase('pt-BR').includes(searchTerm)).slice(0, 3).map(item => ({ id: `goal-${item.id}`, title: item.title, detail: item.kind === 'sonho' ? 'Sonho' : 'Meta', destination: 'goals' as PageId, query: '' })),
  ].slice(0, 7) : []
  const openSearchResult = (result: (typeof globalSearchResults)[number]) => {
    const entry = state.entries.find(item => `entry-${item.id}` === result.id)
    if (entry) setMonth(entry.date.slice(0, 7))
    setQuery(result.query)
    setEntryFilter('all')
    setGlobalSearchOpen(false)
    go(result.destination)
  }
  const monthPicker = <MonthPicker label={monthName(month)} onPrevious={() => chooseMonth(-1)} onNext={() => chooseMonth(1)} />
  const createDashboardEntry = () => {
    if (!state.accounts.length) {
      showToast('Crie uma conta antes de registrar movimentações.')
      go('accounts')
      return
    }
    setEditEntry(null)
    open('entry')
  }
  const pageProps = {
    state, go, open,
    editEntry: (entry: Entry | null) => setEditEntry(entry),
    editAccount: (account: Account | null) => setEditAccount(account),
    editAsset: (asset: Asset | null) => setEditAsset(asset),
    editGoal: (goal: Goal | null) => setEditGoal(goal),
    contributeTo: (goal: Goal | null) => setContributeGoal(goal),
    requestRemove: setPendingRemove,
    toast: showToast,
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button type="button" className="sidebar-brand-button" onClick={() => go('dashboard')}><Brand /></button>
        <p className="sidebar-tagline">Sua grana. Seu jogo.<br />Sua evolução.</p>
        <div className="sidebar-label">SEU ESPAÇO</div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {nav.map(item => (
            <button key={item.id} type="button" className={`nav-link ${page === item.id ? 'selected' : ''}`} aria-label={item.label} title={item.label} aria-current={page === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
              <item.icon size={18} strokeWidth={page === item.id ? 2.3 : 1.9} />
              {item.label}
              {item.id === 'goals' && state.goals.length > 0 && <span className="nav-badge">{state.goals.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-card">
          <span className="sidebar-card-icon"><Award size={18} /></span>
          <strong>Sua evolução começa aqui.</strong>
          <p>Sem pressa. Sem atalhos. Um passo de cada vez.</p>
          <button type="button" onClick={() => go('journey')}>Ver evolução <ArrowRight size={14} /></button>
        </div>
        <button type="button" className="sidebar-profile" onClick={() => { setProfileName(state.user.name); open('profile') }}>
          <span className="avatar">{firstName.slice(0, 1).toUpperCase()}</span>
          <span className="sidebar-profile-text"><strong>{state.user.name}</strong><small>Meu perfil</small></span>
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <button type="button" className="mobile-brand-button" onClick={() => go('dashboard')} aria-label="Ir para o início"><Brand /></button>
          {page === 'dashboard' ? (
            <div className="desktop-dashboard-greeting">
              <span className="desktop-dashboard-avatar" aria-hidden="true">{firstName.slice(0, 1).toUpperCase()}</span>
              <span className="desktop-dashboard-greeting-copy">
                <strong>Olá, {firstName}</strong>
                <small>Sua disciplina de hoje constrói seu futuro.</small>
              </span>
              {returnTo && (
                <button type="button" className="breadcrumb-return" onClick={goBack}>
                  <ArrowLeft size={15} />Voltar para {nav.find(item => item.id === returnTo)?.label}
                </button>
              )}
            </div>
          ) : (
            <nav className="topbar-location" aria-label="Caminho de navegação">
              <button type="button" className="breadcrumb-home" onClick={goHome}>Meu espaço</button>
              <ChevronRight className="breadcrumb-sep" size={15} />
              <strong className="breadcrumb-current" aria-current="page">{selected?.label}</strong>
            </nav>
          )}
          <div className="topbar-tools">
                        <div className={`global-search ${globalSearchOpen ? 'is-open' : ''}`}>
              <Search size={17} aria-hidden="true" />
              <input
                ref={globalSearchRef}
                type="search"
                placeholder="Buscar movimentações, contas, metas..."
                value={query}
                aria-label="Buscar movimentações, contas, cartões e metas"
                aria-expanded={globalSearchOpen && !!searchTerm}
                aria-controls="global-search-results"
                onFocus={() => setGlobalSearchOpen(true)}
                onBlur={() => setGlobalSearchOpen(false)}
                onChange={event => { setQuery(event.target.value); setGlobalSearchOpen(true) }}
                onKeyDown={event => {
                  if (event.key === 'Enter' && globalSearchResults[0]) openSearchResult(globalSearchResults[0])
                  if (event.key === 'Escape') { setGlobalSearchOpen(false); globalSearchRef.current?.blur() }
                }}
              />
              <kbd>Ctrl K</kbd>
              {globalSearchOpen && searchTerm && (
                <div className="global-search-results" id="global-search-results" role="listbox" aria-label="Resultados da busca">
                  {globalSearchResults.length ? globalSearchResults.map(result => (
                    <button key={result.id} type="button" role="option" aria-selected="false" onMouseDown={event => event.preventDefault()} onClick={() => openSearchResult(result)}>
                      <span className="global-search-result-icon"><Search size={14} /></span>
                      <span><strong>{result.title}</strong><small>{result.detail}</small></span>
                      <ArrowRight size={14} />
                    </button>
                  )) : <p className="global-search-empty">Nenhum resultado encontrado.</p>}
                </div>
              )}
            </div>
<span className="topbar-date">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <ThemeMenu mode={mode} onChange={changeTheme} />
            <button type="button" className="btn btn-outline btn-sm" onClick={downloadCSV} title="Exportar histórico em CSV">
              <Download size={15} /><span>Exportar</span>
            </button>
            <button type="button" className="avatar avatar-button" onClick={() => { setProfileName(state.user.name); open('profile') }} aria-label="Abrir perfil">
              {firstName.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        <div className="page-content">
          {page === 'dashboard' && <>
            <PageHeading
              className="dashboard-page-heading"
              eyebrow="VISÃO FINANCEIRA"
              title={`Visão geral de ${monthName(month)}`}
              description="Sua situação financeira, seus objetivos e sua evolução em uma única tela."
              action={<div className="dashboard-page-actions">{monthPicker}<Button onClick={createDashboardEntry}><Plus size={17} />Nova movimentação</Button></div>}
            />
            <DashboardPage {...pageProps} month={month} onUpdated={refresh}/>
          </>}

          {page === 'entries' && <>
            <PageHeading
              eyebrow="SEU HISTÓRICO"
              title="Movimentações"
              description="Receitas, despesas e ajustes organizados com clareza."
              action={<div className="entry-page-actions">{monthPicker}<CsvImport state={state} onUpdated={refresh}/><Button onClick={() => { if (!state.accounts.length) { showToast('Crie uma conta antes de registrar movimentações.'); return go('accounts') } setEditEntry(null); open('entry') }}><Plus size={18} />Nova movimentação</Button></div>}
            />
            <RecurringExpenses key={`recurring:${month}`} state={state} month={month} onUpdated={refresh}/>
            <EntriesPage {...pageProps} month={month} query={query} entryFilter={entryFilter} setQuery={setQuery} setEntryFilter={setEntryFilter} monthPicker={null} />
          </>}

          {page === 'accounts' && <>
            <PageHeading eyebrow="CONTAS FINANCEIRAS" title="Minhas contas" description="Cada conta no seu lugar. Seu saldo sempre claro." action={<Button onClick={() => { setEditAccount(null); open('account') }}><Plus size={18} />Adicionar conta</Button>} />
            <AccountsPage {...pageProps} />
          </>}

          {page === 'cards' && <>
            <PageHeading eyebrow="CRÉDITO ORGANIZADO" title="Cartões de crédito" description="Acompanhe compras, parcelas e pagamentos sem perder de vista suas contas." />
            <CreditCardsPage state={state} month={month} toast={showToast} onUpdated={async () => { await refresh(); setAnalysis({}) }} />
          </>}

          {page === 'wealth' && <>
            <PageHeading eyebrow="VISÃO PATRIMONIAL" title="Reserva & patrimônio" description="Dois indicadores diferentes para decisões mais conscientes." />
            <WealthPage {...pageProps} />
          </>}

          {page === 'goals' && <>
            <PageHeading eyebrow="PLANOS EM ANDAMENTO" title="Metas & Sonhos" description="Seu ritmo, seus objetivos. Sem mexer na reserva para realizá-los." action={<Button onClick={() => { setEditGoal(null); open('goal') }}><Plus size={18} />Novo objetivo</Button>} />
            <GoalsPage {...pageProps} analysis={analysis} analysisLoading={analysisLoading} analyze={analyze} />
          </>}

          {page === 'journey' && <>
            <PageHeading eyebrow="PROGRESSO REGISTRADO" title="Evolução" description="O jogo acompanha hábitos reais. Nunca incentiva gastos ou dívidas." />
            <JourneyPage {...pageProps} onUpdated={async()=>{await refresh();showToast(['Revisão registrada.',rewardNotice.current].filter(Boolean).join(' '))}}/>
          </>}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {nav.map(item => (
          <button key={item.id} type="button" className={`bottom-nav-item ${page === item.id ? 'selected' : ''}`} aria-current={page === item.id ? 'page' : undefined} onClick={() => go(item.id)}>
            <item.icon size={20} strokeWidth={page === item.id ? 2.3 : 1.9} />
            <span>{item.short}</span>
          </button>
        ))}
      </nav>

      {modal === 'entry' && (
        <Modal title={editEntry ? 'Editar movimentação' : 'Nova movimentação'} subtitle="Registre uma ação real. Seu saldo será atualizado automaticamente." onClose={() => setModal(null)}>
          <EntryForm
            initial={editEntry}
            accounts={state.accounts}
            categories={state.categories ?? []}
            subcategories={state.subcategories ?? []}
            error={formError}
            onSubmit={async body => execute(editEntry ? `/entries/${editEntry.id}` : '/entries', json(editEntry ? 'PATCH' : 'POST', body, !editEntry), editEntry ? 'Movimentação atualizada.' : 'Movimentação registrada.')}
          />
        </Modal>
      )}
      {modal === 'account' && (
        <Modal title={editAccount ? 'Editar conta' : 'Adicionar conta'} subtitle="Seus saldos organizados do seu jeito." onClose={() => setModal(null)}>
          <AccountForm initial={editAccount} error={formError} onSubmit={async body => execute(editAccount ? `/accounts/${editAccount.id}` : '/accounts', json(editAccount ? 'PATCH' : 'POST', body), editAccount ? 'Conta atualizada.' : 'Conta criada.')} />
        </Modal>
      )}
      {modal === 'asset' && (
        <Modal title={editAsset ? 'Editar item' : 'Adicionar bem ou dívida'} subtitle="Para um retrato mais completo do seu patrimônio." onClose={() => setModal(null)}>
          <AssetForm initial={editAsset} error={formError} onSubmit={async body => execute(editAsset ? `/assets/${editAsset.id}` : '/assets', json(editAsset ? 'PATCH' : 'POST', body), editAsset ? 'Item atualizado.' : 'Item adicionado.')} />
        </Modal>
      )}
      {modal === 'goal' && (
        <Modal title={editGoal ? 'Editar objetivo' : 'Novo objetivo'} subtitle="Escolha um sonho ou uma meta para acompanhar." onClose={() => setModal(null)}>
          <GoalForm initial={editGoal} error={formError} onSubmit={async body => execute(editGoal ? `/goals/${editGoal.id}` : '/goals', json(editGoal ? 'PATCH' : 'POST', body), editGoal ? 'Objetivo atualizado.' : 'Objetivo criado. Criar não gera recompensas.')} />
        </Modal>
      )}
      {modal === 'contribution' && contributeGoal && (
        <Modal title="Mais perto do seu objetivo" subtitle={`Registre quanto progrediu em “${contributeGoal.title}”.`} onClose={() => setModal(null)}>
          <ContributionForm
            goal={contributeGoal}
            error={formError}
            onSubmit={async body => {
              const done = await execute(`/goals/${contributeGoal.id}/contributions`, json('POST', body, true), 'Progresso registrado! Seus marcos foram atualizados.')
              if (done) setAnalysis(previous => { const next = { ...previous }; delete next[contributeGoal.id]; return next })
              return done
            }}
          />
        </Modal>
      )}
      {modal === 'profile' && (
        <Modal title="Meu perfil" subtitle="Cuide do seu espaço, da aparência e dos seus dados." onClose={() => setModal(null)} wide immersiveOnMobile>
          <PlayerSummary progress={state.progress} streak={state.stats.streak}/>
          <p>Classe financeira: <strong>{state.stats.financialClass ?? 'Aguardando sincronização'}</strong></p>
          <RewardHistory game={state.gamification}/>
          <form className="form" onSubmit={async event => { event.preventDefault(); await execute('/profile', json('PATCH', { name: profileName }), 'Nome atualizado.') }}>
            <label>Como podemos chamar você?
              <input required maxLength={50} value={profileName} onChange={event => setProfileName(event.target.value)} />
            </label>
            {formError && <InlineError>{formError}</InlineError>}
            <Button type="submit" wide><Check size={17} />Salvar nome</Button>
          </form>

          <div className="divider" />

          <CategoryManager
            categories={state.categories ?? []}
            subcategories={state.subcategories ?? []}
            onUpdated={async () => { await refresh(); showToast('Categorias atualizadas.') }}
          />

          <div className="divider" />

          <div className="field">
            <span className="field-label">Aparência do aplicativo</span>
            <span className="field-hint">A troca é imediata e a preferência fica salva na sua conta.</span>
            <ThemeSelector mode={mode} onChange={changeTheme} />
          </div>

          <div className="profile-links">
            <button type="button" onClick={downloadCSV}><Download size={17} />Exportar movimentações em CSV <ArrowRight size={16} /></button>
            <button
              type="button"
              className="danger"
              onClick={async () => { try { await api('/auth/logout', { method: 'POST' }) } finally { setSessionToken(null); setModal(null); setState(null) } }}
            >
              <LogOut size={17} />Sair da conta <ArrowRight size={16} />
            </button>
          </div>
          <p className="profile-privacy"><ShieldCheck size={16} />Seus dados são isolados por conta nesta instalação do Granaê. Não há conexão bancária.</p>
        </Modal>
      )}

      {pendingRemove && (
        <ConfirmDialog
          title={pendingRemove.title}
          description={pendingRemove.description}
          confirmLabel="Confirmar"
          onCancel={() => setPendingRemove(null)}
          onConfirm={async () => {
            const path = pendingRemove.path
            setPendingRemove(null)
            try {
              await api(path, { method: 'DELETE' })
              await refresh()
              setAnalysis({})
              showToast('Removido com segurança.')
            } catch (err) {
              showToast((err as Error).message, 'error')
            }
          }}
        />
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}


