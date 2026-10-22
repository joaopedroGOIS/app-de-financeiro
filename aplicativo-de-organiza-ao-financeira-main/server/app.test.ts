import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from './db'
import { createApp } from './app'

async function setup() {
  const db = openDatabase(':memory:')
  const server = await new Promise<Server>(resolve => { const s = createApp(db).listen(0, '127.0.0.1', () => resolve(s)) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Sem porta')
  const base = `http://127.0.0.1:${address.port}/api`
  async function request(path: string, options: { method?: string; body?: unknown; cookie?: string; key?: string; origin?: string; authorization?: string; sessionHeader?: string; transport?: boolean } = {}) {
    const response = await fetch(`${base}${path}`, { method: options.method ?? 'GET', headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.cookie ? { Cookie: options.cookie } : {}), ...(options.key ? { 'Idempotency-Key': options.key } : {}), ...(options.origin ? { Origin: options.origin } : {}), ...(options.authorization ? { Authorization: `Bearer ${options.authorization}` } : {}), ...(options.sessionHeader ? { 'X-Granae-Session': options.sessionHeader } : {}), ...(options.transport ? { 'X-Session-Transport': 'bearer' } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined })
    return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '', body: await response.json() as any }
  }
  return { db, server, request }
}
const register = (name: string, email: string) => ({ name, email, password: 'minhasenhasegura123' })

test('dívida parcelada persiste sem duplicar despesas, saldo ou recompensas e isola usuários', async () => {
  const { db, server, request } = await setup()
  try {
    const user = await request('/auth/register', { method: 'POST', transport: true, body: register('Ana', 'ana@debt.example') })
    const other = await request('/auth/register', { method: 'POST', transport: true, body: register('Bia', 'bia@debt.example') })
    const sessionHeader = user.body.sessionToken
    const body = { name: 'Empréstimo', kind: 'liability', amountCents: 200000, note: '', installmentCount: 7, firstDueDate: '2026-11-10' }
    const created = await request('/assets', { method: 'POST', sessionHeader, body })
    assert.equal(created.status, 201)
    const saved = (await request('/state', { sessionHeader })).body
    assert.equal(saved.assets[0].installmentCount, 7)
    assert.equal(saved.assets[0].firstDueDate, '2026-11-10')
    assert.equal(saved.stats.netWorthCents, -200000)
    assert.equal(saved.entries.length, 0)
    assert.equal(saved.progress.xp_total, 0)
    assert.equal((await request('/state', { sessionHeader: other.body.sessionToken })).body.assets.length, 0)
    assert.equal((await request(`/assets/${created.body.id}`, { method: 'PATCH', sessionHeader: other.body.sessionToken, body })).status, 404)
    assert.equal((await request('/assets', { method: 'POST', sessionHeader, body: { ...body, firstDueDate: null } })).status, 400)
    assert.equal((await request('/assets', { method: 'POST', sessionHeader, body: { ...body, kind: 'asset' } })).status, 400)
    assert.equal((await request(`/assets/${created.body.id}`, { method: 'PATCH', sessionHeader, body: { ...body, installmentCount: 8 } })).status, 200)
    assert.equal((await request('/state', { sessionHeader })).body.assets[0].installmentCount, 8)
  } finally { server.close(); db.close() }
})
test('cabeçalho de sessão próprio mantém login sem Cookie nem Authorization', async () => {
  const { db, server, request } = await setup()
  try {
    const account = await request('/auth/register', { method: 'POST', transport: true, body: { name: 'Ana', email: 'ana@custom.example', password: '12345678' } })
    assert.equal(account.status, 201)
    const token = account.body.sessionToken as string
    assert.match(token, /^[a-f0-9]{64}$/)
    assert.equal((await request('/state', { sessionHeader: token })).body.user.name, 'Ana')
    const created = await request('/accounts', { method: 'POST', sessionHeader: token, body: { name: 'Conta', type: 'corrente', openingCents: 2500, isReserve: false, description: '' } })
    assert.equal(created.status, 201)
    assert.equal((await request('/state', { sessionHeader: token })).body.accounts[0].balanceCents, 2500)
    assert.equal((await request('/auth/logout', { method: 'POST', sessionHeader: token })).status, 200)
    const revoked = await request('/state', { sessionHeader: token })
    assert.equal(revoked.status, 401)
    assert.equal(revoked.body.code, 'SESSION_INVALID')
    assert.equal((await request('/state')).body.code, 'SESSION_MISSING')
  } finally { server.close(); db.close() }
})
test('sessão bearer permite acesso sem cookies, persiste entre requisições e é revogada no logout', async () => {
  const { db, server, request } = await setup()
  try {
    const a = await request('/auth/register', { method: 'POST', transport: true, body: { name: 'Ana', email: 'ana@bearer.example', password: '12345678' } })
    assert.equal(a.status, 201)
    const token = a.body.sessionToken as string
    assert.match(token, /^[a-f0-9]{64}$/)
    assert.equal((await request('/state', { authorization: token })).body.user.name, 'Ana')
    const account = await request('/accounts', { method: 'POST', authorization: token, body: { name: 'Conta', type: 'corrente', openingCents: 1000, isReserve: false, description: '' } })
    assert.equal(account.status, 201)
    assert.equal((await request('/state', { authorization: token })).body.accounts[0].balanceCents, 1000)
    const b = await request('/auth/register', { method: 'POST', transport: true, body: { name: 'Bia', email: 'bia@bearer.example', password: '12345678' } })
    assert.equal((await request('/state', { authorization: b.body.sessionToken })).body.accounts.length, 0)
    assert.equal((await request(`/accounts/${account.body.id}`, { method: 'DELETE', authorization: b.body.sessionToken })).status, 404)
    assert.equal((await request('/auth/logout', { method: 'POST', authorization: token })).status, 200)
    assert.equal((await request('/state', { authorization: token })).status, 401)
  } finally { server.close(); db.close() }
})
test('cookie de sessão funciona em prévia HTTPS dentro de iframe e mantém acesso local HTTP', async () => {
  const { db, server, request } = await setup()
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Sem porta')
    const secure = await request('/auth/register', { method: 'POST', origin: `https://127.0.0.1:${address.port}`, body: { name: 'Ana', email: 'ana@preview.example', password: '12345678' } })
    assert.equal(secure.status, 201)
    assert.match(secure.cookie, /granae_session=/)
    // The test helper returns only the cookie value; read full header below via login.
    const base = `http://127.0.0.1:${address.port}`
    const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: `https://127.0.0.1:${address.port}` }, body: JSON.stringify({ email: 'ana@preview.example', password: '12345678' }) })
    assert.match(response.headers.get('set-cookie') ?? '', /SameSite=None; Secure; Partitioned/)
    const local = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ email: 'ana@preview.example', password: '12345678' }) })
    assert.match(local.headers.get('set-cookie') ?? '', /SameSite=Lax/)
  } finally { server.close(); db.close() }
})
test('cadastro aceita 8 caracteres, recusa 7 e permite login com a senha cadastrada', async () => {
  const { db, server, request } = await setup()
  try {
    const short = await request('/auth/register', { method: 'POST', body: { name: 'Ana', email: 'ana@example.com', password: '1234567' } })
    assert.equal(short.status, 400)
    assert.match(short.body.error, /pelo menos 8 caracteres/)
    const created = await request('/auth/register', { method: 'POST', body: { name: 'Ana', email: 'ana@example.com', password: '12345678' } })
    assert.equal(created.status, 201)
    const loggedIn = await request('/auth/login', { method: 'POST', body: { email: 'ana@example.com', password: '12345678' } })
    assert.equal(loggedIn.status, 200)
    assert.equal((await request('/state', { cookie: loggedIn.cookie })).status, 200)
  } finally { server.close(); db.close() }
})
test('isolamento, saldo, reserva, marcos, idempotência e persistência por usuário', async () => {
  const { db, server, request } = await setup()
  try {
    const a = await request('/auth/register', { method: 'POST', body: register('Ana', 'ana@example.com') })
    const b = await request('/auth/register', { method: 'POST', body: register('Bia', 'bia@example.com') })
    assert.equal(a.status, 201); assert.equal(b.status, 201)
    const account = await request('/accounts', { method: 'POST', cookie: a.cookie, body: { name: 'Reserva', type: 'poupança', openingCents: 10000, isReserve: true, description: '' } })
    const accountId = account.body.id
    assert.equal((await request('/state', { cookie: b.cookie })).body.accounts.length, 0)
    assert.equal((await request(`/accounts/${accountId}`, { method: 'PATCH', cookie: b.cookie, body: { name: 'Invadida', type: 'corrente', isReserve: false, description: '' } })).status, 404)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const income = { accountId, title: 'Receita', category: 'Salário', type: 'income', amountCents: 25050, date: today, note: '' }
    const saved = await request('/entries', { method: 'POST', cookie: a.cookie, body: income, key: 'income-operation-1' })
    const replay = await request('/entries', { method: 'POST', cookie: a.cookie, body: income, key: 'income-operation-1' })
    assert.equal(saved.body.id, replay.body.id)
    const expense = await request('/entries', { method: 'POST', cookie: a.cookie, body: { ...income, type: 'expense', amountCents: 4999 }, key: 'expense-operation-1' })
    assert.equal(expense.status, 201)
    const state = (await request('/state', { cookie: a.cookie })).body
    assert.equal(state.accounts[0].balanceCents, 30051)
    assert.equal(state.stats.reserveCents, 30051)
    assert.equal(state.stats.netWorthCents, 30051)
    assert.equal(state.stats.streak, 1)
    assert.equal(state.entries.length, 2)
    assert.equal(state.progress.xp_total, 0) // No invented economy rewards.
    assert.equal((await request('/state', { cookie: b.cookie })).body.entries.length, 0)
    assert.equal((await request(`/entries/${saved.body.id}`, { method: 'DELETE', cookie: b.cookie })).status, 404)
    const goal = await request('/goals', { method: 'POST', cookie: a.cookie, body: { title: 'Viagem', kind: 'sonho', targetCents: 10000, icon: '✈️', deadline: null } })
    assert.equal(goal.status, 201)
    const progress = await request(`/goals/${goal.body.id}/contributions`, { method: 'POST', cookie: a.cookie, key: 'progress-operation-1', body: { amountCents: 8000, date: today, note: '' } })
    assert.deepEqual(progress.body.milestonesReached, [10, 25, 50, 75])
    const repeated = await request(`/goals/${goal.body.id}/contributions`, { method: 'POST', cookie: a.cookie, key: 'progress-operation-1', body: { amountCents: 8000, date: today, note: '' } })
    assert.equal(repeated.body.id, progress.body.id)
    const final = (await request('/state', { cookie: a.cookie })).body
    assert.equal(final.goals[0].savedCents, 8000)
    assert.deepEqual(final.goals[0].milestones, [10, 25, 50, 75])
    assert.equal(final.stats.reserveCents, 30051) // Goal progress never spends reserve.
    assert.equal((await request(`/goals/${goal.body.id}/difficulty`, { cookie: b.cookie })).status, 404)
    assert.equal((await request(`/goals/${goal.body.id}/difficulty`, { cookie: a.cookie })).body.status, 'insufficient')
    assert.equal((await request('/state')).status, 401)
    assert.equal((db.prepare('SELECT COUNT(*) AS count FROM reward_ledger').get() as { count: number }).count, 0)
    assert.equal((db.prepare('SELECT COUNT(*) AS count FROM gamification_events WHERE processed=0').get() as { count: number }).count, 3)
    assert.equal((await request(`/entries/${saved.body.id}`, { method: 'DELETE', cookie: a.cookie })).status, 200)
    const archivedState = (await request('/state', { cookie: a.cookie })).body
    assert.equal(archivedState.accounts[0].balanceCents, 5001)
    assert.equal(archivedState.archivedEntries.length, 1)
    assert.equal((db.prepare('SELECT COUNT(*) AS count FROM entries WHERE archived_at IS NOT NULL').get() as { count: number }).count, 1)
  } finally { server.close(); db.close() }
})

