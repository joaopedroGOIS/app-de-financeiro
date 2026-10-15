// PostgreSQL isolado em memória. Opcionalmente passe o caminho do módulo PGlite como argumento.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const moduleName = process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : '@electric-sql/pglite'
const { PGlite } = await import(moduleName)
const db = new PGlite()
const u1='11111111-1111-4111-8111-111111111111', u2='22222222-2222-4222-8222-222222222222'
let checks=0
const check=(name,fn)=>Promise.resolve().then(fn).then(()=>{checks++;console.log(`OK ${name}`)})
const user=async id=>{await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`)}
const scalar=async (sql,params=[])=>Object.values((await db.query(sql,params)).rows[0])[0]
const call=async (name,args)=>scalar(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')})`,args)
const snapshot=()=>call('credit_card_state',[])
try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon;`)
  for (const file of ['20261013233000_initial_schema.sql','20261014000000_user_categories.sql']) await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8'))
  await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated;`)
  await db.exec(await readFile(new URL('../../supabase/migrations/20261015000000_credit_cards.sql',import.meta.url),'utf8'))
  await db.query('insert into auth.users(id) values($1),($2)',[u1,u2])
  await user(u1)
  const account=await scalar(`insert into public.accounts(user_id,name,type) values(auth.uid(),'Conta','corrente') returning id`)
  const card=(await call('save_credit_card',[null,'Meu cartão','1234',100000,20,28,'create-card-0001'])).id
  await check('cadastro idempotente',async()=>assert.equal((await call('save_credit_card',[null,'Meu cartão','1234',100000,20,28,'create-card-0001'])).id,card))
  const buy=[card,'Notebook','Compras','',10000,'2026-10-10',3,null,'','purchase-key-0001']
  const purchase=(await call('create_card_purchase',buy)).id
  await check('compra idempotente e divisão exata dos centavos',async()=>{
    assert.equal((await call('create_card_purchase',buy)).id,purchase)
    const state=await snapshot()
    assert.equal(state.purchases.length,1)
    assert.deepEqual(state.installments.map(i=>Number(i.amount_cents)),[3334,3333,3333])
    assert.deepEqual(state.installments.map(i=>i.due_date),['2026-10-28','2026-11-28','2026-12-28'])
  })
  await check('bloqueia compra acima do limite e parcelas inválidas',async()=>{
    await assert.rejects(call('create_card_purchase',[card,'Excesso','Compras','',95000,'2026-10-10',1,null,'','too-large-00001']),/limite disponível/)
    await assert.rejects(call('create_card_purchase',[card,'Inválida','Compras','',2,'2026-10-10',3,null,'','invalid-000001']),/parcelas/)
    assert.equal((await snapshot()).purchases.length,1)
  })
  await check('categoria não pertencente ao usuário é rejeitada',async()=>{
    await assert.rejects(call('create_card_purchase',[card,'Categoria','Inexistente','',100,'2026-10-10',1,null,'','bad-category-001']),/categoria/)
  })
  await check('pagamento parcial é idempotente e não cria segunda despesa bancária',async()=>{
    const args=[card,'2026-10-01',account,2000,'2026-10-15','','pay-key-00001']
    const first=await call('pay_card_bill',args)
    assert.equal((await call('pay_card_bill',args)).id,first.id)
    const state=await snapshot()
    assert.equal(state.payments.length,1)
    assert.equal(Number(await scalar('select count(*) from public.entries')),0)
    await assert.rejects(call('pay_card_bill',[card,'2026-10-01',account,1335,'2026-10-15','','overpay-key-001']),/exceder/)
    await call('pay_card_bill',[card,'2026-10-01',account,1334,'2026-10-15','','pay-key-00002'])
    await assert.rejects(call('pay_card_bill',[card,'2026-10-01',account,1,'2026-10-15','','overpay-key-002']),/exceder/)
  })
  await check('não arquiva compra com pagamento ou cartão com dívida',async()=>{
    await assert.rejects(call('archive_card_purchase',[purchase]),/pagamento/)
    await assert.rejects(call('archive_credit_card',[card]),/Quite/)
  })
  await user(u2)
  const secondAccount=await scalar(`insert into public.accounts(user_id,name,type) values(auth.uid(),'Outra conta','corrente') returning id`)
  const secondCard=(await call('save_credit_card',[null,'Outro cartão','',100000,20,28,'create-card-0002'])).id
  await check('RLS e RPCs não expõem nem alteram dados de outro usuário',async()=>{
    const state=await snapshot()
    assert.equal(state.cards.length,1)
    assert.equal(state.cards[0].id,secondCard)
    assert.equal(state.purchases.length,0)
    await assert.rejects(call('create_card_purchase',[card,'Invasão','Compras','',100,'2026-10-10',1,null,'','cross-user-0001']),/Cartão não encontrado/)
    await assert.rejects(call('save_credit_card',[card,'Alterado','',100000,20,28,'cross-edit-0001']),/Cartão não encontrado/)
    await assert.rejects(call('archive_card_purchase',[purchase]),/não encontrada/)
    await assert.rejects(db.query('update public.credit_cards set limit_cents=999999 where id=$1',[card]),/permission denied/)
    await assert.rejects(db.query('insert into public.card_payments(user_id,card_id,account_id,bill_month,amount_cents,payment_date) values($1,$2,$3,$4,1,$5)',[u2,card,secondAccount,'2026-10-01','2026-10-15']),/permission denied/)
  })
  await user(u1)
  await check('não usa conta de outro usuário para pagar fatura',async()=>{
    await assert.rejects(call('pay_card_bill',[card,'2026-11-01',secondAccount,100,'2026-10-15','','cross-account-01']),/Conta não encontrada/)
  })
  await check('vencimentos em meses curtos, ano bissexto e regra do fechamento',async()=>{
    const febCard=(await call('save_credit_card',[null,'Calendário','',100000,31,5,'calendar-card-01'])).id
    await call('create_card_purchase',[febCard,'Fechamento','Compras','',100,'2024-02-29',1,null,'','calendar-buy-01'])
    assert.equal((await snapshot()).installments.find(i=>i.card_id===febCard).due_date,'2024-04-05')
    const shortCard=(await call('save_credit_card',[null,'Dia 31','',100000,20,31,'calendar-card-02'])).id
    await call('create_card_purchase',[shortCard,'Parcelas','Compras','',100,'2024-01-10',3,'2024-01-01','','calendar-buy-02'])
    assert.deepEqual((await snapshot()).installments.filter(i=>i.card_id===shortCard).map(i=>i.due_date),['2024-01-31','2024-02-29','2024-03-31'])
  })
  await check('arquivamento de compra não paga preserva histórico e remove parcelas do estado ativo',async()=>{
    const temp=(await call('create_card_purchase',[card,'Temporária','Compras','',100,'2026-10-11',1,'2027-01-01','','archive-buy-0001'])).id
    await call('archive_card_purchase',[temp])
    assert.equal((await snapshot()).purchases.some(p=>p.id===temp),false)
    assert.equal((await snapshot()).installments.some(i=>i.purchase_id===temp),false)
  })
  await check('desfazer pagamento reabre dívida, preserva auditoria e bloqueia repetição',async()=>{
    const payment=(await snapshot()).payments.find(p=>Number(p.amount_cents)===2000)
    await call('reverse_card_payment',[payment.id])
    const state=await snapshot()
    assert.equal(state.payments.some(p=>p.id===payment.id),false)
    assert.equal(Number(await scalar('select count(*) from public.card_payments where id=$1 and archived_at is not null',[payment.id])),1)
    await assert.rejects(call('reverse_card_payment',[payment.id]),/não encontrado/)
    await user(u2)
    const other=(state.payments.find(p=>p.card_id===card)).id
    await assert.rejects(call('reverse_card_payment',[other]),/não encontrado/)
    await user(u1)
  })
  await db.exec('reset role')
  await check('acesso anônimo aos dados e RPCs é negado',async()=>{
    await db.exec('set role anon')
    await assert.rejects(snapshot(),/permission denied/)
    await assert.rejects(db.query('select * from public.credit_cards'),/permission denied/)
  })
  console.log(`${checks} cenários PostgreSQL passaram.`)
} finally { await db.close() }
