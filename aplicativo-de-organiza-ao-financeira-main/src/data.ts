import type { ThemeMode } from './theme'

export type Account = { id: string; name: string; type: 'corrente' | 'poupança' | 'dinheiro' | 'investimento' | 'outro'; openingCents: number; balanceCents: number; isReserve: boolean; description: string }
export type Entry = { id: string; accountId: string; title: string; category: string; type: 'income' | 'expense' | 'adjustment'; amountCents: number; date: string; note: string }
export type Asset = { id: string; name: string; kind: 'asset' | 'liability'; amountCents: number; note: string }
export type Goal = { id: string; title: string; kind: 'meta' | 'sonho'; targetCents: number; savedCents: number; icon: string; deadline: string | null; milestones: number[] }
/** `nextLevelXp` é `null` enquanto a curva oficial de XP não estiver configurada no servidor. */
export type Progress = { xp_total: number; level: number; graninha_balance: number; nextLevelXp: number | null }
export type State = { user: { id: string; name: string; email: string }; accounts: Account[]; entries: Entry[]; archivedEntries: (Entry & { archivedAt: string })[]; assets: Asset[]; goals: Goal[]; progress: Progress; preferences: { theme: ThemeMode | null }; stats: { reserveCents: number; netWorthCents: number; streak: number; financialClass: null } }
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
  const token = categories.find(category => category.name === name)?.token ?? 'default'
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

const SESSION_KEY = 'granae:preview-session'
let sessionToken: string | null = null
try { sessionToken = sessionStorage.getItem(SESSION_KEY) } catch { /* Storage may be unavailable inside an iframe. */ }

export function setSessionToken(token: string | null) {
  sessionToken = token
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch { /* The in-memory token still keeps this tab signed in. */ }
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const includeToken = path !== '/auth/login' && path !== '/auth/register'
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(includeToken && sessionToken ? { 'X-Granae-Session': sessionToken } : {}), ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError((data as { error?: string }).error || (response.status === 403 ? 'A pré-visualização bloqueou esta requisição. Reabra a prévia pelo Arena.' : 'Não foi possível completar esta ação.'), response.status, (data as { code?: string }).code)
  return data as T
}
export const json = (method: string, body: unknown, idempotent = false): RequestInit => ({ method, body: JSON.stringify(body), headers: idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {} })
