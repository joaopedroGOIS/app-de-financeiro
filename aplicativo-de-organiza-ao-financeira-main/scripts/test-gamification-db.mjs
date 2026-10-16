// Integração PostgreSQL descartável. Configurações adicionais test-only nunca são publicadas.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
const {PGlite}=await import(process.argv[2]?pathToFileURL(resolve(process.argv[2])).href:'@electric-sql/pglite')
const db=new PGlite(); let count=0; let currentUser; let account
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
const call=(fn,args=[])=>scalar(`select public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args)
const admin=()=>db.exec('reset role')
const login=async(id=currentUser)=>{await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);currentUser=id}
const check=async(name,fn)=>{await fn();count++;console.log('OK '+name)}
const today=()=>scalar("select ((now() at time zone 'America/Sao_Paulo')::date)::text")
const dayOffset=async(n)=>scalar("select (((now() at time zone 'America/Sao_Paulo')::date)+$1::integer)::text",[n])
const state=()=>call('gamification_state')
const pump=()=>call('process_my_rewards')
const fresh=async()=>{await admin();const id=randomUUID();await db.query('insert into auth.users(id) values($1)',[id]);await login(id);account=await scalar("insert into public.accounts(user_id,name,type) values(auth.uid(),'Conta','corrente') returning id");return id}
const entry=async(amount=100,type='expense',date,key=randomUUID())=>call('create_entry_v2',[account,'Registro real',type==='expense'?'Alimentação':type==='income'?'Salário':'Ajuste de saldo','',type,amount,date??await today(),'',key])
// Simula somente o relógio do SERVIDOR no banco de teste. O cliente não recebe esse poder.
const historicalActivity=async(day)=>{
 await admin();const id=await scalar("insert into public.entries(user_id,account_id,title,category,type,amount_cents,date) values($1,$2,'Histórico','Alimentação','expense',100,$3) returning id",[currentUser,account,day]);
 await db.query("insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id,occurred_at,config_version) values($1,'expense_recorded',$2,$3,'entry',$4,$2::date+time '15:00','economy_v1_20261015')",[currentUser,day,randomUUID(),id]);await login();
}
let fixtureVersion=0
const fixtureConfig=async(rules)=>{
 await admin();await db.exec("update public.economy_config_versions set status='retired' where status='active'");
 const config=JSON.parse(await readFile(new URL('../config/economy-v1.json',import.meta.url),'utf8')).parameters;
 const version='test-only-'+(++fixtureVersion);await db.query("insert into public.economy_config_versions(version,status,parameters,source) values($1,'active',$2,'Fixtures de teste isoladas')",[version,JSON.stringify({...config,rules})]);await login();return version
}
const registration=(code,xp,graninha=0)=>({code,kind:'registration',event_type:'expense_recorded',period:'day',max_claims:2,limit_group:code,xp,graninha})
try {
 await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon;")
 for(const file of ['20261013233000_initial_schema.sql','20261014000000_user_categories.sql','20261015000000_credit_cards.sql','20261015010000_card_purchase_interest.sql','20261015020000_gamification_engine.sql','20261015030000_approved_economy.sql']) await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'))
 await fresh()
 await check('registro financeiro elegível concede 5 XP e nenhuma Graninha',async()=>{await entry(2000);assert.equal((await pump()).failed,0);const s=await state();assert.equal(s.progress.xp_total,5);assert.equal(s.progress.graninha_balance,0);assert.equal(s.streak,1)})
 await check('vários registros e valores altos não multiplicam o hábito diário',async()=>{await entry(200000);await entry(500,'income');await pump();assert.equal((await state()).progress.xp_total,5)})
 await check('repetição de requisição retorna o mesmo registro e ledger permanece único',async()=>{const k=randomUUID(),a=await entry(100,'expense',undefined,k),b=await entry(100,'expense',undefined,k);assert.equal(a.id,b.id);await pump();await pump();assert.equal((await state()).rewards.length,1)})
 await check('ajustes técnicos não recebem XP nem iniciam sequência',async()=>{await fresh();await entry(-100,'adjustment');await pump();const s=await state();assert.equal(s.progress.xp_total,0);assert.equal(s.streak,0)})
 await check('lançamento retroativo conta somente para o dia da ação no servidor',async()=>{await fresh();await entry(100,'expense',await dayOffset(-20));await pump();assert.equal((await state()).streak,1);assert.equal(Number(await scalar('select count(*) from public.activity_days')),1)})
 await check('streak atualiza uma vez por dia e concede marco de 3 dias uma vez por usuário',async()=>{
 await fresh();await historicalActivity(await dayOffset(-2));await historicalActivity(await dayOffset(-1));await entry();await pump();let s=await state();assert.equal(s.streak,3);assert.equal(s.progress.xp_total,25);assert.equal(s.progress.graninha_balance,10);assert.equal(s.streakMilestones.length,1);await entry();await pump();assert.equal((await state()).progress.xp_total,25)
 })
 await check('quebra de sequência não remove prêmios históricos',async()=>{
 await fresh();for(const n of [-8,-7,-6])await historicalActivity(await dayOffset(n));await pump();const before=(await state()).progress.xp_total;await entry();await pump();const after=await state();assert.equal(after.streak,1);assert.equal(after.progress.xp_total,before+5);assert.equal(after.progress.graninha_balance,10)
 })
 await check('novo ciclo não repete prêmio do marco já conquistado',async()=>{
 await fresh();for(const n of [-8,-7,-6,-2,-1])await historicalActivity(await dayOffset(n));await entry();await pump();const s=await state();assert.equal(s.streak,3);assert.equal(s.progress.graninha_balance,10);assert.equal(s.streakMilestones.length,2)
 })
 await check('dia sem gastos exige confirmação e é alternativo ao registro diário',async()=>{
 await fresh();assert.equal((await state()).progress.xp_total,0);await call('complete_financial_routine',['no_expense_day']);await pump();assert.equal((await state()).progress.xp_total,5);await entry();await pump();assert.equal((await state()).progress.xp_total,5);await assert.rejects(call('complete_financial_routine',['no_expense_day']),/gastos/)
 })
 await check('revisões semanais e mensais têm limite e não são concedidas por navegar',async()=>{
 await fresh();await assert.rejects(call('complete_financial_routine',['weekly_review_completed']),/movimentações/);await entry();await pump();await state();assert.equal((await state()).progress.xp_total,5);
 for(let i=0;i<2;i++){await call('complete_financial_routine',['weekly_review_completed']);await call('complete_financial_routine',['monthly_review_completed']);await pump()}
 assert.equal((await state()).progress.xp_total,35)
 })
 await check('edição e arquivamento registram auditoria sem emitir nova recompensa',async()=>{
 await fresh();const e=await entry();await pump();await db.query("update public.entries set amount_cents=200 where id=$1",[e.id]);await call('archive_entry',[e.id]);await pump();assert.equal((await state()).progress.xp_total,5);assert.equal(Number(await scalar("select count(*) from public.gamification_events where event_type='financial_entry_updated'")),1);await entry();await pump();assert.equal((await state()).progress.xp_total,5)
 })
 await check('entrada arquivada antes de processar não concede recompensa',async()=>{await fresh();const e=await entry();await call('archive_entry',[e.id]);await pump();assert.equal((await state()).progress.xp_total,0)})
 await check('cartão e pagamento de fatura não concedem XP sem regra aprovada',async()=>{
 await fresh();const c=(await call('save_credit_card',[null,'Cartão','1234',100000,20,28,randomUUID()])).id;await call('create_card_purchase',[c,'Compra','Compras','',1000,await today(),1,null,'',randomUUID()]);const card=await call('credit_card_state');await call('pay_card_bill',[c,card.installments[0].bill_month,account,1000,await today(),'',randomUUID()]);await pump();assert.equal((await state()).progress.xp_total,0);await assert.rejects(call('complete_financial_routine',['no_expense_day']),/gastos/)
 })
 await check('isolamento: usuário não lê nem processa recompensas alheias',async()=>{
 const owner=await fresh();await entry();await pump();const other=await fresh();assert.notEqual(owner,other);assert.equal((await state()).rewards.length,0);assert.equal(Number(await scalar('select count(*) from public.reward_ledger')),0);await assert.rejects(call('process_reward_event',[randomUUID()]),/permission denied/)
 })
 await check('cliente não escreve XP, Graninha, eventos, histórico, configurações ou dificuldade',async()=>{
 for(const sql of ["update public.player_progress set xp_total=999", "insert into public.economy_config_versions(version,status,parameters,source) values('hack','draft','{}','hack')", "delete from public.reward_ledger", "insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id) values(auth.uid(),'expense_recorded',current_date,'forged-event','entry',gen_random_uuid())", "insert into public.difficulty_assessments(user_id,goal_id,difficulty_code,inputs_json,result_json,confidence_level,formula_version) values(auth.uid(),gen_random_uuid(),'Fácil','{}','{}','alta','hack')", "update public.entries set created_at=now()-interval '1 year'", "delete from public.entries"] )await assert.rejects(db.exec(sql),/permission denied/)
 })
 await check('classes usam somente reserva elegível e guardam subidas e descidas',async()=>{
 await fresh();await db.query('update public.accounts set is_reserve=true where id=$1',[account]);assert.equal((await call('financial_class_state')).name,'Quebradinho');await entry(200000,'income');assert.equal((await call('financial_class_state')).name,'Poupador');await entry(180001);let c=await call('financial_class_state');assert.equal(c.name,'Quebradinho');assert(c.history.some(x=>x.class_code==='Poupador'));await scalar("insert into public.assets(user_id,name,kind,amount_cents) values(auth.uid(),'Imóvel','asset',100000000) returning id");assert.equal((await call('financial_class_state')).name,'Quebradinho')
 })
 await check('todos os limites de classe em centavos, com contas não elegíveis excluídas',async()=>{
 await fresh();await db.query('update public.accounts set opening_cents=100000000 where id=$1',[account]);assert.equal((await call('financial_class_state')).name,'Quebradinho');await db.query('update public.accounts set is_reserve=true where id=$1',[account]);
 for(const [value,name] of [[0,'Quebradinho'],[49999,'Quebradinho'],[50000,'Juntador'],[199999,'Juntador'],[200000,'Poupador'],[499999,'Poupador'],[500000,'Rico de Ideia'],[999999,'Rico de Ideia'],[1000000,'Patrão'],[2499999,'Patrão'],[2500000,'Ricasso'],[4999999,'Ricasso'],[5000000,'Magnata'],[9999999,'Magnata'],[10000000,'Tio Gansinhas']]){await db.query('update public.accounts set opening_cents=$1 where id=$2',[value,account]);assert.equal((await call('financial_class_state')).name,name)}
 })
 await check('Metas registram vários marcos sem prêmios ainda pendentes de validação real',async()=>{
 await fresh();const g=await scalar("insert into public.goals(user_id,title,kind,target_cents) values(auth.uid(),'Meta','meta',200000) returning id");const a=await call('create_contribution',[g,60000,await today(),'',randomUUID()]);assert.deepEqual(a.milestonesReached,[10,25]);await pump();assert.equal((await state()).progress.xp_total,0);assert.equal((await state()).milestones.length,2)
 })
 await check('Sonho sem histórico suficiente permanece sem dificuldade e sem prêmio',async()=>{
 await fresh();const g=await scalar("insert into public.goals(user_id,title,kind,target_cents) values(auth.uid(),'Sonho','sonho',500000) returning id");assert.equal((await call('assess_dream',[g])).status,'insufficient');await call('create_contribution',[g,50000,await today(),'',randomUUID()]);await pump();assert.equal((await state()).progress.xp_total,0)
 })
 await check('dificuldade dinâmica usa mediana de seis meses, 70%, e inclui 48 meses em Muito difícil',async()=>{
 await fresh();await admin();for(let i=1;i<=6;i++){const d=await scalar("select (date_trunc('month',now())-make_interval(months=>$1))::date::text",[i]);await db.query("insert into public.entries(user_id,account_id,title,category,type,amount_cents,date) values($1,$2,'Renda','Salário','income',100000,$3)",[currentUser,account,d])}await login();
 const g=await scalar("insert into public.goals(user_id,title,kind,target_cents) values(auth.uid(),'Sonho','sonho',3360000) returning id");let a=await call('assess_dream',[g]);assert.equal(a.capacityCents,70000);assert.equal(a.difficulty,'Muito difícil');await call('create_contribution',[g,3000000,await today(),'',randomUUID()]);a=await call('assess_dream',[g]);assert.equal(a.difficulty,'Fácil');assert(Number(await scalar('select count(*) from public.difficulty_assessments where goal_id=$1',[g]))>=2)
 })
 // Daqui em diante regras de fixture exercitam contratos que aguardam condições oficiais.
 await check('motor de missão conclui uma vez por período, separado dos eventos financeiros',async()=>{
 await fixtureConfig([{...registration('test_mission',25,25),kind:'mission',period:'week',max_claims:1,minimum_days:1}]);await fresh();await entry();await entry();await pump();assert.equal((await state()).progress.xp_total,25);assert.equal((await state()).behaviors.length,1);assert.equal((await state()).rewards.length,2)
 })
 await check('marcos de Meta usam tabela própria e não repetem após edição ou retry',async()=>{
 await fixtureConfig([10,25,50,75,100].map((m,i)=>({...registration('test_goal_'+m,[20,30,50,75,150][i],[15,25,40,60,150][i]),kind:'goal',event_type:'goal_progress_added',goal_kind:'meta',milestone:m,evidence_policy:'declared_progress_approved',period:'lifetime',max_claims:10})));
 await fresh();const g=await scalar("insert into public.goals(user_id,title,kind,target_cents) values(auth.uid(),'Meta','meta',200000) returning id");const k=randomUUID();await call('create_contribution',[g,60000,await today(),'',k]);await pump();assert.equal((await state()).progress.xp_total,50);await call('create_contribution',[g,60000,await today(),'',k]);await db.query('update public.goals set target_cents=240000 where id=$1',[g]);await call('create_contribution',[g,1,await today(),'',randomUUID()]);await pump();assert.equal((await state()).progress.xp_total,50)
 })
 await check('concessão de Sonho guarda dificuldade e versão da fórmula sem reavaliar retroativamente',async()=>{
 await fixtureConfig([{...registration('test_dream',40,0),kind:'goal',event_type:'goal_progress_added',goal_kind:'sonho',milestone:10,difficulty:'fácil',evidence_policy:'declared_progress_approved',period:'lifetime',max_claims:10}]);await fresh();await admin();for(let i=1;i<=6;i++){const d=await scalar("select (date_trunc('month',now())-make_interval(months=>$1))::date::text",[i]);await db.query("insert into public.entries(user_id,account_id,title,category,type,amount_cents,date) values($1,$2,'Renda','Salário','income',100000,$3)",[currentUser,account,d])}await login();const g=await scalar("insert into public.goals(user_id,title,kind,target_cents) values(auth.uid(),'Sonho','sonho',100000) returning id");await call('create_contribution',[g,10000,await today(),'',randomUUID()]);await pump();let s=await state();assert.equal(s.progress.xp_total,40);assert.equal(s.rewards[0].metadata.formula_version,'difficulty_formula_v1');await db.query('update public.goals set target_cents=10000000 where id=$1',[g]);await call('assess_dream',[g]);assert.equal((await state()).rewards[0].metadata.difficulty.difficulty,'Fácil')
 })
 await check('subida e passagem por vários níveis preservam o total e não geram Graninha extra',async()=>{await fixtureConfig([registration('test_levels',3000)]);await fresh();await entry();await pump();const s=await state();assert.equal(s.progress.xp_total,3000);assert.equal(s.progress.level,12);assert.equal(s.progress.graninha_balance,0)})
 await check('evolução dos 100 níveis, limites anteriores e teto',async()=>{
 const levels=JSON.parse(await readFile(new URL('../config/economy-v1.json',import.meta.url),'utf8')).parameters.levels;
 await fresh();for(let i=0;i<100;i++){await admin();await db.query('update public.player_progress set xp_total=$1 where user_id=$2',[levels[i],currentUser]);await login();const s=await state();assert.equal(s.progress.level,i+1);assert.equal(s.progress.currentLevelXp,levels[i]);assert.equal(s.progress.nextLevelXp,levels[i+1]??null);if(i>0){await admin();await db.query('update public.player_progress set xp_total=$1 where user_id=$2',[levels[i]-1,currentUser]);await login();assert.equal((await state()).progress.level,i)}}await admin();await db.query('update public.player_progress set xp_total=200000 where user_id=$1',[currentUser]);await login();assert.equal((await state()).progress.level,100)
 })
 await check('duas chamadas simultâneas de processamento não duplicam concessões',async()=>{await fixtureConfig([registration('test_parallel',5),{...registration('test_parallel_b',15),event_type:'income_recorded'}]);await fresh();await entry();await entry(100,'income');await Promise.all([pump(),pump()]);assert.equal((await state()).progress.xp_total,20)})
 await check('falha de gamificação mantém finanças e reprocessa atomicamente sem duplicação',async()=>{
 await fixtureConfig([registration('test_failure',5,10)]);await fresh();await admin();await db.exec("create function public.test_fail_reward() returns trigger language plpgsql as $$ begin if new.reward_type='graninha' then raise exception 'test failure'; end if; return new; end $$; create trigger test_failure before insert on public.reward_ledger for each row execute function public.test_fail_reward()");await login();await entry();assert.equal((await pump()).failed,1);assert.equal(Number(await scalar('select count(*) from public.entries')),1);assert.equal((await state()).progress.xp_total,0);assert.equal((await state()).rewards.length,0);await admin();await db.exec('drop trigger test_failure on public.reward_ledger');await login();await pump();await pump();const s=await state();assert.equal(s.progress.xp_total,5);assert.equal(s.progress.graninha_balance,10);assert.equal(s.rewards.length,2)
 })
 await check('ledger histórico imutável e ajustes append-only reconciliam a projeção',async()=>{
 const old=(await state()).rewards.find(r=>r.reward_type==='xp');await admin();await assert.rejects(db.query('update public.reward_ledger set amount=999 where id=$1',[old.id]),/immutable/);const id=await call('adjust_reward',[old.id,-2,'Correção administrativa de teste','test-adjust-0001']);assert.equal(await call('adjust_reward',[old.id,-2,'Correção administrativa de teste','test-adjust-0001']),id);await login();assert.equal((await state()).progress.xp_total,3);assert.equal(Number(await scalar("select sum(amount) from public.reward_ledger where reward_type='xp'")),3)
 })
 await check('configuração publicada não pode alterar recompensas históricas',async()=>{await admin();await assert.rejects(db.exec("update public.economy_config_versions set parameters='{}' where status='active'"),/imutáveis/);await login()})
 await check('eventos sem configuração ficam pendentes sem atribuição retroativa silenciosa',async()=>{await admin();await db.exec("update public.economy_config_versions set status='retired' where status='active'");await fresh();await entry();assert.equal((await state()).awaitingConfig,1);await fixtureConfig([registration('test_after',5)]);await pump();assert.equal((await state()).progress.xp_total,0)})
 await check('acesso anônimo aos RPCs e dados é negado',async()=>{await db.exec('set role anon');for(const fn of ['gamification_state','process_my_rewards','financial_class_state'])await assert.rejects(call(fn),/permission denied/);await assert.rejects(db.query('select * from public.reward_ledger'),/permission denied/)})
 console.log(`${count} cenários de integração passaram. PGlite serializa as chamadas: concorrência multiconexão exige PostgreSQL externo.`)
} catch(error) {console.error('FALHA:',error.message,error.where??'');globalThis.process.exitCode=1} finally {await db.close()}