test('preferência de tema é salva na conta, isolada por usuário e sobrevive a um novo login', async () => {
  const { db, server, request } = await setup()
  try {
    const a = await request('/auth/register', { method: 'POST', body: register('Ana', 'ana@tema.example') })
    const b = await request('/auth/register', { method: 'POST', body: register('Bia', 'bia@tema.example') })
    // Sem escolha feita, o servidor não impõe tema (o cliente usa o padrão escuro).
    assert.equal((await request('/state', { cookie: a.cookie })).body.preferences.theme, null)
    assert.equal((await request('/preferences', { method: 'PATCH', cookie: a.cookie, body: { theme: 'light' } })).body.theme, 'light')
    assert.equal((await request('/state', { cookie: a.cookie })).body.preferences.theme, 'light')
    assert.equal((await request('/state', { cookie: b.cookie })).body.preferences.theme, null)
    assert.equal((await request('/preferences', { method: 'PATCH', cookie: a.cookie, body: { theme: 'neon' } })).status, 400)
    assert.equal((await request('/preferences', { method: 'PATCH', cookie: a.cookie, body: { theme: 'system' } })).body.theme, 'system')
    assert.equal((await request('/preferences', { method: 'PATCH', cookie: a.cookie, body: { theme: 'dark' } })).body.theme, 'dark')
    const again = await request('/auth/login', { method: 'POST', body: { email: 'ana@tema.example', password: 'minhasenhasegura123' } })
    assert.equal((await request('/state', { cookie: again.cookie })).body.preferences.theme, 'dark')
    assert.equal((await request('/preferences', { method: 'PATCH', body: { theme: 'light' } })).status, 401)
    const state = (await request('/state', { cookie: a.cookie })).body
    // Nenhuma curva de XP é inventada: o limite do próximo nível segue indefinido.
    assert.equal(state.progress.nextLevelXp, null)
    assert.equal(state.progress.level, 1)
    assert.equal(state.progress.xp_total, 0)
  } finally { server.close(); db.close() }
})

