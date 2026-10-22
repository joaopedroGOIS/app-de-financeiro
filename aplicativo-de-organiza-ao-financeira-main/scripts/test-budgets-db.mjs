import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2])).href)
const db=new PGlite()
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
const login=async(id)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
try{
 await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon;")
 for(const file of ['20261013233000_initial_schema.sql','20261014000000_user_categories.sql','20261015000000_credit_cards.sql','20261015010000_card_purchase_interest.sql','20261015020000_gamification_engine.sql','20261015030000_approved_economy.sql','20261016000000_complete_rewards.sql','20261022000000_monthly_budgets.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'))
 const a=randomUUID(),b=randomUUID()
 await db.query('insert into auth.users(id) values($1),($2)',[a,b]);await login(a)
 const account=await scalar("insert into public.accounts(user_id,name,type) values(auth.uid(),'Conta','corrente') returning id")
 const card=await scalar("select public.save_credit_card(null,'Cartão','',1000000,20,28,'budget-card-test')")
 // Insert card fixture administratively; all reads and budget mutations use the real authenticated role.
 await db.exec('reset role')
 const cardId=await scalar('select id from public.credit_cards where user_id=$1',[a])
 const purchaseId=await scalar("insert into public.card_purchases(user_id,card_id,title,category,amount_cents,purchase_date,installment_count) values($1,$2,'Compra','Alimentação',10000,'2026-10-01',2) returning id",[a,cardId])
 await db.query("insert into public.card_installments(user_id,purchase_id,card_id,installment_number,amount_cents,due_date,bill_month) values($1,$2,$3,1,5000,'2026-10-28','2026-10-01'),($1,$2,$3,2,5000,'2026-11-28','2026-11-01')",[a,purchaseId,cardId])
 await db.query("insert into public.card_payments(user_id,card_id,account_id,bill_month,amount_cents,payment_date) values($1,$2,$3,'2026-10-01',5000,'2026-10-20')",[a,cardId,account])
 await db.query("insert into public.entries(user_id,account_id,title,category,type,amount_cents,date) select $1,$2,'Gasto','Alimentação','expense',100,'2026-10-01' from generate_series(1,1005)",[a,account])
 await db.query("insert into public.entries(user_id,account_id,title,category,type,amount_cents,date,archived_at) values($1,$2,'Arquivada','Alimentação','expense',90000,'2026-10-02',now()),($1,$2,'Renda','Salário','income',90000,'2026-10-01',null),($1,$2,'Ajuste','Ajuste de saldo','adjustment',90000,'2026-10-01',null)",[a,account])
 const snapshot=await db.query('select xp_total,graninha_balance from public.player_progress where user_id=$1',[a])
 const events=await scalar('select count(*) from public.gamification_events')
 await login(a)
 await db.query("insert into public.monthly_budgets(user_id,month,category,limit_cents) values($1,'2026-10-01','Alimentação',100000) on conflict(user_id,month,category) do update set limit_cents=excluded.limit_cents",[a])
 await db.query("insert into public.monthly_budgets(user_id,month,category,limit_cents) values($1,'2026-10-01','Alimentação',110000) on conflict(user_id,month,category) do update set limit_cents=excluded.limit_cents",[a])
 const state=await scalar("select public.monthly_budget_state('2026-10-01')")
 assert.equal(state.budgets.length,1);assert.equal(state.budgets[0].limitCents,110000);assert.equal(state.spending[0].spentCents,105500)
 assert.equal((await scalar("select public.monthly_budget_state('2026-11-01')")).spending[0].spentCents,5000)
 await assert.rejects(db.exec("insert into public.monthly_budgets(user_id,month,category,limit_cents) values(auth.uid(),'2026-10-01','Teste',0)"))
 await assert.rejects(db.exec("select public.monthly_budget_state('2026-10-02')"))
 await login(b)
 assert.deepEqual(await scalar("select public.monthly_budget_state('2026-10-01')"),{budgets:[],spending:[]})
 assert.equal(await scalar('select count(*) from public.monthly_budgets'),0)
 await assert.rejects(db.query("insert into public.monthly_budgets(user_id,month,category,limit_cents) values($1,'2026-10-01','Outra',10)",[a]))
 await db.query('delete from public.monthly_budgets where id=$1',[state.budgets[0].id])
 await login(a);assert.equal(await scalar('select count(*) from public.monthly_budgets'),1)
 await db.query('delete from public.monthly_budgets where id=$1',[state.budgets[0].id])
 await db.exec('reset role')
 assert.deepEqual(await db.query('select xp_total,graninha_balance from public.player_progress where user_id=$1',[a]),snapshot)
 assert.equal(await scalar('select count(*) from public.gamification_events'),events)
 await db.exec('set role anon');await assert.rejects(db.exec("select public.monthly_budget_state('2026-10-01')"))
 console.log('Orçamento SQL aprovado: agregação de 1005 despesas, parcelas por vencimento, sem duplicar pagamentos, isolamento, atualização única, validações e nenhuma recompensa adicional.')
}finally{await db.close()}

