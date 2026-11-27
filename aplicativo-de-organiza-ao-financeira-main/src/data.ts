import { cardCashPayments, cardExpenseEntries, cardOutstanding, emptyCardState } from './creditCards'
import type { CardState } from './creditCards'
import type { ThemeMode } from './theme'
import {parseRecoveryRedirect,recoveryRequest,recoveryUpdate} from './recovery'

export type Account = { id: string; name: string; type: 'corrente' | 'poupança' | 'dinheiro' | 'investimento' | 'outro'; openingCents: number; balanceCents: number; isReserve: boolean; description: string }
export type Entry = { id: string; accountId: string; cardId?: string; cardPaymentId?: string; settled?: boolean; title: string; category: string; subcategory?: string; type: 'income' | 'expense' | 'adjustment'; amountCents: number; date: string; note: string }
export type UserCategory = { id: string; name: string; type: Entry['type']; archivedAt: string | null }
export type UserSubcategory = { id: string; categoryId: string; name: string; archivedAt: string | null }
export type Asset = { id: string; name: string; kind: 'asset' | 'liability'; amountCents: number; note: string; installmentCount?: number | null; firstDueDate?: string | null }
export type Goal = { id: string; title: string; kind: 'meta' | 'sonho'; targetCents: number; savedCents: number; icon: string; deadline: string | null; milestones: number[] }
/** `nextLevelXp` é `null` enquanto a curva oficial de XP não estiver configurada no servidor. */
export type Progress = { xp_total: number; level: number; graninha_balance: number; nextLevelXp: number | null; currentLevelXp?: number | null; curveVersion?: string | null }
export type Reward = { id: string; event_id: string; reward_type: string; amount: number; reason_code: string; config_version: string; created_at: string; metadata: { kind?: string; milestone?: string }; adjustment_of?: string | null }
export type Gamification = { progress: Progress; streak: number; rewards: Reward[]; milestones: { goal_id: string; title: string; milestone: number; created_at: string }[]; behaviors: { code: string; kind: string; period_start: string }[]; streakMilestones: { milestone: number; cycle_start: string }[]; configVersion: string | null; pending: number; awaitingConfig: number; awaitingDifficulty?: number; unavailable?: boolean }
export type FinancialClass = { name: string; reserveCents: number; version: string; history: {id:string;class_code:string;reserve_cents:number;created_at:string}[] }
export type Mission = {code:string;name:string;difficulty:string;description:string;days:number;reviews:number;requiredDays:number;requiredReviews:number;start:string;end:string;xp:number;graninha:number;period:string;status:'available'|'in_progress'|'completed'|'expired';configVersion:string}
export type Missions = {current:Mission[];previous:Mission[];timezone:string}
export type State = { missions?: Missions; financialClass?: FinancialClass; gamification?: Gamification; creditCards?: CardState; creditCardsEnabled?: boolean; user: { id: string; name: string; email: string }; accounts: Account[]; entries: Entry[]; archivedEntries: (Entry & { archivedAt: string })[]; categories?: UserCategory[]; subcategories?: UserSubcategory[]; assets: Asset[]; goals: Goal[]; progress: Progress; preferences: { theme: ThemeMode | null }; avatar?: { skin: number; hairColor: number; available: boolean }; cosmetics?: CosmeticsState; stats: { reserveCents: number; netWorthCents: number; streak: number; financialClass: string | null } }
export type CosmeticsState = { available: boolean; shopOpen: boolean; active: string[]; owned: string[]; equipped: Record<string, string>; spent: number }
export type Analysis = { status: 'insufficient' | 'expired' | 'ready'; difficulty?: string; confidence: 'baixa' | 'alta'; monthsRecorded: number; remainingCents?: number; capacityCents?: number; estimatedMonths?: number; needMonthlyCents?: number; monthsLeft?: number; effortIndex?: number; formulaVersion: string }

