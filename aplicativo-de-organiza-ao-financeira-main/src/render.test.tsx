import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { monthShift } from './data'
import type { State } from './data'
import { DEFAULT_THEME_MODE, THEME_STORAGE_KEY, applyResolvedTheme, isThemeMode, readStoredMode, resolveTheme, writeStoredMode } from './theme'
import type { ThemeMode } from './theme'
import { DashboardPage } from './pages/Dashboard'
import { EntriesPage } from './pages/Entries'
import { AccountsPage } from './pages/Accounts'
import { WealthPage } from './pages/Wealth'
import { GoalsPage } from './pages/Goals'
import { JourneyPage } from './pages/Journey'
import { ThemeSelector, ThemeMenu, Brand, MissionCard, ProgressRing } from './ui'
import { EntryForm } from './forms'

/* --------------------------------------------------------------------------
   Ambiente mínimo de navegador: storage, matchMedia e DOM suficientes para
   exercitar o sistema de temas e a renderização das páginas.
   -------------------------------------------------------------------------- */

const store = new Map<string, string>()
const listeners: ((event: { matches: boolean }) => void)[] = []
let systemDark = true

const g = globalThis as unknown as {
  localStorage: unknown; matchMedia: unknown; window: unknown; document: unknown
}
const matchMedia = (query: string) => ({
  matches: query.includes('dark') ? systemDark : false,
  media: query,
  addEventListener: (_: string, handler: (event: { matches: boolean }) => void) => listeners.push(handler),
  removeEventListener: (_: string, handler: (event: { matches: boolean }) => void) => {
    const index = listeners.indexOf(handler)
    if (index >= 0) listeners.splice(index, 1)
  },
  addListener: (handler: (event: { matches: boolean }) => void) => listeners.push(handler),
  removeListener: (handler: (event: { matches: boolean }) => void) => {
    const index = listeners.indexOf(handler)
    if (index >= 0) listeners.splice(index, 1)
  },
})
g.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value) },
  removeItem: (key: string) => { store.delete(key) },
}
g.matchMedia = matchMedia
g.window = { matchMedia }
const dataset: Record<string, string> = {}
const metaAttributes: Record<string, string> = { content: '#111116' }
g.document = {
  documentElement: { dataset, style: {} as Record<string, string> },
  querySelector: () => ({ setAttribute: (name: string, value: string) => { metaAttributes[name] = value } }),
}

const month = new Date().toISOString().slice(0, 7)
const previousMonth = new Date(Date.now() - 32 * 86400000).toISOString().slice(0, 7)
const day = (key: string, index: number) => `${key}-${String(index + 5).padStart(2, '0')}`

const state: State = {
  user: { id: 'u1', name: 'Ana Souza', email: 'ana@example.com' },
  accounts: [
    { id: 'a1', name: 'Conta dia a dia', type: 'corrente', openingCents: 150000, balanceCents: 626450, isReserve: false, description: 'Uso diário' },
    { id: 'a2', name: 'Reserva de emergência', type: 'poupança', openingCents: 300000, balanceCents: 300000, isReserve: true, description: '' },
  ],
  entries: [
    { id: 'e1', accountId: 'a1', title: 'Salário', category: 'Salário', type: 'income', amountCents: 520000, date: day(month, 0), note: '' },
    { id: 'e2', accountId: 'a1', title: 'Mercado', category: 'Alimentação', type: 'expense', amountCents: 43550, date: day(month, 1), note: '' },
    { id: 'e3', accountId: 'a1', title: 'Aluguel', category: 'Moradia', type: 'expense', amountCents: 180000, date: day(previousMonth, 0), note: '' },
  ],
  archivedEntries: [],
  assets: [
    { id: 's1', name: 'Carro', kind: 'asset', amountCents: 4500000, note: '' },
    { id: 's2', name: 'Financiamento', kind: 'liability', amountCents: 1200000, note: '' },
  ],
  goals: [{ id: 'g1', title: 'Viagem ao Japão', kind: 'sonho', targetCents: 1000000, savedCents: 250000, icon: '✈️', deadline: null, milestones: [10, 25] }],
  progress: { xp_total: 0, level: 1, graninha_balance: 12, nextLevelXp: null },
  preferences: { theme: 'dark' },
  stats: { reserveCents: 300000, netWorthCents: 4226450, streak: 3, financialClass: null },
}

const noop = () => {}
const pageProps = {
  state, go: noop, open: noop, editEntry: noop, editAccount: noop, editAsset: noop, editGoal: noop, contributeTo: noop,
  requestRemove: noop, toast: noop,
}

test('sem preferência salva o tema padrão é o escuro', () => {
  store.clear()
  assert.equal(DEFAULT_THEME_MODE, 'dark')
  assert.equal(readStoredMode(), 'dark')
  store.set(THEME_STORAGE_KEY, 'neon')
  assert.equal(readStoredMode(), 'dark', 'valor inválido no storage cai no padrão')
})

