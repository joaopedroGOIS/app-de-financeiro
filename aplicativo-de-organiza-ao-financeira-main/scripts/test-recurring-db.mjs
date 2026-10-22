import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href)
const db=new PGlite();let checks=0
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
const login=async(id)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
const call=(name,args=[])=>scalar(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args)
const check=async(name,fn)=>{await fn();console.log('OK '+name);checks++}
try{
 await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon;")
 for(const file of ['20261013233000_initial_schema.sql','20261014000000_user_categories.sql','20261015000000_credit_cards.sql','20261015010000_card_purchase_interest.sql','20261015020000_gamification_engine.sql','20261015030000_approved_economy.sql','20261016000000_complete_rewards.sql','20261022000000_monthly_budgets.sql','20261022010000_recurring_expenses.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'))
 const a=randomUUID(),b=randomUUID();await db.query('insert into auth.users(id) values($1),($2)',[a,b]);await login(a)
 const account=await scalar("insert into public.accounts(user_id,name,type,opening_cents) values(auth.uid(),'Conta','corrente',100000) returning id")
 let rid,eid
 const create=()=>call('create_recurring_expense',['Internet','Moradia',10000,31,'2024-01-01','recurring-create-test'])
 const state=month=>call('recurring_expense_state',[month+'-01'])
 const pay=(month,amount=10000,date='2024-02-15',acc=account)=>call('pay_recurring_expense',[rid,month+'-01',acc,amount,date,'Moradia'])
 const xp=async()=>Number((await call('gamification_state')).progress.xp_total)
 await check('criar e repetir cadastro não gera despesas nem recompensas',async()=>{rid=(await create()).id;assert.equal((await create()).id,rid);assert.equal((await state('2024-02')).templates.length,1);assert.equal(await scalar('select count(*) from public.entries'),0);assert.equal(await scalar('select count(*) from public.gamification_events'),0);assert.equal(await xp(),0)})
 await check('vencimento respeita fevereiro, ano bissexto e volta ao dia original',async()=>{assert.equal((await state('2024-02')).items[0].dueDate,'2024-02-29');assert.equal((await state('2025-02')).items[0].dueDate,'2025-02-28');assert.equal((await state('2024-03')).items[0].dueDate,'2024-03-31');assert.equal((await state('2023-12')).items.length,0);assert.equal((await state('2024-02')).items[0].status,'overdue')})
 await check('pagamento explícito cria uma única despesa e uma única referência',async()=>{eid=(await pay('2024-02')).id;assert.equal((await pay('2024-02',20000)).id,eid);assert.equal(await scalar('select count(*) from public.entries'),1);assert.equal(await scalar('select count(*) from public.recurring_payments'),1);const row=(await state('2024-02')).items[0];assert.equal(row.status,'paid');assert.equal(row.paidAmountCents,10000);assert.equal((await call('monthly_budget_state',['2024-02-01'])).spending[0].spentCents,10000);await call('process_my_rewards')})
 const rewardBefore=await xp()
 await check('desfazer e reativar preservam o mesmo lançamento sem novo XP de registro',async()=>{await call('reverse_recurring_payment',[rid,'2024-02-01']);await call('reverse_recurring_payment',[rid,'2024-02-01']);assert.equal((await state('2024-02')).items[0].status,'reversed');assert.equal((await call('monthly_budget_state',['2024-02-01'])).spending.length,0);assert.equal((await pay('2024-02',12500)).id,eid);assert.equal((await state('2024-02')).items[0].paidAmountCents,12500);await call('process_my_rewards');assert.equal(await xp(),rewardBefore);assert.equal(await scalar("select count(*) from public.gamification_events where event_type='expense_recorded'"),1);assert.equal(await scalar('select count(*) from public.entries'),1)})
 await check('arquivamento no histórico reflete na recorrência e pode reativar o mesmo ID',async()=>{await call('archive_entry',[eid]);assert.equal((await state('2024-02')).items[0].status,'reversed');assert.equal((await pay('2024-02')).id,eid)})
 await check('pagamento antecipado entra no orçamento pela data real, sem antecipar previsão',async()=>{await pay('2027-01',3000,'2024-03-01');assert.equal((await call('monthly_budget_state',['2024-03-01'])).spending[0].spentCents,3000);assert.equal((await state('2027-01')).items[0].status,'paid')})
 await check('encerramento cancela previsões futuras e mantém pagamentos e pendências passadas',async()=>{await call('stop_recurring_expense',[rid]);assert.equal((await state('2027-02')).items.length,0);assert.equal((await state('2027-01')).items[0].status,'paid');assert.equal((await state('2024-01')).items[0].status,'overdue');await assert.rejects(pay('2027-02'))})
 await check('isola leitura, pagamento, encerramento e reversão entre usuários',async()=>{await login(b);assert.equal((await state('2024-02')).templates.length,0);assert.equal(await scalar('select count(*) from public.recurring_payments'),0);await assert.rejects(call('stop_recurring_expense',[rid]));await assert.rejects(call('reverse_recurring_payment',[rid,'2024-02-01']));await assert.rejects(pay('2024-02'));await assert.rejects(db.exec("insert into public.recurring_expenses(user_id,title,category,amount_cents,due_day,start_month) values(auth.uid(),'Forjado','Moradia',1,1,'2024-01-01')"));await login(a)})
 await check('recusa dias, meses, categorias, contas, valores e datas de pagamento inválidos',async()=>{await assert.rejects(call('create_recurring_expense',['Inválida','Moradia',100,32,'2024-01-01','invalid-day-test']));await assert.rejects(call('create_recurring_expense',['Inválida','Outra',100,10,'2024-01-01','invalid-cat-test']));await assert.rejects(state('2024-02-02'));await assert.rejects(pay('2023-12'));await call('reverse_recurring_payment',[rid,'2024-02-01']);await assert.rejects(pay('2024-02',0));await assert.rejects(pay('2024-02',100,'2999-01-01'));await assert.rejects(pay('2024-02',100,'2024-02-01',randomUUID()));assert.equal((await state('2024-02')).items[0].status,'reversed');await pay('2024-02')})
 await check('pagamento usa conta pertencente ao usuário',async()=>{await login(b);const otherAccount=await scalar("insert into public.accounts(user_id,name,type) values(auth.uid(),'Outra','corrente') returning id");await login(a);await call('reverse_recurring_payment',[rid,'2024-02-01']);await assert.rejects(pay('2024-02',100,'2024-02-01',otherAccount));await pay('2024-02')})
 await check('vincula despesa já existente sem duplicar saldo, registro ou evento',async()=>{
  const plan=(await call('create_recurring_expense',['Luz','Moradia',5000,10,'2024-01-01','link-existing-plan'])).id
  const manual=(await call('create_entry_v2',[account,'Conta de luz','Moradia','','expense',5500,'2024-01-10','','manual-existing-payment'])).id
  const count=await scalar('select count(*) from public.entries'),events=await scalar('select count(*) from public.gamification_events')
  const result=await call('pay_recurring_expense',[plan,'2024-01-01',account,1,'2024-01-01','Moradia',manual])
  assert.equal(result.id,manual);assert.equal(result.linked,true)
  assert.equal((await state('2024-01')).items.find(i=>i.id===plan).paidAmountCents,5500)
  assert.equal(await scalar('select count(*) from public.entries'),count);assert.equal(await scalar('select count(*) from public.gamification_events'),events)
  await assert.rejects(call('pay_recurring_expense',[plan,'2024-02-01',account,1,'2024-01-01','Moradia',manual]))
  await login(b);await assert.rejects(call('pay_recurring_expense',[plan,'2024-01-01',account,1,'2024-01-01','Moradia',manual]));await login(a)
 })
 await check('acesso anônimo bloqueado',async()=>{await db.exec('reset role;set role anon');await assert.rejects(state('2024-02'));await assert.rejects(call('stop_recurring_expense',[rid]))})
 console.log(`${checks} cenários de recorrências aprovados. Concorrência multiconexão não é simulada pelo PGlite.`)
}catch(error){console.error(error.message);process.exitCode=1}finally{await db.close()}