/** `token` aponta para os pares `--cat-*` definidos em `styles/tokens.css`, um por tema. */
export const categories = [
  { name: 'Alimentação', emoji: '🥑', token: 'alimentacao' }, { name: 'Moradia', emoji: '🏠', token: 'moradia' },
  { name: 'Transporte', emoji: '🚗', token: 'transporte' }, { name: 'Compras', emoji: '🛍️', token: 'compras' },
  { name: 'Saúde', emoji: '💊', token: 'saude' }, { name: 'Lazer', emoji: '🎮', token: 'lazer' },
  { name: 'Educação', emoji: '📚', token: 'educacao' }, { name: 'Outros', emoji: '✨', token: 'outros' },
]
/** Cores resolvidas pelo tema ativo — nunca valores fixos. */
export const categoryColor = (name: string) => {
  const hash = Array.from(name).reduce((value, char) => (value * 31 + char.codePointAt(0)!) >>> 0, 0)
  const token = categories.find(category => category.name === name)?.token ?? categories[hash % categories.length].token
  return { color: `var(--cat-${token})`, soft: `var(--cat-${token}-soft)` }
}
export const incomeCategories = ['Salário', 'Freelance', 'Investimentos', 'Presente', 'Outros']
export const goalIcons = ['🎯', '✈️', '🏠', '🎓', '🚗', '💻', '🌴', '🛟', '🎁', '✨']
export const currency = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
export const compact = (cents: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100)
export const dateToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
export const monthName = (month: string) => new Date(`${month}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
export const displayDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
export const percent = (saved: number, target: number) => target ? Math.max(0, Math.min(100, Math.round(saved / target * 100))) : 0
export const toCents = (value: string) => Math.round(Number(value) * 100)
export const inputMoney = (cents: number) => (cents / 100).toFixed(2)
export function signed(entry: Entry) { return entry.type === 'expense' ? -entry.amountCents : entry.amountCents }
export function monthShift(month: string, offset: number) { const [year, m] = month.split('-').map(Number); const d = new Date(year, m - 1 + offset, 15); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); this.name = 'ApiError' }
}

const SESSION_KEY = 'granae:supabase-session'
let sessionToken: string | null = null
let refreshToken: string | null = null
try { sessionToken = sessionStorage.getItem(SESSION_KEY); refreshToken = sessionStorage.getItem('granae:supabase-refresh') } catch { /* Storage may be unavailable in embedded previews. */ }

const env = (import.meta as ImportMeta & { env?: ImportMetaEnv & { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string } }).env ?? {}
const projectUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY
let recoveryToken:string|null=null
let initialRecovery:'update'|'invalid'|null|undefined
export function initializeRecovery(force=false) {
  if(initialRecovery!==undefined&&!force)return initialRecovery
  if(typeof window==='undefined')return null
  if(force&&window.location.hash==='#/recuperar-senha'&&recoveryToken)return 'update'
  const redirect=parseRecoveryRedirect(window.location.hash)
  recoveryToken=null
  initialRecovery=redirect.kind==='none'?null:redirect.kind
  if(redirect.kind!=='none') {
    if(redirect.kind==='update')recoveryToken=redirect.accessToken
    window.history.replaceState(null,'',window.location.pathname+'#/recuperar-senha')
  }
  return initialRecovery
}
export async function requestPasswordRecovery(email:string) {
  ensureConfig()
  await recoveryRequest({url:projectUrl!,key:publishableKey!},email)
}
export async function updateRecoveredPassword(password:string) {
  ensureConfig()
  if(!recoveryToken)throw Object.assign(new Error('Solicite um novo link de recuperação.'),{expired:true})
  await recoveryUpdate({url:projectUrl!,key:publishableKey!},recoveryToken,password)
  recoveryToken=null;initialRecovery=null;setSessionToken(null)
}
export function leaveRecovery() {
  recoveryToken=null;initialRecovery=null
  window.history.replaceState(null,'',window.location.pathname+'#/visao-geral')
}

function ensureConfig() {
  if (!projectUrl || !publishableKey) throw new ApiError('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY antes de iniciar o app.', 500)
}
export function setSessionToken(token: string | null) {
  sessionToken = token
  if (!token) refreshToken = null
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token)
    else { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem('granae:supabase-refresh') }
  } catch { /* The in-memory token still keeps this tab signed in. */ }
}
function saveAuthSession(session: any) {
  setSessionToken(session.access_token)
  refreshToken = session.refresh_token ?? refreshToken
  try { if (refreshToken) sessionStorage.setItem('granae:supabase-refresh', refreshToken) } catch { /* Keep the current in-memory session. */ }
}
let refreshInFlight: Promise<boolean> | null = null
async function renewSession() {
  if (!refreshToken) return false
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const session = await authRequest('token?grant_type=refresh_token', { refresh_token: refreshToken })
        saveAuthSession(session)
        return true
      } catch { setSessionToken(null); return false }
      finally { refreshInFlight = null }
    })()
  }
  return refreshInFlight
}
const currentDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
function headers(authenticated = true, extra: HeadersInit = {}) {
  ensureConfig()
  const bearer = authenticated && sessionToken ? sessionToken : publishableKey!
  return { apikey: publishableKey!, Authorization: `Bearer ${bearer}`, ...extra }
}
async function readResponse(response: Response) {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || 'Não foi possível completar esta operação.'
    const status = response.status
    const code = payload?.code || payload?.error_code
    if (code === '23503') throw new ApiError('Este registro está vinculado a outros dados e não pode ser removido.', 409, code)
    if (code === '23514') throw new ApiError(message, 400, code)
    throw new ApiError(message, status, code)
  }
  return payload
}
async function authRequest(path: string, body?: unknown, authenticated = false) {
  const makeRequest = () => fetch(`${projectUrl}/auth/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: headers(authenticated, body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  let response = await makeRequest()
  if (response.status === 401 && authenticated && await renewSession()) response = await makeRequest()
  return readResponse(response)
}
async function rest<T = any>(table: string, method = 'GET', query = '', body?: unknown, opts: { token?: string; prefer?: string } = {}): Promise<T> {
  ensureConfig()
  const token = opts.token ?? sessionToken
  if (!token) throw new ApiError('Sessão encerrada. Entre novamente.', 401, 'SESSION_MISSING')
  const makeRequest = () => fetch(`${projectUrl}/rest/v1/${table}${query ? `?${query}` : ''}`, {
    method,
    headers: headers(true, {
      Authorization: `Bearer ${sessionToken ?? token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(opts.prefer || (body !== undefined && method !== 'DELETE') ? { Prefer: opts.prefer ?? 'return=representation' } : {}),
    }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  let response = await makeRequest()
  if (response.status === 401 && await renewSession()) response = await makeRequest()
  return await readResponse(response) as T
}
/** Lê o `sub` do JWT sem validá-lo: serve só para preencher `user_id`; o RLS valida o token em cada requisição. */
export function userIdFromToken(token: string | null): string | null {
  try {
    const payload = token?.split('.')[1]
    if (!payload) return null
    const sub = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='))).sub
    return typeof sub === 'string' && sub ? sub : null
  } catch { return null }
}
/** Evita uma ida ao servidor (`/auth/v1/user`) em cada gravação. */
async function currentUserId(): Promise<string> {
  return userIdFromToken(sessionToken) ?? (await authRequest('user', undefined, true)).id
}
const query = (values: Record<string, string>) => new URLSearchParams(values).toString()
/** Limite padrão de linhas por resposta da Data API do Supabase (`max_rows`). */
export const PAGE_SIZE = 1000
/** Lê todas as páginas: sem isso, listas acima de `PAGE_SIZE` seriam truncadas em silêncio e os saldos ficariam errados. */
export async function fetchAllPages<T>(fetchPage: (offset: number, limit: number) => Promise<T[]>, pageSize = PAGE_SIZE): Promise<T[]> {
  const all: T[] = []
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchPage(offset, pageSize)
    all.push(...page)
    if (page.length < pageSize) return all
  }
}
/** `order` precisa terminar em uma coluna única para que as páginas não se sobreponham. */
const restAll = <T = any>(table: string, values: Record<string, string>) =>
  fetchAllPages<T>((offset, limit) => rest<T[]>(table, 'GET', query({ ...values, limit: String(limit), offset: String(offset) })))
const rows = <T>(value: unknown) => value as T[]
const one = <T>(value: unknown) => (value as T[])[0]
export function netStats(accounts: any[], entries: any[], assets: any[], cards: CardState = emptyCardState()) {
  const balances = accounts.map(a => ({
    ...a,
    balanceCents: Number(a.opening_cents) - cardCashPayments(cards, a.id) + entries.filter(e => e.account_id === a.id)
      .reduce((sum, e) => sum + (e.type === 'expense' ? -Number(e.amount_cents) : Number(e.amount_cents)), 0),
  }))
  const reserveCents = balances.filter(a => a.is_reserve).reduce((sum, a) => sum + Math.max(0, a.balanceCents), 0)
  const netWorthCents = balances.reduce((sum, a) => sum + a.balanceCents, 0) +
    assets.reduce((sum, a) => sum + (a.kind === 'asset' ? Number(a.amount_cents) : -Number(a.amount_cents)), 0) - cardOutstanding(cards)
  const dates = new Set(entries.map(e => String(e.date)))
  const cursor = new Date(`${currentDate()}T12:00:00Z`)
  if (!dates.has(cursor.toISOString().slice(0,10))) cursor.setUTCDate(cursor.getUTCDate()-1)
  let streak = 0
  while (dates.has(cursor.toISOString().slice(0,10))) { streak++; cursor.setUTCDate(cursor.getUTCDate()-1) }
  return { balances, reserveCents, netWorthCents, streak }
}
async function loadCreditCards(): Promise<{ state: CardState; enabled: boolean }> {
  try {
    const data = await rest<any>('rpc/credit_card_state', 'POST', '', {})
    return { enabled: true, state: {
      cards: data.cards.map((c: any) => ({ id:c.id,name:c.name,lastFour:c.last_four,limitCents:Number(c.limit_cents),closingDay:c.closing_day,dueDay:c.due_day,archivedAt:c.archived_at })),
      purchases: data.purchases.map((p: any) => ({ id:p.id,cardId:p.card_id,title:p.title,category:p.category,subcategory:p.subcategory,amountCents:Number(p.amount_cents),interestCents:Number(p.interest_cents ?? 0),date:p.purchase_date,installments:p.installment_count,note:p.note })),
      installments: data.installments.map((i: any) => ({ id:i.id,purchaseId:i.purchase_id,cardId:i.card_id,number:i.installment_number,amountCents:Number(i.amount_cents),dueDate:i.due_date,billMonth:i.bill_month.slice(0,7) })),
      payments: data.payments.map((p: any) => ({ id:p.id,cardId:p.card_id,accountId:p.account_id,billMonth:p.bill_month.slice(0,7),amountCents:Number(p.amount_cents),date:p.payment_date,note:p.note })),
    } }
  } catch (error) {
    // Permite publicar a interface antes da migration sem interromper o aplicativo existente.
    if (error instanceof ApiError && error.code === 'PGRST202') return { state: emptyCardState(), enabled: false }
    throw error
  }
}
/** Falhas de leitura da gamificação nunca bloqueiam as finanças; a próxima sincronização tenta de novo. */
const optional = <T>(promise: Promise<T>) => promise.catch(() => undefined)
async function getGameState() {
  // Transação independente: falhas de recompensas nunca desfazem a operação financeira.
  // Precisa terminar antes das leituras abaixo, que refletem as recompensas processadas.
  await optional(rest('rpc/process_my_rewards','POST','',{}))
  const [financialClass, gamification, missions] = await Promise.all([
    optional(rest<FinancialClass>('rpc/financial_class_state','POST','',{})),
    optional(rest<Gamification>('rpc/gamification_state','POST','',{})),
    optional(rest<Missions>('rpc/missions_state','POST','',{})),
  ])
  return { financialClass, gamification, missions }
}
async function getState(): Promise<State> {
  // Os dados financeiros não dependem das recompensas: as duas leituras correm em paralelo.
  const game = getGameState()
  // Leitura separada e opcional: se as colunas de aparência ainda não existirem (migration e deploy
  // não têm ordem garantida), o app carrega normalmente com a aparência padrão.
  const appearance = rest('user_preferences','GET',query({select:'avatar_skin,avatar_hair_color'}))
    .then(rows => { const row = one<any>(rows); return { skin:Number(row?.avatar_skin ?? 1), hairColor:Number(row?.avatar_hair_color ?? 0), available:true } })
    .catch(() => ({ skin:1, hairColor:0, available:false }))
  // A Lojinha também é opcional: sem as funções no banco, o Perfil mostra a vitrine fechada.
  const cosmeticsRead: Promise<CosmeticsState> = rest<any>('rpc/cosmetics_state','POST','',{})
    .then(data => ({ available:true, shopOpen:!!data?.shopOpen, active:data?.active ?? [], owned:data?.owned ?? [], equipped:data?.equipped ?? {}, spent:Number(data?.spent ?? 0) }))
    .catch(() => ({ available:false, shopOpen:false, active:[], owned:[], equipped:{}, spent:0 }))
  const [user, profiles, accounts, entries, archived, categories, subcategories, assets, goals, contributions, milestones, progress, preferences, creditCards] = await Promise.all([
    authRequest('user', undefined, true),
    rest('profiles','GET',query({select:'id,name'})),
    restAll('accounts',{select:'*',order:'created_at.asc,id.asc'}),
    restAll('entries',{select:'*',archived_at:'is.null',order:'date.desc,created_at.desc,id.desc'}),
    restAll('entries',{select:'*',archived_at:'not.is.null',order:'date.desc,created_at.desc,id.desc'}),
    restAll('categories',{select:'*',order:'type.asc,name.asc,id.asc'}),
    restAll('subcategories',{select:'*',order:'name.asc,id.asc'}),
    restAll('assets',{select:'*',order:'name.asc,id.asc'}),
    restAll('goals',{select:'*',archived_at:'is.null',order:'created_at.desc,id.desc'}),
    restAll('contributions',{select:'id,goal_id,amount_cents,date',order:'date.desc,id.desc'}),
    restAll('milestone_claims',{select:'id,goal_id,milestone',order:'id.asc'}),
    rest('player_progress','GET',query({select:'xp_total,level,graninha_balance'})),
    rest('user_preferences','GET',query({select:'theme'})),
    loadCreditCards(),
  ])
  const { financialClass, gamification, missions } = await game
  const avatar = await appearance
  const cosmetics = await cosmeticsRead
  const profile = one<any>(profiles) ?? {}
  const accountRows = rows<any>(accounts), entryRows = rows<any>(entries), assetRows = rows<any>(assets)
  const stats = netStats(accountRows, entryRows, assetRows, creditCards.state)
  const contributionsByGoal = rows<any>(contributions), milestoneRows = rows<any>(milestones)
  const progressRow = one<any>(progress) ?? {}
  return {
    gamification, financialClass, missions,
    creditCards: creditCards.state, creditCardsEnabled: creditCards.enabled,
    user: { id: user.id, name: profile.name || user.user_metadata?.name || '', email: user.email || '' },
    accounts: accountRows.map(a => ({ id:a.id,name:a.name,type:a.type,openingCents:Number(a.opening_cents),isReserve:a.is_reserve,description:a.description,balanceCents:stats.balances.find(b=>b.id===a.id)?.balanceCents ?? 0 })),
    entries: [
      ...entryRows.map(e => ({ id:e.id,accountId:e.account_id,title:e.title,category:e.category,subcategory:e.subcategory ?? '',type:e.type,amountCents:Number(e.amount_cents),date:e.date,note:e.note })),
      ...cardExpenseEntries(creditCards.state),
      ...creditCards.state.payments.map(p => ({ id:`card-payment:${p.id}`,accountId:p.accountId,cardPaymentId:p.id,title:`Pagamento de fatura · ${creditCards.state.cards.find(c=>c.id===p.cardId)?.name ?? 'Cartão'}`,category:'Pagamento de fatura',type:'adjustment' as const,amountCents:-p.amountCents,date:p.date,note:p.note })),
    ].sort((a,b)=>b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
    categories: rows<any>(categories).map(c => ({ id:c.id,name:c.name,type:c.type,archivedAt:c.archived_at })),
    subcategories: rows<any>(subcategories).map(c => ({ id:c.id,categoryId:c.category_id,name:c.name,archivedAt:c.archived_at })),
    archivedEntries: rows<any>(archived).map(e => ({ id:e.id,accountId:e.account_id,title:e.title,category:e.category,subcategory:e.subcategory ?? '',type:e.type,amountCents:Number(e.amount_cents),date:e.date,note:e.note,archivedAt:e.archived_at })),
    assets: assetRows.map(a => ({ id:a.id,name:a.name,kind:a.kind,amountCents:Number(a.amount_cents),note:a.note,installmentCount:a.installment_count ?? null,firstDueDate:a.first_due_date ?? null })),
    goals: rows<any>(goals).map(g => ({ id:g.id,title:g.title,kind:g.kind,targetCents:Number(g.target_cents),icon:g.icon,deadline:g.deadline,savedCents:contributionsByGoal.filter(c=>c.goal_id===g.id).reduce((sum,c)=>sum+Number(c.amount_cents),0),milestones:milestoneRows.filter(m=>m.goal_id===g.id).map(m=>Number(m.milestone)) })),
    progress: gamification?.progress ?? { xp_total:Number(progressRow.xp_total ?? 0),level:Number(progressRow.level ?? 1),graninha_balance:Number(progressRow.graninha_balance ?? 0),nextLevelXp:null },
    preferences: { theme:(one<any>(preferences)?.theme ?? null) as ThemeMode | null },
    avatar, cosmetics,
    stats: { reserveCents:stats.reserveCents,netWorthCents:stats.netWorthCents,streak:gamification?.streak ?? 0,financialClass:financialClass?.name ?? null },
  }
}
function parseBody(options: RequestInit) {
  if (typeof options.body !== 'string') return {}
  try { return JSON.parse(options.body) as Record<string, any> } catch { return {} }
}
const idempotencyKey = (options: RequestInit) => new Headers(options.headers).get('Idempotency-Key') || crypto.randomUUID()
async function difficulty(goalId: string): Promise<Analysis> {
  return rest<Analysis>('rpc/assess_dream','POST','',{p_goal_id:goalId})
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  ensureConfig()
  const method=(options.method||'GET').toUpperCase(), body=parseBody(options)
  if(path==='/imports/csv' && method==='POST') return await rest('rpc/import_csv','POST','',{p_destination:body.destination,p_destination_id:body.destinationId,p_rows:body.rows,p_commit:body.commit,p_first_month:body.firstMonth?`${body.firstMonth}-01`:null}) as T
  if (path==='/auth/register') {
    const data=await authRequest('signup',{email:body.email,password:body.password,data:{name:body.name}})
    if (!data.session?.access_token) throw new ApiError('Conta criada. Confirme seu e-mail e depois entre no Granaê.',401,'EMAIL_CONFIRMATION_REQUIRED')
    saveAuthSession(data.session)
    return {ok:true,sessionToken:data.session.access_token} as T
  }
  if (path==='/auth/login') {
    const data=await authRequest('token?grant_type=password',{email:body.email,password:body.password})
    if (!data.access_token) throw new ApiError('Não foi possível iniciar sua sessão.',401)
    saveAuthSession(data)
    return {ok:true,sessionToken:data.access_token} as T
  }
  if (path==='/auth/logout') {
    if (sessionToken) await authRequest('logout',{},true).catch(()=>undefined)
    setSessionToken(null)
    return {ok:true} as T
  }
  if (!sessionToken) throw new ApiError('Sessão encerrada. Entre novamente.',401,'SESSION_MISSING')
  if (path==='/state' && method==='GET') return await getState() as T
  if (path.startsWith('/recurring?') && method==='GET') {
    const month=new URLSearchParams(path.split('?')[1]).get('month')
    if (!month || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError('Mês inválido.',400)
    return await rest('rpc/recurring_expense_state','POST','',{p_month:`${month}-01`}) as T
  }
  if (path==='/recurring' && method==='POST') return await rest('rpc/create_recurring_expense','POST','',{p_title:body.title,p_category:body.category,p_amount_cents:body.amountCents,p_due_day:body.dueDay,p_start_month:`${body.startMonth}-01`,p_key:idempotencyKey(options)}) as T
  const recurringAction=path.match(/^\/recurring\/([^/]+)\/(pay|reverse|stop)$/)
  if (recurringAction && method==='POST') {
    const p_id=decodeURIComponent(recurringAction[1])
    if(recurringAction[2]==='stop') return await rest('rpc/stop_recurring_expense','POST','',{p_id}) as T
    if(recurringAction[2]==='reverse') return await rest('rpc/reverse_recurring_payment','POST','',{p_id,p_month:`${body.month}-01`}) as T
    return await rest('rpc/pay_recurring_expense','POST','',{p_id,p_month:`${body.month}-01`,p_account_id:body.accountId,p_amount_cents:body.amountCents,p_date:body.date,p_category:body.category,p_existing_entry_id:body.existingEntryId??null}) as T
  }
  if (path.startsWith('/budgets?') && method==='GET') {
    const month=new URLSearchParams(path.split('?')[1]).get('month')
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError('Mês inválido.',400)
    return await rest('rpc/monthly_budget_state','POST','',{p_month:`${month}-01`}) as T
  }
  if (path==='/budgets' && method==='POST') {
    const userId=await currentUserId()
    await rest('monthly_budgets','POST','on_conflict=user_id,month,category',{user_id:userId,month:`${body.month}-01`,category:String(body.category).trim(),limit_cents:body.limitCents},{prefer:'resolution=merge-duplicates,return=minimal'})
    return {ok:true} as T
  }
  const budgetId=path.match(/^\/budgets\/([^/]+)$/)
  if (budgetId && method==='DELETE') {
    const userId=await currentUserId()
    await rest('monthly_budgets','DELETE',query({id:`eq.${decodeURIComponent(budgetId[1])}`,user_id:`eq.${userId}`}))
    return {ok:true} as T
  }
  if (path==='/profile' && method==='PATCH') {
    await rest('profiles','PATCH',query({id:`eq.${await currentUserId()}`}),{name:body.name},{prefer:'return=minimal'})
    return {ok:true} as T
  }
  if (path==='/preferences' && method==='PATCH') {
    const userId=await currentUserId()
    await rest('user_preferences','POST','',{user_id:userId,theme:body.theme},{prefer:'resolution=merge-duplicates,return=minimal'})
    return {ok:true,theme:body.theme} as T
  }
  if (path==='/preferences/avatar' && method==='PATCH') {
    const skin=Number(body.skin), hairColor=Number(body.hairColor)
    if (!Number.isInteger(skin) || skin<0 || skin>3 || !Number.isInteger(hairColor) || hairColor<0 || hairColor>5) throw new ApiError('Escolha uma cor da paleta.', 400)
    await rest('user_preferences','POST','',{user_id:await currentUserId(),avatar_skin:skin,avatar_hair_color:hairColor},{prefer:'resolution=merge-duplicates,return=minimal'})
    return {ok:true} as T
  }
  if (path==='/cosmetics/purchase' && method==='POST') {
    try {
      return await rest('rpc/purchase_cosmetic','POST','',{p_item:body.item,p_key:idempotencyKey(options)}) as T
    } catch (error) {
      const code=(error as Error).message
      const known:Record<string,string>={INSUFFICIENT_GRANINHAS:'Graninhas insuficientes para este item.',ALREADY_OWNED:'Este item já é seu.',SHOP_CLOSED:'A Lojinha ainda não abriu.',NOT_FOR_SALE:'Este item não está à venda.',ITEM_NOT_FOUND:'Item não encontrado.'}
      throw known[code] ? new ApiError(known[code], 400, code) : error
    }
  }
  if (path==='/cosmetics/equip' && method==='POST') {
    try {
      return await rest('rpc/equip_cosmetic','POST','',{p_slot:body.slot,p_item:body.item}) as T
    } catch (error) {
      const code=(error as Error).message
      throw code==='NOT_OWNED' ? new ApiError('Você ainda não tem este item.', 400, code) : error
    }
  }
  if (path==='/routines' && method==='POST') return await rest('rpc/complete_financial_routine','POST','',{p_kind:body.kind}) as T
  const cardId = path.match(/^\/credit-cards\/([^/]+)$/)
  if ((path === '/credit-cards' && method === 'POST') || (cardId && method === 'PATCH')) {
    return await rest('rpc/save_credit_card','POST','',{p_id:cardId ? decodeURIComponent(cardId[1]) : null,p_name:body.name,p_last_four:body.lastFour,p_limit_cents:body.limitCents,p_closing_day:body.closingDay,p_due_day:body.dueDay,p_key:idempotencyKey(options)}) as T
  }
  if (cardId && method === 'DELETE') return await rest('rpc/archive_credit_card','POST','',{p_id:decodeURIComponent(cardId[1])}) as T
  if (path === '/card-purchases' && method === 'POST') {
    return await rest('rpc/create_card_purchase_with_interest','POST','',{p_card_id:body.cardId,p_title:body.title,p_category:body.category,p_subcategory:body.subcategory,p_principal_cents:body.principalCents,p_interest_cents:body.interestCents ?? 0,p_date:body.date,p_installments:body.installments,p_first_month:body.firstMonth ? `${body.firstMonth}-01` : null,p_note:body.note,p_key:idempotencyKey(options)}) as T
  }
  const cardPurchase = path.match(/^\/card-purchases\/([^/]+)$/)
  if (cardPurchase && method === 'DELETE') return await rest('rpc/archive_card_purchase','POST','',{p_id:decodeURIComponent(cardPurchase[1])}) as T
  const cardPayment = path.match(/^\/card-payments\/([^/]+)$/)
  if (cardPayment && method === 'DELETE') return await rest('rpc/reverse_card_payment','POST','',{p_id:decodeURIComponent(cardPayment[1])}) as T
  if (path === '/card-payments' && method === 'POST') return await rest('rpc/pay_card_bill','POST','',{p_card_id:body.cardId,p_month:`${body.month}-01`,p_account_id:body.accountId,p_amount_cents:body.amountCents,p_date:body.date,p_note:body.note,p_key:idempotencyKey(options)}) as T
  const categoryId=path.match(/^\/categories\/([^/]+)$/)
  if (path==='/categories' && method==='POST') {
    const userId=await currentUserId(), result=await rest<any[]>('categories','POST','',{user_id:userId,name:String(body.name).trim(),type:body.type})
    return {id:result[0]?.id} as T
  }
  if (categoryId && method==='PATCH') {
    const userId=await currentUserId(), archivedAt=body.archived ? new Date().toISOString() : null
    await rest('categories','PATCH',query({id:`eq.${decodeURIComponent(categoryId[1])}`,user_id:`eq.${userId}`}),{name:String(body.name).trim(),archived_at:archivedAt},{prefer:'return=minimal'})
    return {ok:true} as T
  }
  if (categoryId && method==='DELETE') return await rest('rpc/archive_category','POST','',{p_category_id:decodeURIComponent(categoryId[1])}) as T
  const subcategoryId=path.match(/^\/subcategories\/([^/]+)$/)
  if (path==='/subcategories' && method==='POST') {
    const userId=await currentUserId(), result=await rest<any[]>('subcategories','POST','',{user_id:userId,category_id:body.categoryId,name:String(body.name).trim()})
    return {id:result[0]?.id} as T
  }
  if (subcategoryId && method==='PATCH') {
    const userId=await currentUserId(), archivedAt=body.archived ? new Date().toISOString() : null
    await rest('subcategories','PATCH',query({id:`eq.${decodeURIComponent(subcategoryId[1])}`,user_id:`eq.${userId}`}),{name:String(body.name).trim(),archived_at:archivedAt},{prefer:'return=minimal'})
    return {ok:true} as T
  }
  if (subcategoryId && method==='DELETE') {
    const userId=await currentUserId()
    await rest('subcategories','PATCH',query({id:`eq.${decodeURIComponent(subcategoryId[1])}`,user_id:`eq.${userId}`,archived_at:'is.null'}),{archived_at:new Date().toISOString()},{prefer:'return=minimal'})
    return {ok:true} as T
  }
  const goalDifficulty=path.match(/^\/goals\/([^/]+)\/difficulty$/)
  if (goalDifficulty && method==='GET') return await difficulty(decodeURIComponent(goalDifficulty[1])) as T
  const goalHistory=path.match(/^\/goals\/([^/]+)\/difficulty\/history$/)
  if (goalHistory && method==='GET') {
    const list=await rest<any[]>('difficulty_assessments','GET',query({select:'difficulty_code,confidence_level,formula_version,calculated_at,result_json',goal_id:`eq.${decodeURIComponent(goalHistory[1])}`,order:'calculated_at.desc'}))
    return list.map(x=>({...x,result_json:x.result_json})) as T
  }
  const entryId=path.match(/^\/entries\/([^/]+)$/)
  if (path==='/entries' && method==='POST') {
    const result=await rest<any>('rpc/create_entry_v2','POST','',{p_account_id:body.accountId,p_title:body.title,p_category:body.category,p_subcategory:body.subcategory ?? '',p_type:body.type,p_amount_cents:body.amountCents,p_date:body.date,p_note:body.note,p_idempotency_key:idempotencyKey(options)})
    return result as T
  }
  if (path==='/entries' && method==='GET') return [] as T
  if (entryId && method==='PATCH') {
    const userId=await currentUserId()
    await rest('entries','PATCH',query({id:`eq.${decodeURIComponent(entryId[1])}`,user_id:`eq.${userId}`,archived_at:'is.null'}),{account_id:body.accountId,title:body.title,category:body.category,subcategory:body.subcategory ?? '',type:body.type,amount_cents:body.amountCents,date:body.date,note:body.note},{prefer:'return=minimal'})
    return {ok:true} as T
  }
  if (entryId && method==='DELETE') return await rest('rpc/archive_entry','POST','',{p_entry_id:decodeURIComponent(entryId[1])}) as T
  const accountId=path.match(/^\/accounts\/([^/]+)$/)
  if (path==='/accounts' && method==='POST') {
    const userId=await currentUserId(), result=await rest<any[]>('accounts','POST','',{user_id:userId,name:body.name,type:body.type,opening_cents:body.openingCents,is_reserve:body.isReserve,description:body.description})
    return {id:result[0]?.id} as T
  }
  if (accountId && method==='PATCH') {
    const userId=await currentUserId()
    await rest('accounts','PATCH',query({id:`eq.${decodeURIComponent(accountId[1])}`,user_id:`eq.${userId}`}),{name:body.name,type:body.type,is_reserve:body.isReserve,description:body.description},{prefer:'return=minimal'})
    return {ok:true} as T
  }
  if (accountId && method==='DELETE') {
    const id=decodeURIComponent(accountId[1]), used=await rest<any[]>('entries','GET',query({select:'id',account_id:`eq.${id}`,limit:'1'}))
    if (used.length) throw new ApiError('Esta conta tem movimentações. Para preservar o histórico, ela não pode ser excluída.',409)
    await rest('accounts','DELETE',query({id:`eq.${id}`}))
    return {ok:true} as T
  }
  const assetId=path.match(/^\/assets\/([^/]+)$/)
  if (path==='/assets' && method==='POST') {
    const userId=await currentUserId(), result=await rest<any[]>('assets','POST','',{user_id:userId,name:body.name,kind:body.kind,amount_cents:body.amountCents,note:body.note,installment_count:body.installmentCount ?? null,first_due_date:body.firstDueDate ?? null})
    return {id:result[0]?.id} as T
  }
  if (assetId && method==='PATCH') {
    await rest('assets','PATCH',query({id:`eq.${decodeURIComponent(assetId[1])}`}),{name:body.name,kind:body.kind,amount_cents:body.amountCents,note:body.note,installment_count:body.installmentCount ?? null,first_due_date:body.firstDueDate ?? null},{prefer:'return=minimal'})
    return {ok:true} as T
  }
  if (assetId && method==='DELETE') { await rest('assets','DELETE',query({id:`eq.${decodeURIComponent(assetId[1])}`})); return {ok:true} as T }
  const contribution=path.match(/^\/goals\/([^/]+)\/contributions$/)
  if (contribution && method==='POST') return await rest('rpc/create_confirmed_contribution','POST','',{p_goal_id:decodeURIComponent(contribution[1]),p_amount_cents:body.amountCents,p_date:body.date,p_note:body.note,p_idempotency_key:idempotencyKey(options),p_confirmed:body.economyConfirmed===true}) as T
  const goalId=path.match(/^\/goals\/([^/]+)$/)
  if (path==='/goals' && method==='POST') {
    const userId=await currentUserId(), result=await rest<any[]>('goals','POST','',{user_id:userId,title:body.title,kind:body.kind,target_cents:body.targetCents,icon:body.icon,deadline:body.deadline})
    return {id:result[0]?.id} as T
  }
  if (goalId && method==='PATCH') {
    await rest('goals','PATCH',query({id:`eq.${decodeURIComponent(goalId[1])}`,archived_at:'is.null'}),{title:body.title,kind:body.kind,target_cents:body.targetCents,icon:body.icon,deadline:body.deadline},{prefer:'return=minimal'})
    return {ok:true} as T
  }
  if (goalId && method==='DELETE') {
    await rest('goals','PATCH',query({id:`eq.${decodeURIComponent(goalId[1])}`,archived_at:'is.null'}),{archived_at:new Date().toISOString()},{prefer:'return=minimal'})
    return {ok:true} as T
  }
  throw new ApiError(`Operação não implementada: ${method} ${path}`,404)
}
export const json = (method: string, body: unknown, idempotent = false): RequestInit => ({ method, body: JSON.stringify(body), headers: idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {} })