test('SQLite preserva dados depois de reabrir; ledger bloqueia alteração histórica', () => {
  const dir = mkdtempSync(join(tmpdir(), 'granae-test-'))
  const filename = join(dir, 'data.sqlite')
  try {
    const first = openDatabase(filename)
    first.prepare('INSERT INTO users(id,email,name,password_hash) VALUES (?,?,?,?)').run('u1', 'teste@example.com', 'Teste', 'hash')
    first.prepare('INSERT INTO player_progress(user_id) VALUES (?)').run('u1')
    first.prepare('INSERT INTO gamification_events(id,user_id,event_type,business_date,idempotency_key,entity_type,entity_id) VALUES (?,?,?,?,?,?,?)').run('e1', 'u1', 'expense_recorded', '2026-10-08', 'unique-event', 'entry', 'x1')
    first.prepare('INSERT INTO reward_ledger(id,user_id,event_id,reward_type,amount,reason_code,config_version) VALUES (?,?,?,?,?,?,?)').run('r1', 'u1', 'e1', 'xp', 10, 'fixture', 'test-v1')
    first.prepare('INSERT INTO user_preferences(user_id,theme) VALUES (?,?)').run('u1', 'light')
    assert.throws(() => first.prepare('UPDATE reward_ledger SET amount=999 WHERE id=?').run('r1'), /immutable/)
    assert.throws(() => first.prepare('DELETE FROM reward_ledger WHERE id=?').run('r1'), /immutable/)
    first.close()
    const second = openDatabase(filename)
    assert.equal((second.prepare('SELECT name FROM users WHERE id=?').get('u1') as { name: string }).name, 'Teste')
    assert.equal((second.prepare('SELECT amount FROM reward_ledger WHERE id=?').get('r1') as { amount: number }).amount, 10)
    assert.equal((second.prepare('SELECT theme FROM user_preferences WHERE user_id=?').get('u1') as { theme: string }).theme, 'light')
    second.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('registra valor de milhões em centavos sem truncar no milhar', async () => {
  const { db, server, request } = await setup()
  try {
    const user = await request('/auth/register', { method: 'POST', body: register('Teste monetário', 'large-money@example.test') })
    const account = await request('/accounts', { method: 'POST', cookie: user.cookie, body: { name: 'Conta de teste', type: 'corrente', openingCents: 0, isReserve: false, description: '' } })
    assert.equal(account.status, 201)
    const entry = await request('/entries', { method: 'POST', cookie: user.cookie, key: 'large-entry-test', body: { accountId: account.body.id, title: 'Valor alto', category: 'Salário', type: 'income', amountCents: 1234567890, date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), note: '' } })
    assert.equal(entry.status, 201)
    const state = await request('/state', { cookie: user.cookie })
    assert.equal(state.body.entries[0].amountCents, 1234567890)
    assert.equal(state.body.accounts[0].balanceCents, 1234567890)
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    db.close()
  }
})

test('orçamento mensal atualiza sem duplicação, isola usuários e não altera finanças ou XP',async()=>{
 const {db,server,request}=await setup()
 try{
  const a=await request('/auth/register',{method:'POST',transport:true,body:register('Ana','ana@budget.example')})
  const b=await request('/auth/register',{method:'POST',transport:true,body:register('Bia','bia@budget.example')})
  const sessionHeader=a.body.sessionToken,other=b.body.sessionToken
  const before=(await request('/state',{sessionHeader})).body
  const budget={month:'2026-10',category:'Mercado',limitCents:10000}
  assert.equal((await request('/budgets',{method:'POST',sessionHeader,body:budget})).status,200)
  await request('/budgets',{method:'POST',sessionHeader,body:{...budget,limitCents:20000}})
  const saved=(await request('/budgets?month=2026-10',{sessionHeader})).body
  assert.equal(saved.budgets.length,1);assert.equal(saved.budgets[0].limitCents,20000)
  assert.equal((await request('/budgets?month=2026-11',{sessionHeader})).body.budgets.length,0)
  assert.equal((await request('/budgets?month=2026-10',{sessionHeader:other})).body.budgets.length,0)
  assert.equal((await request(`/budgets/${saved.budgets[0].id}`,{method:'DELETE',sessionHeader:other})).status,404)
  assert.equal((await request('/budgets',{method:'POST',sessionHeader,body:{...budget,limitCents:0}})).status,400)
  assert.equal((await request('/budgets?month=2026-13',{sessionHeader})).status,400)
  const after=(await request('/state',{sessionHeader})).body
  assert.deepEqual(after.accounts,before.accounts);assert.deepEqual(after.entries,before.entries);assert.deepEqual(after.progress,before.progress)
  assert.equal((await request(`/budgets/${saved.budgets[0].id}`,{method:'DELETE',sessionHeader})).status,200)
 }finally{server.close();db.close()}
})

test('recorrência só altera saldo ao pagar, reverte e reativa sem duplicar registro',async()=>{
 const {db,server,request}=await setup()
 try{
  const a=await request('/auth/register',{method:'POST',transport:true,body:register('Ana','ana@recurring.example')})
  const b=await request('/auth/register',{method:'POST',transport:true,body:register('Bia','bia@recurring.example')})
  const sessionHeader=a.body.sessionToken,other=b.body.sessionToken
  const account=(await request('/accounts',{method:'POST',sessionHeader,body:{name:'Conta',type:'corrente',openingCents:100000,isReserve:false,description:''}})).body.id
  const plan={title:'Internet',category:'Moradia',amountCents:10000,dueDay:31,startMonth:'2024-01'}
  const options={method:'POST',sessionHeader,body:plan,key:'recurring-fixed-key'}
  const id=(await request('/recurring',options)).body.id
  assert.equal((await request('/recurring',options)).body.id,id)
  assert.equal((await request('/state',{sessionHeader})).body.entries.length,0)
  assert.equal((await request('/recurring?month=2024-02',{sessionHeader})).body.items[0].dueDate,'2024-02-29')
  assert.equal((await request('/recurring?month=2024-02',{sessionHeader:other})).body.items.length,0)
  const payment={month:'2024-02',accountId:account,amountCents:10000,date:'2024-02-15',category:'Moradia'}
  const paid=await request(`/recurring/${id}/pay`,{method:'POST',sessionHeader,body:payment})
  assert.equal(paid.status,200)
  assert.equal((await request(`/recurring/${id}/pay`,{method:'POST',sessionHeader,body:payment})).body.id,paid.body.id)
  let state=(await request('/state',{sessionHeader})).body
  assert.equal(state.entries.length,1);assert.equal(state.accounts[0].balanceCents,90000)
  assert.equal((await request(`/recurring/${id}/reverse`,{method:'POST',sessionHeader:other,body:{month:'2024-02'}})).status,404)
  assert.equal((await request(`/recurring/${id}/stop`,{method:'POST',sessionHeader:other,body:{}})).status,404)
  await request(`/recurring/${id}/reverse`,{method:'POST',sessionHeader,body:{month:'2024-02'}})
  state=(await request('/state',{sessionHeader})).body
  assert.equal(state.accounts[0].balanceCents,100000)
  assert.equal((await request(`/recurring/${id}/pay`,{method:'POST',sessionHeader,body:{...payment,amountCents:12000}})).body.id,paid.body.id)
  state=(await request('/state',{sessionHeader})).body
  assert.equal(state.entries.length,1);assert.equal(state.accounts[0].balanceCents,88000)
  assert.equal((db.prepare("SELECT count(*) n FROM gamification_events WHERE event_type='expense_recorded'").get() as {n:number}).n,1)
  await request(`/recurring/${id}/stop`,{method:'POST',sessionHeader,body:{}})
  assert.equal((await request('/recurring?month=2999-01',{sessionHeader})).body.items.length,0)
  assert.equal((await request(`/recurring/${id}/pay`,{method:'POST',sessionHeader,body:{...payment,month:'2999-01'}})).status,400)
  const manual=(await request('/entries',{method:'POST',sessionHeader,key:'manual-linked-payment',body:{accountId:account,title:'Luz',category:'Moradia',type:'expense',amountCents:5000,date:'2024-02-12',note:''}})).body.id
  const linkedPlan=(await request('/recurring',{method:'POST',sessionHeader,key:'linked-plan-fixed-key',body:{...plan,title:'Luz'}})).body.id
  const beforeLink=(await request('/state',{sessionHeader})).body
  const linked=await request(`/recurring/${linkedPlan}/pay`,{method:'POST',sessionHeader,body:{...payment,existingEntryId:manual}})
  assert.equal(linked.body.id,manual);assert.equal(linked.body.linked,true)
  const afterLink=(await request('/state',{sessionHeader})).body
  assert.equal(afterLink.entries.length,beforeLink.entries.length)
  assert.equal(afterLink.accounts[0].balanceCents,beforeLink.accounts[0].balanceCents)
 }finally{server.close();db.close()}
})