test('modo automático acompanha o dispositivo e os modos explícitos não', () => {
  systemDark = true
  assert.equal(resolveTheme('system'), 'dark')
  systemDark = false
  assert.equal(resolveTheme('system'), 'light')
  assert.equal(resolveTheme('dark'), 'dark')
  assert.equal(resolveTheme('light'), 'light')
  assert.ok(isThemeMode('system') && isThemeMode('dark') && isThemeMode('light'))
  assert.equal(isThemeMode('neon'), false)
})

test('preferência é gravada e o tema resolvido é aplicado no documento', () => {
  writeStoredMode('light')
  assert.equal(store.get(THEME_STORAGE_KEY), 'light')
  assert.equal(readStoredMode(), 'light')
  applyResolvedTheme('light')
  assert.equal(dataset.theme, 'light')
  assert.equal(metaAttributes.content, '#F4F7FC')
  applyResolvedTheme('dark')
  assert.equal(dataset.theme, 'dark')
  assert.equal(metaAttributes.content, '#111116')
})

test('dashboard renderiza saldo, nível, Graninha, sequência e os totais do mês', () => {
  const html = renderToStaticMarkup(<DashboardPage {...pageProps} month={month} />)
  assert.match(html, /Olá, Ana/)
  assert.match(html, /R\$\s9\.264,50/)          // saldo total das contas
  assert.match(html, /R\$\s5\.200,00/)          // receitas do mês
  assert.match(html, /R\$\s435,50/)             // despesas do mês
  assert.match(html, /R\$\s3\.000,00/)          // reserva
  assert.match(html, /R\$\s42\.264,50/)        // patrimônio (contas + bens − dívidas)
  assert.match(html, /12 Graninha/)
  assert.match(html, /3 dias/)
  assert.match(html, /A definir/)              // classe financeira não é inventada
  assert.match(html, /curva oficial de XP ainda não está configurada/i)
  // O aluguel é do mês anterior: entra em "recentes", mas não nos totais do mês.
  assert.match(html, /-76% vs /)
})

test('dashboard mostra estado vazio em vez de dados fictícios', () => {
  const empty: State = {
    ...state, accounts: [], entries: [], archivedEntries: [], assets: [], goals: [],
    progress: { xp_total: 0, level: 1, graninha_balance: 0, nextLevelXp: null },
    stats: { reserveCents: 0, netWorthCents: 0, streak: 0, financialClass: null },
  }
  const html = renderToStaticMarkup(<DashboardPage {...pageProps} state={empty} month={month} />)
  assert.match(html, /Sua evolução começa agora/)
  assert.match(html, /Seu histórico começa aqui/)
  assert.match(html, /Qual é o próximo sonho\?/)
})

test('gráfico inclui categorias pessoais e históricas e soma somente gastos do mês', () => {
  const entry = state.entries[1]
  const chartState: State = { ...state, categories: [], entries: [
    { ...entry, id: 'p1', category: 'Pets', amountCents: 5000 },
    { ...entry, id: 'p2', category: 'Pets', amountCents: 10000 },
    { ...entry, id: 'h1', category: 'Categoria antiga', amountCents: 5000 },
    { ...entry, id: 'a1', category: 'Alimentação', amountCents: 10000 },
    { ...entry, id: 'outside', category: 'Fora do mês', date: day(monthShift(month, -1), 0), amountCents: 90000 },
    { ...entry, id: 'income', category: 'Receita excluída', type: 'income', amountCents: 90000 },
    { ...entry, id: 'adjustment', category: 'Ajuste excluído', type: 'adjustment', amountCents: 90000 },
  ] }
  const html = renderToStaticMarkup(<DashboardPage {...pageProps} state={chartState} month={month} />)
  const chart = html.slice(html.indexOf('Para onde foi sua grana?')).split('</section>')[0]
  assert.match(chart, /Pets R\$\s150,00 50%/)
  assert.match(chart, /Alimentação R\$\s100,00 33%/)
  assert.match(chart, /Categoria antiga R\$\s50,00 17%/)
  assert.match(chart, /R\$\s300,00/)
  assert.match(chart, /<title>Pets: R\$\s150,00 \(50%\)<\/title>/)
  assert.doesNotMatch(chart, /Fora do mês|Receita excluída|Ajuste excluído/)
  assert.equal(chart.match(/class="category-row"/g)?.length, 3)
})

test('legenda do gráfico mostra todas as categorias, inclusive além das cinco maiores', () => {
  const names = ['Pets', 'Assinaturas', 'Presentes', 'Viagens', 'Taxas', 'Doações', 'Hobbies']
  const chartState: State = { ...state, entries: names.map((category, index) => ({
    ...state.entries[1], id: `custom-${index}`, category, amountCents: 1000,
  })) }
  const html = renderToStaticMarkup(<DashboardPage {...pageProps} state={chartState} month={month} />)
  const chart = html.slice(html.indexOf('Para onde foi sua grana?')).split('</section>')[0]
  assert.equal(chart.match(/class="category-row"/g)?.length, names.length)
  for (const name of names) assert.ok(chart.includes(`<strong>${name}</strong>`))
  assert.match(chart, /R\$\s70,00/)
})

