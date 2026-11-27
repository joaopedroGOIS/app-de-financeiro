// Integração PostgreSQL descartável (PGlite): aparência do personagem, fase 1 do Perfil.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
const {PGlite}=await import(process.argv[2]?pathToFileURL(resolve(process.argv[2])).href:'@electric-sql/pglite')
const db=new PGlite()
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0] ?? {})[0]
const login=async(id)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')}
let count=0;const check=async(name,fn)=>{await fn();count++;console.log('OK '+name)}
await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon;")
const dir=new URL('../../supabase/migrations/',import.meta.url)
const files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort()
// Linha antiga de preferências criada ANTES da migration nova: ela precisa sobreviver intacta.
const before=files.filter(f=>f<'20261127000000');const after=files.filter(f=>f>='20261127000000')
for(const f of before)await db.exec(await readFile(new URL(f,dir),'utf8'))
const a=randomUUID(),b=randomUUID()
await db.query('insert into auth.users(id) values($1),($2)',[a,b])
await db.query("insert into public.user_preferences(user_id,theme) values($1,'light')",[a])
for(const f of after)await db.exec(await readFile(new URL(f,dir),'utf8'))
await check('linha existente ganha os valores padrão e mantém o tema',async()=>{await login(a);const r=(await db.query('select theme,avatar_skin,avatar_hair_color from public.user_preferences')).rows[0];assert.deepEqual(r,{theme:'light',avatar_skin:1,avatar_hair_color:0})})
await check('jogador altera a própria aparência sem mexer no tema',async()=>{await login(a);await db.query('insert into public.user_preferences(user_id,avatar_skin,avatar_hair_color) values(auth.uid(),3,5) on conflict(user_id) do update set avatar_skin=excluded.avatar_skin,avatar_hair_color=excluded.avatar_hair_color');const r=(await db.query('select theme,avatar_skin,avatar_hair_color from public.user_preferences')).rows[0];assert.deepEqual(r,{theme:'light',avatar_skin:3,avatar_hair_color:5})})
await check('salvar o tema depois não apaga a aparência',async()=>{await login(a);await db.query("insert into public.user_preferences(user_id,theme) values(auth.uid(),'dark') on conflict(user_id) do update set theme=excluded.theme");const r=(await db.query('select theme,avatar_skin,avatar_hair_color from public.user_preferences')).rows[0];assert.deepEqual(r,{theme:'dark',avatar_skin:3,avatar_hair_color:5})})
await check('valores fora da paleta são recusados',async()=>{await login(a);await assert.rejects(db.query('update public.user_preferences set avatar_skin=4'));await assert.rejects(db.query('update public.user_preferences set avatar_hair_color=-1'))})
await check('novo jogador recebe a aparência padrão',async()=>{await login(b);await db.query("insert into public.user_preferences(user_id,theme) values(auth.uid(),'system')");const r=(await db.query('select avatar_skin,avatar_hair_color from public.user_preferences')).rows[0];assert.deepEqual(r,{avatar_skin:1,avatar_hair_color:0})})
await check('um jogador não lê nem altera a aparência de outro',async()=>{await login(b);assert.equal((await db.query('select * from public.user_preferences where user_id=$1',[a])).rows.length,0);await db.query('update public.user_preferences set avatar_skin=0 where user_id=$1',[a]);await login(a);assert.equal(await scalar('select avatar_skin from public.user_preferences'),3)})
await check('o script de desfazer remove só as colunas novas',async()=>{await db.exec('reset role');await db.exec(await readFile(new URL('../../supabase/rollbacks/20261127000000_avatar_appearance.down.sql',import.meta.url),'utf8'));const cols=(await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='user_preferences' order by column_name")).rows.map(r=>r.column_name);assert.deepEqual(cols,['theme','updated_at','user_id']);await login(a);assert.equal(await scalar('select theme from public.user_preferences'),'dark')})
console.log(`${count} verificações de aparência aprovadas`)
