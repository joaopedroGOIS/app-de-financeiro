import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto'
import { z, ZodError } from 'zod'
import { debtInstallments } from '../src/debtInstallments'
import type { DB } from './db'
import { analyzeDream, crossedMilestones, reserveAndNetWorth, streakFromDates } from './domain'

type Row = Record<string, unknown>
const cents = z.number().int().safe().min(0).max(1_000_000_000_00)
const signedCents = z.number().int().safe().min(-1_000_000_000_00).max(1_000_000_000_00)
const text = (max: number) => z.string().trim().min(1).max(max)
const optionalText = (max: number) => z.string().trim().max(max).default('')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s, 'Data inválida')
const entrySchema = z.object({ accountId: z.string().uuid(), title: text(80), category: text(40), type: z.enum(['income', 'expense', 'adjustment']), amountCents: signedCents, date, note: optionalText(300) }).refine(e => e.type === 'adjustment' ? e.amountCents !== 0 : e.amountCents > 0, { message: 'Valor inválido' })
const accountSchema = z.object({ name: text(60), type: z.enum(['corrente', 'poupança', 'dinheiro', 'investimento', 'outro']), openingCents: signedCents, isReserve: z.boolean(), description: optionalText(200) })
const accountUpdate = accountSchema.omit({ openingCents: true })
const assetSchema = z.object({ name: text(70), kind: z.enum(['asset', 'liability']), amountCents: cents.positive(), note: optionalText(200), installmentCount: z.number().int().min(1).max(360).nullable().optional(), firstDueDate: date.nullable().optional() }).superRefine((asset, context) => {
  if (asset.installmentCount != null || asset.firstDueDate != null) {
    if (asset.kind !== 'liability' || !asset.installmentCount || !asset.firstDueDate || !debtInstallments(asset.amountCents, asset.installmentCount, asset.firstDueDate).length) context.addIssue({ code: 'custom', message: 'Parcelamento da dívida inválido.' })
  }
})
const goalSchema = z.object({ title: text(70), kind: z.enum(['meta', 'sonho']), targetCents: cents.positive(), icon: z.string().min(1).max(10), deadline: date.nullable().optional() })
const contributionSchema = z.object({ amountCents: cents.positive(), date, note: optionalText(200) })
/** Aparência da interface. Persistida por conta para valer entre dispositivos. */
const themeSchema = z.object({ theme: z.enum(['dark', 'light', 'system']) })
function asRow(value: unknown): Row { return value as Row }
function fail(status: number, message: string): never { throw Object.assign(new Error(message), { status }) }
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
function notFuture(value: string) { if (value > today()) fail(400, 'Use uma data de hoje ou anterior para lançamentos realizados.') }
function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}` }
function validPassword(password: string, hash: string) { const [salt, digest] = hash.split(':'); if (!salt || !digest) return false; const expected = Buffer.from(digest, 'hex'); const actual = scryptSync(password, salt, expected.length); return expected.length === actual.length && timingSafeEqual(expected, actual) }
function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex') }
function cookieToken(req: Request) { return req.headers.cookie?.match(/(?:^|;\s*)granae_session=([a-f0-9]{64})/i)?.[1] }
function bearerToken(req: Request) { return req.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1] }
function previewToken(req: Request) { return req.get('x-granae-session')?.match(/^[a-f0-9]{64}$/i)?.[0] }
const cookieName = 'granae_session'
function cookie(req: Request, token: string, expires: number) {
  // The Arena preview is an HTTPS iframe on a different site. Lax cookies are not
  // sent by iframe fetches; Partitioned + None keeps the session scoped to that
  // top-level site while still allowing the authenticated /api requests.
  const https = process.env.NODE_ENV === 'production' || req.secure ||
    req.get('x-forwarded-proto')?.split(',')[0].trim() === 'https' ||
    req.get('origin')?.startsWith('https://')
  return `${cookieName}=${token}; HttpOnly; Path=/; Max-Age=${expires}; ${https ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax'}`
}
function accountOf(db: DB, userId: string, id: string) { const row = db.prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?').get(id, userId); if (!row) fail(404, 'Conta não encontrada.'); return row }
function goalOf(db: DB, userId: string, id: string) { const row = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ? AND archived_at IS NULL').get(id, userId); if (!row) fail(404, 'Objetivo não encontrado.'); return asRow(row) }
function event(db: DB, userId: string, eventType: string, businessDate: string, entityType: string, entityId: string, key: string) {
  db.prepare('INSERT OR IGNORE INTO gamification_events (id,user_id,event_type,business_date,idempotency_key,entity_type,entity_id) VALUES (?,?,?,?,?,?,?)').run(randomUUID(), userId, eventType, businessDate, key, entityType, entityId)
  // No reward is issued until the approved, versioned economy configuration exists.
}
function replayable<T>(db: DB, userId: string, key: string | undefined, action: () => T): T {
  if (!key || !/^[\w:-]{8,120}$/.test(key)) fail(400, 'Idempotency-Key válido é obrigatório.')
  return db.transaction(() => {
    const previous = db.prepare('SELECT response_json FROM request_keys WHERE user_id=? AND key=?').get(userId, key) as { response_json: string } | undefined
    if (previous) return JSON.parse(previous.response_json) as T
    const result = action()
    db.prepare('INSERT INTO request_keys(user_id,key,response_json) VALUES (?,?,?)').run(userId, key, JSON.stringify(result))
    return result
  })()
}

export function createApp(db: DB) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      const origin = new URL(req.headers.origin).host
      const host = req.get('host')
      if (origin !== host && origin !== req.get('x-forwarded-host')) return next(Object.assign(new Error('Origem não permitida.'), { status: 403 }))
    }
    next()
  })
  app.post('/api/auth/register', (req, res) => {
    const parsed = z.object({ name: text(50), email: z.email().max(255), password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.').max(128) }).parse(req.body)
    const email = parsed.email.toLowerCase()
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) fail(409, 'Este e-mail já está cadastrado.')
    const userId = randomUUID()
    db.transaction(() => {
      db.prepare('INSERT INTO users(id,email,name,password_hash) VALUES (?,?,?,?)').run(userId, email, parsed.name, hashPassword(parsed.password))
      db.prepare('INSERT INTO player_progress(user_id) VALUES (?)').run(userId)
    })()
    const sessionToken = issueSession(req, res, userId)
    res.status(201).json({ ok: true, ...(sessionToken ? { sessionToken } : {}) })
  })
  function issueSession(req: Request, res: Response, userId: string) {
    const token = randomBytes(32).toString('hex')
    db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').run(tokenHash(token), userId, Date.now() + 30 * 24 * 60 * 60 * 1000)
    res.setHeader('Set-Cookie', cookie(req, token, 30 * 24 * 60 * 60))
    // Explicit opt-in fallback for browsers blocking all cookies in embedded previews.
    // The bearer token is independently revocable and expires after 24 hours.
    if (req.get('x-session-transport') === 'bearer') {
      const bearer = randomBytes(32).toString('hex')
      db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').run(tokenHash(bearer), userId, Date.now() + 24 * 60 * 60 * 1000)
      return bearer
    }
    return null
  }
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = z.object({ email: z.email(), password: z.string() }).parse(req.body)
    const user = db.prepare('SELECT id,password_hash FROM users WHERE email=?').get(email.toLowerCase()) as { id: string; password_hash: string } | undefined
    if (!user || !validPassword(password, user.password_hash)) fail(401, 'E-mail ou senha incorretos.')
    const sessionToken = issueSession(req, res, user.id)
    res.json({ ok: true, ...(sessionToken ? { sessionToken } : {}) })
  })
  app.post('/api/auth/logout', (req, res) => {
    for (const token of new Set([cookieToken(req), bearerToken(req), previewToken(req)].filter((value): value is string => !!value))) {
      db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token))
    }
    res.setHeader('Set-Cookie', cookie(req, '', 0)); res.json({ ok: true })
  })
  app.use('/api', (req, _res, next) => {
    for (const token of [previewToken(req), bearerToken(req), cookieToken(req)]) {
      if (!token) continue
      const row = db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').get(tokenHash(token), Date.now()) as { user_id: string } | undefined
      if (row) { req.userId = row.user_id; return next() }
    }
    const sessionWasSent = !!(req.get('x-granae-session') || req.get('authorization') || cookieToken(req))
    next(Object.assign(new Error(sessionWasSent ? 'Sessão expirada ou inválida. Entre novamente.' : 'Nenhuma sessão chegou ao servidor.'), { status: 401, code: sessionWasSent ? 'SESSION_INVALID' : 'SESSION_MISSING' }))
  })
  app.get('/api/state', (req, res) => {
    const userId = req.userId
    const user = db.prepare('SELECT id,name,email FROM users WHERE id=?').get(userId)
    const accountRows = db.prepare('SELECT * FROM accounts WHERE user_id=? ORDER BY created_at, id').all(userId).map(asRow)
    const entries = db.prepare('SELECT * FROM entries WHERE user_id=? AND archived_at IS NULL ORDER BY date DESC, created_at DESC').all(userId).map(asRow)
    const archivedEntries = db.prepare('SELECT * FROM entries WHERE user_id=? AND archived_at IS NOT NULL ORDER BY date DESC, created_at DESC').all(userId).map(asRow)
    const assets = db.prepare('SELECT * FROM assets WHERE user_id=? ORDER BY name').all(userId).map(asRow)
    const goals = db.prepare('SELECT * FROM goals WHERE user_id=? AND archived_at IS NULL ORDER BY created_at DESC').all(userId).map(asRow)
    const contributions = db.prepare('SELECT * FROM contributions WHERE user_id=? ORDER BY date DESC').all(userId).map(asRow)
    const milestones = db.prepare('SELECT goal_id,milestone FROM milestone_claims WHERE user_id=?').all(userId).map(asRow)
    const progress = db.prepare('SELECT xp_total,level,graninha_balance FROM player_progress WHERE user_id=?').get(userId)
    const preference = db.prepare('SELECT theme FROM user_preferences WHERE user_id=?').get(userId) as { theme: string | null } | undefined
    const progressRow = asRow(progress ?? {})
    // `nextLevelXp` permanece null: a curva oficial de XP não está configurada neste
    // repositório e nenhum limite de nível é inventado no servidor nem no cliente.
    const playerProgress = { xp_total: Number(progressRow.xp_total ?? 0), level: Number(progressRow.level ?? 1), graninha_balance: Number(progressRow.graninha_balance ?? 0), nextLevelXp: null as number | null }
    const { balances, reserveCents, netWorthCents } = reserveAndNetWorth(accountRows.map(a => ({ id: String(a.id), openingCents: Number(a.opening_cents), isReserve: Boolean(a.is_reserve) })), entries.map(e => ({ id: String(e.id), accountId: String(e.account_id), type: e.type as 'income' | 'expense' | 'adjustment', amountCents: Number(e.amount_cents), date: String(e.date) })), assets.map(a => ({ kind: a.kind as 'asset' | 'liability', amountCents: Number(a.amount_cents) })))
    res.json({ user, accounts: accountRows.map(a => ({ id: a.id, name: a.name, type: a.type, openingCents: a.opening_cents, isReserve: !!a.is_reserve, description: a.description, balanceCents: balances.find(b => b.id === a.id)?.balanceCents ?? 0 })), entries: entries.map(e => ({ id: e.id, accountId: e.account_id, title: e.title, category: e.category, type: e.type, amountCents: e.amount_cents, date: e.date, note: e.note })), archivedEntries: archivedEntries.map(e => ({ id: e.id, accountId: e.account_id, title: e.title, category: e.category, type: e.type, amountCents: e.amount_cents, date: e.date, note: e.note, archivedAt: e.archived_at })), assets: assets.map(a => ({ id: a.id, name: a.name, kind: a.kind, amountCents: a.amount_cents, note: a.note, installmentCount: a.installment_count ?? null, firstDueDate: a.first_due_date ?? null })), goals: goals.map(g => ({ id: g.id, title: g.title, kind: g.kind, targetCents: g.target_cents, icon: g.icon, deadline: g.deadline, savedCents: contributions.filter(c => c.goal_id === g.id).reduce((sum, c) => sum + Number(c.amount_cents), 0), milestones: milestones.filter(m => m.goal_id === g.id).map(m => m.milestone) })), progress: playerProgress, preferences: { theme: preference?.theme ?? null }, stats: { reserveCents, netWorthCents, streak: streakFromDates(entries.map(e => String(e.date)), today()), financialClass: null } })
  })
  app.patch('/api/profile', (req, res) => { const { name } = z.object({ name: text(50) }).parse(req.body); db.prepare('UPDATE users SET name=? WHERE id=?').run(name, req.userId); res.json({ ok: true }) })
  app.patch('/api/preferences', (req, res) => {
    const { theme } = themeSchema.parse(req.body)
    db.prepare('INSERT INTO user_preferences(user_id,theme) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET theme=excluded.theme, updated_at=CURRENT_TIMESTAMP').run(req.userId, theme)
    res.json({ ok: true, theme })
  })
  app.post('/api/accounts', (req, res) => {
    const a = accountSchema.parse(req.body); const id = randomUUID()
    db.prepare('INSERT INTO accounts(id,user_id,name,type,opening_cents,is_reserve,description) VALUES (?,?,?,?,?,?,?)').run(id, req.userId, a.name, a.type, a.openingCents, Number(a.isReserve), a.description)
    res.status(201).json({ id })
  })
  app.patch('/api/accounts/:id', (req, res) => {
    accountOf(db, req.userId, String(req.params.id)); const a = accountUpdate.parse(req.body)
    db.prepare('UPDATE accounts SET name=?, type=?, is_reserve=?, description=? WHERE id=? AND user_id=?').run(a.name, a.type, Number(a.isReserve), a.description, req.params.id, req.userId)
    res.json({ ok: true })
  })
  app.delete('/api/accounts/:id', (req, res) => {
    accountOf(db, req.userId, String(req.params.id))
    if (db.prepare('SELECT 1 FROM entries WHERE account_id=? LIMIT 1').get(req.params.id)) fail(409, 'Esta conta tem movimentações. Para preservar o histórico, ela não pode ser excluída.')
    db.prepare('DELETE FROM accounts WHERE id=? AND user_id=?').run(req.params.id, req.userId); res.json({ ok: true })
  })
  app.post('/api/entries', (req, res) => {
    const e = entrySchema.parse(req.body); notFuture(e.date); accountOf(db, req.userId, e.accountId)
    const result = replayable(db, req.userId, req.get('Idempotency-Key'), () => {
      const id = randomUUID()
      db.prepare('INSERT INTO entries(id,user_id,account_id,title,category,type,amount_cents,date,note) VALUES (?,?,?,?,?,?,?,?,?)').run(id, req.userId, e.accountId, e.title, e.category, e.type, e.amountCents, e.date, e.note)
      event(db, req.userId, e.type === 'expense' ? 'expense_recorded' : e.type === 'income' ? 'income_recorded' : 'financial_entry_updated', e.date, 'entry', id, `entry:${id}:created`)
      return { id }
    })
    res.status(201).json(result)
  })
  app.patch('/api/entries/:id', (req, res) => {
    const e = entrySchema.parse(req.body); notFuture(e.date); accountOf(db, req.userId, e.accountId)
    const entry = db.prepare('SELECT id FROM entries WHERE id=? AND user_id=? AND archived_at IS NULL').get(req.params.id, req.userId)
    if (!entry) fail(404, 'Movimentação não encontrada.')
    db.transaction(() => {
      db.prepare('UPDATE entries SET account_id=?,title=?,category=?,type=?,amount_cents=?,date=?,note=? WHERE id=? AND user_id=?').run(e.accountId, e.title, e.category, e.type, e.amountCents, e.date, e.note, req.params.id, req.userId)
      event(db, req.userId, 'financial_entry_updated', e.date, 'entry', String(req.params.id), `entry:${req.params.id}:updated:${randomUUID()}`)
    })()
    res.json({ ok: true })
  })
  app.delete('/api/entries/:id', (req, res) => {
    const row = db.prepare('SELECT id,date FROM entries WHERE id=? AND user_id=? AND archived_at IS NULL').get(req.params.id, req.userId) as { id: string; date: string } | undefined
    if (!row) fail(404, 'Movimentação não encontrada.')
    db.transaction(() => {
      db.prepare('UPDATE entries SET archived_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(row.id, req.userId)
      event(db, req.userId, 'financial_entry_archived', row.date, 'entry', row.id, `entry:${row.id}:archived`)
    })()
    res.json({ ok: true })
  })
  app.post('/api/assets', (req, res) => { const a = assetSchema.parse(req.body); const id = randomUUID(); db.prepare('INSERT INTO assets(id,user_id,name,kind,amount_cents,note,installment_count,first_due_date) VALUES (?,?,?,?,?,?,?,?)').run(id, req.userId, a.name, a.kind, a.amountCents, a.note, a.installmentCount ?? null, a.firstDueDate ?? null); res.status(201).json({ id }) })
  app.patch('/api/assets/:id', (req, res) => { const a = assetSchema.parse(req.body); const result = db.prepare('UPDATE assets SET name=?,kind=?,amount_cents=?,note=?,installment_count=?,first_due_date=? WHERE id=? AND user_id=?').run(a.name, a.kind, a.amountCents, a.note, a.installmentCount ?? null, a.firstDueDate ?? null, req.params.id, req.userId); if (!result.changes) fail(404, 'Item não encontrado.'); res.json({ ok: true }) })
  app.delete('/api/assets/:id', (req, res) => { const result = db.prepare('DELETE FROM assets WHERE id=? AND user_id=?').run(req.params.id, req.userId); if (!result.changes) fail(404, 'Item não encontrado.'); res.json({ ok: true }) })
  app.post('/api/goals', (req, res) => { const g = goalSchema.parse(req.body); const id = randomUUID(); db.prepare('INSERT INTO goals(id,user_id,title,kind,target_cents,icon,deadline) VALUES (?,?,?,?,?,?,?)').run(id, req.userId, g.title, g.kind, g.targetCents, g.icon, g.deadline ?? null); res.status(201).json({ id }) })
  app.patch('/api/goals/:id', (req, res) => { const g = goalSchema.parse(req.body); goalOf(db, req.userId, String(req.params.id)); const saved = asRow(db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS total FROM contributions WHERE goal_id=?').get(req.params.id)).total as number; if (g.targetCents < saved) fail(400, 'O objetivo não pode ser menor que o valor já registrado.'); db.prepare('UPDATE goals SET title=?,kind=?,target_cents=?,icon=?,deadline=? WHERE id=? AND user_id=?').run(g.title, g.kind, g.targetCents, g.icon, g.deadline ?? null, req.params.id, req.userId); res.json({ ok: true }) })
  app.delete('/api/goals/:id', (req, res) => { goalOf(db, req.userId, String(req.params.id)); db.prepare('UPDATE goals SET archived_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(req.params.id, req.userId); res.json({ ok: true }) })
  app.post('/api/goals/:id/contributions', (req, res) => {
    const g = goalOf(db, req.userId, String(req.params.id)); const c = contributionSchema.parse(req.body); notFuture(c.date)
    const result = replayable(db, req.userId, req.get('Idempotency-Key'), () => {
      const saved = Number(asRow(db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS total FROM contributions WHERE goal_id=?').get(g.id)).total)
      if (saved + c.amountCents > Number(g.target_cents)) fail(400, 'O aporte ultrapassa o valor do objetivo.')
      const id = randomUUID()
      db.prepare('INSERT INTO contributions(id,user_id,goal_id,amount_cents,date,note) VALUES (?,?,?,?,?,?)').run(id, req.userId, g.id, c.amountCents, c.date, c.note)
      const reached = crossedMilestones(saved, saved + c.amountCents, Number(g.target_cents))
      for (const milestone of reached) db.prepare('INSERT OR IGNORE INTO milestone_claims(id,user_id,goal_id,milestone) VALUES (?,?,?,?)').run(randomUUID(), req.userId, g.id, milestone)
      event(db, req.userId, 'goal_progress_added', c.date, 'goal', String(g.id), `contribution:${id}`)
      return { id, milestonesReached: reached }
    })
    res.status(201).json(result)
  })
  app.get('/api/goals/:id/difficulty', (req, res) => {
    const goal = goalOf(db, req.userId, String(req.params.id))
    if (goal.kind !== 'sonho') fail(400, 'Somente Sonhos possuem análise de dificuldade.')
    const saved = Number(asRow(db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS total FROM contributions WHERE goal_id=?').get(goal.id)).total)
    const entries = db.prepare("SELECT type,amount_cents,date FROM entries WHERE user_id=? AND archived_at IS NULL AND type IN ('income','expense')").all(req.userId).map(asRow)
    const inputs = { remainingCents: Math.max(0, Number(goal.target_cents) - saved), deadline: goal.deadline as string | null, entries: entries.map(e => ({ type: e.type as 'income' | 'expense', amountCents: Number(e.amount_cents), date: String(e.date) })), today: today() }
    const result = analyzeDream(inputs)
    const snapshot = JSON.stringify(inputs)
    const previous = db.prepare('SELECT inputs_json FROM difficulty_assessments WHERE goal_id=? AND user_id=? ORDER BY calculated_at DESC, rowid DESC LIMIT 1').get(goal.id, req.userId) as { inputs_json: string } | undefined
    if (snapshot !== previous?.inputs_json) db.prepare('INSERT INTO difficulty_assessments(id,user_id,goal_id,difficulty_code,inputs_json,result_json,confidence_level,formula_version) VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(), req.userId, goal.id, result.status === 'ready' ? result.difficulty : result.status, snapshot, JSON.stringify(result), result.confidence, 'difficulty_formula_v1')
    res.json({ ...result, formulaVersion: 'difficulty_formula_v1' })
  })
  app.get('/api/goals/:id/difficulty/history', (req, res) => { goalOf(db, req.userId, String(req.params.id)); res.json(db.prepare('SELECT difficulty_code,confidence_level,formula_version,calculated_at,result_json FROM difficulty_assessments WHERE user_id=? AND goal_id=? ORDER BY calculated_at DESC, rowid DESC').all(req.userId, req.params.id).map(asRow)) })
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) return res.status(400).json({ error: error.issues[0]?.message || 'Dados inválidos.' })
    const err = error as { status?: number; message?: string; type?: string; code?: string }
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' })
    if (err?.status) return res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) })
    console.error(error)
    res.status(500).json({ error: 'Não foi possível concluir a operação.' })
  })
  return app
}