test('gráfico não cria fatias quando há somente receitas e ajustes', () => {
  const chartState: State = { ...state, entries: state.entries.filter(entry => entry.type !== 'expense') }
  const html = renderToStaticMarkup(<DashboardPage {...pageProps} state={chartState} month={month} />)
  const chart = html.slice(html.indexOf('Para onde foi sua grana?')).split('</section>')[0]
  assert.match(chart, /Tudo tranquilo por aqui/)
  assert.doesNotMatch(chart, /class="donut"/)
})

test('páginas financeiras renderizam com dados reais', () => {
  const entries = renderToStaticMarkup(<EntriesPage {...pageProps} month={month} query="" entryFilter="all" setQuery={noop} setEntryFilter={noop} monthPicker={<span>outubro</span>} />)
  assert.match(entries, /Mercado/)
  assert.match(entries, /2 movimentações encontradas/)
  assert.equal(entries.match(/class="entry-day-group"/g)?.length, 2, 'histórico agrupado visualmente por data')

  const accounts = renderToStaticMarkup(<AccountsPage {...pageProps} />)
  assert.match(accounts, /Conta dia a dia/)
  assert.match(accounts, /Participa da reserva/)

  const wealth = renderToStaticMarkup(<WealthPage {...pageProps} />)
  assert.match(wealth, /RESERVA FINANCEIRA/)
  assert.match(wealth, /Financiamento/)
  assert.match(wealth, /−\s*R\$\s12\.000,00|−R\$\s12\.000,00/)

  const goals = renderToStaticMarkup(<GoalsPage {...pageProps} analysis={{}} analysisLoading={null} analyze={noop} />)
  assert.match(goals, /Viagem ao Japão/)
  assert.match(goals, /25% concluído/)
  assert.match(goals, /Faltam R\$\s7\.500,00/)

  const journey = renderToStaticMarkup(<JourneyPage {...pageProps} />)
  assert.match(journey, /Nível 1/)
  assert.match(journey, /25% de Viagem ao Japão/)
})

test('seletores de tema marcam a opção ativa e listam os três modos', () => {
  const selector = renderToStaticMarkup(<ThemeSelector mode="light" onChange={noop} />)
  assert.match(selector, /Escuro — Roxo/)
  assert.match(selector, /Claro — Azul/)
  assert.match(selector, /Automático/)
  assert.equal(selector.match(/aria-checked="true"/g)?.length, 1, 'apenas uma opção marcada como ativa')
  assert.match(selector, /Agora: claro/)

  const menu = renderToStaticMarkup(<ThemeMenu mode="system" onChange={noop} />)
  assert.doesNotMatch(menu, /aria-checked="true"/, 'menu fechado não expõe opções')
  assert.match(renderToStaticMarkup(<Brand />), /grana/)
})

test('componentes de progresso e missão são reutilizáveis e acessíveis sem embutir recompensas', () => {
  const ring = renderToStaticMarkup(<ProgressRing value={140} label="Progresso da meta"><span aria-hidden="true">100%</span></ProgressRing>)
  assert.match(ring, /role="progressbar"/)
  assert.match(ring, /aria-valuenow="100"/)
  assert.match(ring, /aria-label="Progresso da meta"/)

  const mission = renderToStaticMarkup(<MissionCard title="Missão fornecida pelo produto" description="A descrição vem dos dados da aplicação." progress={60} status="Ativa" />)
  assert.match(mission, /Missão fornecida pelo produto/)
  assert.match(mission, /aria-label="Progresso da missão: Missão fornecida pelo produto"/)
  assert.doesNotMatch(mission, /Graninha|XP|R\$/)
})

test('todas as opções de tema são aceitas pelo tipo compartilhado', () => {
  const modes: ThemeMode[] = ['dark', 'light', 'system']
  assert.deepEqual(modes.map(resolveTheme).every(value => value === 'dark' || value === 'light'), true)
})

test('EntryForm uses the personal catalog and keeps historical labels visible', () => {
  const categories = [
    { id: 'food', name: 'Alimentação', type: 'expense' as const, archivedAt: null },
    { id: 'pet', name: 'Pets', type: 'expense' as const, archivedAt: null },
  ]
  const subcategories = [
    { id: 'bakery', categoryId: 'pet', name: 'Veterinário', archivedAt: null },
  ]
  const html = renderToStaticMarkup(
    <EntryForm
      initial={{ id: 'old', accountId: 'account', title: 'Consulta', category: 'Veterinário antigo', subcategory: 'Clínica antiga', type: 'expense', amountCents: 2500, date: '2026-01-10', note: '' }}
      accounts={[{ id: 'account', name: 'Conta', type: 'corrente', openingCents: 0, balanceCents: 0, isReserve: false, description: '' }]}
      categories={categories}
      subcategories={subcategories}
      onSubmit={async () => true}
      error=""
    />,
  )
  assert.match(html, /Pets/)
  assert.match(html, /Veterinário/)
  assert.match(html, /Veterinário antigo \(histórica\)/)
  assert.match(html, /Clínica antiga \(histórica\)/)
})
