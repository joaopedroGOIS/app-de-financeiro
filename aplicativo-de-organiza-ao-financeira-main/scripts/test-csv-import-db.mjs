import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
const {PGlite}=await import(pathToFileURL(resolve(process.argv[2]||'preview/sql-runtime/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite();let checks=0
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
const call=(name,args=[])=>scalar(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args)
const check=async(name,fn)=>{await fn();checks++;console.log('OK '+name)}
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon;`)
 const dir=new URL('../../supabase/migrations/',import.meta.url)
 for(const name of (await readdir(dir)).filter(n=>n.endsWith('.sql')).sort()){
  await db.exec(await readFile(new URL(name,dir),'utf8'))
  if(name==='20261014000000_user_categories.sql')await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated')
 }
 const u='11111111-1111-4111-8111-111111111111',v='22222222-2222-4222-8222-222222222222'
 await db.query('insert into auth.users(id) values($1),($2)',[u,v])
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u])
 const account=await scalar("insert into public.accounts(user_id,name,type) values(auth.uid(),'Conta','corrente') returning id")
 const card=(await call('save_credit_card',[null,'Cartão','1234',100000,20,28,'csv-test-card-001'])).id
 const row={line:2,title:'Mercado CSV',date:'2026-10-10',type:'expense',amountCents:12345,category:'Alimentação',note:'CSV teste'}
 const run=(rows,commit=false,dest='account',id=account)=>call('import_csv',[dest,id,JSON.stringify(rows),commit,dest==='card'?'2026-10-01':null])
 await check('prévia não escreve e identifica duplicados no próprio arquivo',async()=>{assert.deepEqual((await run([row,{...row,line:3}])).rows.map(r=>r.status),['ready','duplicate']);assert.equal(Number(await scalar('select count(*) from public.entries')),0)})
 await check('importação reutiliza registro financeiro e não duplica no reenvio',async()=>{assert.deepEqual((await run([row,{...row,line:3}],true)).rows.map(r=>r.status),['imported','duplicate']);assert.equal((await run([row],true)).rows[0].status,'duplicate');assert.equal(Number(await scalar('select count(*) from public.entries')),1)})
 await check('diferença de categoria não burla deduplicação',async()=>assert.equal((await run([{...row,category:'Outros'}],true)).rows[0].status,'duplicate'))
 await check('compara também lançamento manual existente',async()=>{await call('create_entry_v2',[account,'  Compra   manual ','Outros','','expense',300,'2026-10-09','','manual-test-001']);assert.equal((await run([{...row,title:'compra manual',date:'2026-10-09',amountCents:300}])).rows[0].status,'duplicate')})
 await check('erro em uma linha desfaz o lote inteiro',async()=>{await assert.rejects(run([{...row,title:'Não persistir'},{...row,title:'Inválida',category:'Não existe'}],true),/categoria/);assert.equal(Number(await scalar("select count(*) from public.entries where title='Não persistir'")),0)})
 await check('cartão cria compra e parcela sem despesa bancária duplicada',async()=>{const before=Number(await scalar('select count(*) from public.entries'));assert.equal((await run([row],true,'card',card)).rows[0].status,'imported');assert.equal((await run([row],true,'card',card)).rows[0].status,'duplicate');assert.equal(Number(await scalar('select count(*) from public.card_installments')),1);assert.equal(Number(await scalar('select count(*) from public.entries')),before)})
 await check('cartão rejeita pagamento, parcela e limite excedido',async()=>{await assert.rejects(run([{...row,title:'Compra 2/10'}],true,'card',card),/Parcelas/);await assert.rejects(run([{...row,title:'Pagamento fatura'}],true,'card',card),/Parcelas/);await assert.rejects(run([{...row,title:'Muito caro',amountCents:100000}],true,'card',card),/limite/);await assert.rejects(run([{...row,type:'income'}],true,'card',card),/apenas compras/)})
 await check('arquivar não permite importar novamente',async()=>{const id=await scalar('select id from public.entries where title=$1',[row.title]);await call('archive_entry',[id]);assert.equal((await run([row],true)).rows[0].status,'duplicate')})
 await check('cliente não altera trilha de importação',async()=>{await assert.rejects(db.exec('delete from public.csv_import_rows'),/permission denied/)})
 await check('isolamento entre usuários e RLS',async()=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[v]);await assert.rejects(run([row],true),/Conta não encontrada/);assert.equal(Number(await scalar('select count(*) from public.csv_import_rows')),0)})
 await check('usuário anônimo não importa',async()=>{await db.exec('set role anon');await assert.rejects(run([row],true),/permission denied/)})
 console.log(`${checks} testes PostgreSQL aprovados`)
}finally{await db.close()}
