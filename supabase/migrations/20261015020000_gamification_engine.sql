-- Reutiliza o ledger/progresso existentes. Nenhum valor econômico oficial é inventado.
create table public.economy_config_versions (
  version text primary key,
  status text not null check(status in ('draft','active','retired')),
  effective_from timestamptz not null default now(),
  parameters jsonb not null,
  source text not null check(length(trim(source))>0),
  created_at timestamptz not null default now()
);
create unique index economy_one_active on public.economy_config_versions(status) where status='active';
insert into public.economy_config_versions(version,status,parameters,source)
values('v1.0-pending','draft','{"levels":[],"rules":[]}', 'Documento mestre v1.0: valores e curva ausentes; aguardando definição oficial');

alter table public.gamification_events
  add column config_version text references public.economy_config_versions(version),
  add column processing_status text not null default 'pending' check(processing_status in ('pending','processed','awaiting_config','failed')),
  add column attempts integer not null default 0,
  add column last_error text,
  add column processed_at timestamptz,
  add column activity_date date,
  add column timezone text not null default 'America/Sao_Paulo';
update public.gamification_events set processing_status=case when processed then 'processed' else 'awaiting_config' end,
  activity_date=(occurred_at at time zone 'America/Sao_Paulo')::date;
create index events_pending_user on public.gamification_events(user_id,occurred_at,id) where not processed;
alter table public.reward_ledger add column claim_key text, add column metadata jsonb not null default '{}'::jsonb,
  add column adjustment_of uuid references public.reward_ledger(id);
create unique index reward_claim_once on public.reward_ledger(user_id,claim_key,reward_type) where claim_key is not null;
alter table public.player_progress add column curve_version text;

-- Ponto de partida auditável: preserva projeções e ledger legados, sem conceder novamente.
create table public.progress_baselines (
  user_id uuid primary key references auth.users(id), xp_total bigint not null,
  graninha_balance bigint not null, ledger_xp bigint not null, ledger_graninha bigint not null,
  created_at timestamptz not null default now()
);
insert into public.progress_baselines(user_id,xp_total,graninha_balance,ledger_xp,ledger_graninha)
select p.user_id,p.xp_total,p.graninha_balance,
 coalesce((select sum(amount) from public.reward_ledger where user_id=p.user_id and reward_type='xp'),0),
 coalesce((select sum(amount) from public.reward_ledger where user_id=p.user_id and reward_type='graninha'),0)
from public.player_progress p;

create table public.activity_days (
 user_id uuid not null references auth.users(id), day date not null, event_id uuid not null references public.gamification_events(id),
 primary key(user_id,day)
);
create table public.streak_milestone_claims (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 cycle_start date not null, milestone integer not null check(milestone in (3,7,14,30,60,100,365)),
 event_id uuid not null references public.gamification_events(id), created_at timestamptz not null default now(),
 unique(user_id,cycle_start,milestone)
);
create table public.behavior_completions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 code text not null, kind text not null check(kind in ('habit','mission')), period_start date not null,
 event_id uuid not null references public.gamification_events(id), config_version text not null references public.economy_config_versions(version),
 created_at timestamptz not null default now(), unique(user_id,code,period_start)
);
create table public.reward_claims (
 user_id uuid not null references auth.users(id), claim_key text not null,
 rule_code text not null, limit_group text not null, period_start date not null,
 event_id uuid not null references public.gamification_events(id), config_version text not null references public.economy_config_versions(version),
 created_at timestamptz not null default now(), primary key(user_id,claim_key)
);

create function public.validate_economy_config() returns trigger language plpgsql set search_path='' as $$
declare r jsonb; i integer; prior bigint := -1; threshold bigint; seen text[]:=array[]::text[];
begin
 if tg_op='DELETE' then raise exception 'Configurações históricas não podem ser removidas'; end if;
 if tg_op='UPDATE' and ((old.status='active' and new.status='draft') or (old.status='retired' and new.status<>'retired')) then raise exception 'Versão publicada não volta a rascunho ou ativa'; end if;
 if tg_op='UPDATE' and old.status<>'draft' and (new.parameters<>old.parameters or new.version<>old.version or new.effective_from<>old.effective_from or new.source<>old.source) then
   raise exception 'Crie outra versão econômica; configurações publicadas são imutáveis';
 end if;
 if new.status='active' then
   if jsonb_typeof(new.parameters->'levels') is distinct from 'array' or jsonb_array_length(new.parameters->'levels')<>100
     or jsonb_typeof(new.parameters->'rules') is distinct from 'array' then raise exception 'Informe curva de 100 níveis e regras oficiais'; end if;
   for i in 0..99 loop
     if (new.parameters->'levels'->>i) !~ '^[0-9]+$' then raise exception 'Limite de XP inválido'; end if;
     threshold := (new.parameters->'levels'->>i)::bigint;
     if threshold<=prior or threshold>2147483647 or (i=0 and threshold<>0) then raise exception 'Curva deve começar em zero e ser crescente'; end if;
     prior:=threshold;
   end loop;
   for r in select value from jsonb_array_elements(new.parameters->'rules') loop
     if not (r ?& array['code','kind','event_type','period','max_claims','limit_group','xp','graninha'])
       or coalesce(r->>'code','') !~ '^[a-z][a-z0-9_]{2,60}$' or r->>'code'=any(seen)
       or r->>'kind' not in ('registration','habit','mission','goal','streak')
       or r->>'event_type' not in ('financial_activity','expense_recorded','income_recorded','goal_progress_added','no_expense_day','weekly_review_completed','monthly_review_completed')
       or r->>'period' not in ('day','week','month','lifetime')
       or coalesce(r->>'limit_group','') !~ '^[a-z][a-z0-9_]{2,60}$'
       or coalesce(r->>'max_claims','') !~ '^[1-9][0-9]*$'
       or coalesce(r->>'xp','') !~ '^[0-9]+$' or coalesce(r->>'graninha','') !~ '^[0-9]+$'
       then raise exception 'Regra econômica inválida ou sem limites explícitos'; end if;
     if (r->>'xp')::bigint>2147483647 or (r->>'graninha')::bigint>2147483647 then raise exception 'Recompensa fora do intervalo'; end if;
     if r->>'kind' in ('habit','mission') and coalesce(r->>'minimum_days','') !~ '^[1-9][0-9]*$' then raise exception 'Defina dias distintos para o hábito/missão'; end if;
     if r->>'kind'='goal' and (r->>'event_type'<>'goal_progress_added' or coalesce(r->>'goal_kind','') not in ('meta','sonho') or coalesce(r->>'milestone','') not in ('10','25','50','75','100') or coalesce(r->>'evidence_policy','')<>'declared_progress_approved') then raise exception 'Marco exige tipo e política de evidência aprovada'; end if;
     if r->>'kind'='goal' and r->>'goal_kind'='sonho' and coalesce(r->>'difficulty','') not in ('fácil','moderada','difícil','muito_difícil','lendária') then raise exception 'Informe a dificuldade da recompensa'; end if;
     if r->>'kind'='streak' and (coalesce(r->>'repeat_policy','') not in ('once','per_cycle') or coalesce(r->>'milestone','') not in ('3','7','14','30','60','100','365')) then raise exception 'Defina o marco e sua política de repetição'; end if;
     if r->>'kind'<>'goal' and r->>'event_type'='goal_progress_added' then raise exception 'Aportes só participam de regras próprias de marcos'; end if;
     seen:=array_append(seen,r->>'code');
   end loop;
   -- Um grupo tem o mesmo teto/período em todas as regras desta versão.
   if exists(select 1 from jsonb_array_elements(new.parameters->'rules') a, jsonb_array_elements(new.parameters->'rules') b
     where a->>'limit_group'=b->>'limit_group' and (a->>'period'<>b->>'period' or a->>'max_claims'<>b->>'max_claims')) then raise exception 'Limites contraditórios no mesmo grupo'; end if;
 end if;
 return new;
end $$;
create trigger economy_guard before insert or update or delete on public.economy_config_versions for each row execute function public.validate_economy_config();

-- Somente dias observados pelo servidor; a data financeira permanece separada.
create function public.prepare_gamification_event() returns trigger language plpgsql security definer set search_path='' as $$
declare source_row public.entries%rowtype;
begin
 new.activity_date:=(new.occurred_at at time zone 'America/Sao_Paulo')::date;
 if new.config_version is null then
   select version into new.config_version from public.economy_config_versions where status='active' and effective_from<=new.occurred_at;
 end if;
 if new.config_version is null and not new.processed then new.processing_status:='awaiting_config'; end if;
 if new.entity_type='entry' then
   select * into source_row from public.entries where id=new.entity_id and user_id=new.user_id;
   new.payload:=new.payload||jsonb_build_object('original_type',source_row.type,'financial_date',source_row.date);
 end if;
 return new;
end $$;
create trigger event_prepare before insert on public.gamification_events for each row execute function public.prepare_gamification_event();

create function public.track_financial_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare n integer; cursor_day date; start_day date; m integer;
begin
 if (new.event_type in ('expense_recorded','income_recorded') and new.entity_type='entry' and exists(
   select 1 from public.entries where id=new.entity_id and user_id=new.user_id and type in ('income','expense') and archived_at is null
 )) or (new.entity_type='routine' and new.event_type in ('no_expense_day','weekly_review_completed','monthly_review_completed')) then
   -- Serializa o primeiro registro do dia e os marcos de sequência do mesmo usuário.
   perform 1 from public.player_progress where user_id=new.user_id for update;
   insert into public.activity_days values(new.user_id,new.activity_date,new.id) on conflict do nothing;
   n:=0; cursor_day:=new.activity_date;
   while exists(select 1 from public.activity_days where user_id=new.user_id and day=cursor_day) loop n:=n+1; cursor_day:=cursor_day-1; end loop;
   start_day:=cursor_day+1;
   foreach m in array array[3,7,14,30,60,100,365] loop
     if n>=m then insert into public.streak_milestone_claims(user_id,cycle_start,milestone,event_id) values(new.user_id,start_day,m,new.id) on conflict do nothing; end if;
   end loop;
 end if;
 return new;
end $$;
create trigger event_activity after insert on public.gamification_events for each row execute function public.track_financial_activity();

-- Entrada continua criada pelos RPCs idempotentes existentes. Edições geram somente auditoria.
revoke insert,delete,update on public.entries from authenticated;
grant update(account_id,title,category,subcategory,type,amount_cents,date,note) on public.entries to authenticated;
revoke insert on public.difficulty_assessments from authenticated;
create function public.audit_entry_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new is distinct from old and new.archived_at is null then
   insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id,payload)
   values(new.user_id,'financial_entry_updated',new.date,'entry-update:'||gen_random_uuid(),'entry',new.id,
     jsonb_build_object('previous_type',old.type,'previous_date',old.date,'previous_amount_cents',old.amount_cents));
 end if;
 return new;
end $$;
create trigger entry_update_audit after update on public.entries for each row execute function public.audit_entry_update();

create function public.assess_dream(p_goal_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); g public.goals%rowtype; d date:=(now() at time zone 'America/Sao_Paulo')::date;
 saved bigint; remaining bigint; capacity bigint; recorded integer; med numeric; months_left integer; effort numeric;
 result jsonb; inputs jsonb; code text; previous jsonb; months numeric;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into g from public.goals where id=p_goal_id and user_id=u for update;
 if not found or g.kind<>'sonho' then raise exception 'Sonho não encontrado' using errcode='P0002'; end if;
 select coalesce(sum(amount_cents),0) into saved from public.contributions where goal_id=g.id and user_id=u;
 remaining:=greatest(0,g.target_cents-saved);
 with financial as (
   select date,type,amount_cents from public.entries where user_id=u and archived_at is null and type in ('income','expense')
   union all
   select i.due_date,'expense',i.amount_cents from public.card_installments i join public.card_purchases p on p.id=i.purchase_id
     where i.user_id=u and p.archived_at is null
 ), monthly as (
   select date_trunc('month',date) period_month,sum(case when type='income' then amount_cents else -amount_cents end) balance
   from financial where date>=date_trunc('month',d)-interval '6 months' and date<date_trunc('month',d) group by 1
 ) select count(*),(percentile_disc(0.5) within group(order by balance) filter(where balance>0)+percentile_disc(0.5) within group(order by balance desc) filter(where balance>0))/2::numeric,
   coalesce(jsonb_agg(jsonb_build_object('month',period_month,'balanceCents',balance) order by period_month),'[]')
 into recorded,med,inputs from monthly;
 capacity:=floor(med*0.7);
 inputs:=jsonb_build_object('months',inputs,'targetCents',g.target_cents,'savedCents',saved,'deadline',g.deadline,'today',d);
 result:=jsonb_build_object('status','insufficient','confidence','baixa','monthsRecorded',recorded,'formulaVersion','difficulty_formula_v1');
 if recorded=6 and capacity>0 then
   if g.deadline is not null then
     months_left:=greatest(0,(extract(year from g.deadline)::integer-extract(year from d)::integer)*12+extract(month from g.deadline)::integer-extract(month from d)::integer+case when extract(day from g.deadline)>extract(day from d) then 1 else 0 end);
     if months_left=0 and remaining>0 then
       result:=jsonb_build_object('status','expired','confidence','alta','monthsRecorded',recorded,'remainingCents',remaining,'capacityCents',capacity,'formulaVersion','difficulty_formula_v1');
     else
       effort:=case when remaining=0 then 0 else remaining::numeric/months_left/capacity end;
       code:=case when effort<=0.50 then 'Fácil' when effort<=0.75 then 'Moderada' when effort<=1 then 'Difícil' when effort<=1.5 then 'Muito difícil' else 'Lendária' end;
       result:=jsonb_build_object('status','ready','difficulty',code,'confidence','alta','monthsRecorded',recorded,'remainingCents',remaining,'capacityCents',capacity,'monthsLeft',months_left,'needMonthlyCents',case when months_left>0 then ceil(remaining::numeric/months_left) else 0 end,'effortIndex',effort,'formulaVersion','difficulty_formula_v1');
     end if;
   else
     months:=remaining::numeric/capacity;
     code:=case when months<=6 then 'Fácil' when months<=12 then 'Moderada' when months<=24 then 'Difícil' when months<=48 then 'Muito difícil' else 'Lendária' end;
     result:=jsonb_build_object('status','ready','difficulty',code,'confidence','alta','monthsRecorded',recorded,'remainingCents',remaining,'capacityCents',capacity,'estimatedMonths',months,'formulaVersion','difficulty_formula_v1');
   end if;
 end if;
 select inputs_json into previous from public.difficulty_assessments where user_id=u and goal_id=g.id order by calculated_at desc,id desc limit 1;
 if previous is distinct from inputs then
   insert into public.difficulty_assessments(user_id,goal_id,difficulty_code,inputs_json,result_json,confidence_level,formula_version)
   values(u,g.id,coalesce(code,result->>'status'),inputs,result,result->>'confidence','difficulty_formula_v1');
 end if;
 return result;
end $$;

-- Snapshot do marco no instante do aporte: reprocessamento não usa a dificuldade futura.
create or replace function public.create_contribution(p_goal_id uuid,p_amount_cents bigint,p_date date,p_note text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); g public.goals%rowtype; saved bigint; id uuid; prior jsonb; reached integer[]:=array[]::integer[]; m integer; analysis jsonb;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_idempotency_key is null or p_idempotency_key !~ '^[[:alnum:]_:-]{8,120}$' then raise exception 'Idempotency-Key inválida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_idempotency_key,0));
 select response_json into prior from public.request_keys where user_id=u and key=p_idempotency_key;
 if found then return prior; end if;
 select * into g from public.goals where public.goals.id=p_goal_id and user_id=u and archived_at is null for update;
 if not found then raise exception 'Objetivo não encontrado'; end if;
 select coalesce(sum(amount_cents),0) into saved from public.contributions where goal_id=g.id and user_id=u;
 if p_amount_cents is null or p_amount_cents<=0 or saved+p_amount_cents>g.target_cents then raise exception 'O aporte ultrapassa o valor do objetivo' using errcode='23514'; end if;
 insert into public.contributions(user_id,goal_id,amount_cents,date,note) values(u,g.id,p_amount_cents,p_date,coalesce(p_note,'')) returning contributions.id into id;
 foreach m in array array[10,25,50,75,100] loop
   if (saved+p_amount_cents)*100>=g.target_cents*m then
     insert into public.milestone_claims(user_id,goal_id,milestone) values(u,g.id,m) on conflict do nothing;
     if found then reached:=array_append(reached,m); end if;
   end if;
 end loop;
 if g.kind='sonho' then
   begin analysis:=public.assess_dream(g.id);
   exception when others then analysis:=jsonb_build_object('status','assessment_failed','error',sqlstate); end;
 end if;
 insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id,payload)
 values(u,'goal_progress_added',p_date,'contribution:'||id,'goal',g.id,
   jsonb_build_object('contribution_id',id,'milestones',reached,'goal_kind',g.kind,'target_cents',g.target_cents,'saved_cents',saved+p_amount_cents,'difficulty',analysis,'evidence','declared'));
 prior:=jsonb_build_object('id',id,'milestonesReached',reached);
 insert into public.request_keys(user_id,key,response_json) values(u,p_idempotency_key,prior);
 return prior;
end $$;

create function public.reward_period(p_day date,p_period text) returns date language sql immutable set search_path='' as $$
 select case p_period when 'day' then p_day when 'week' then date_trunc('week',p_day)::date when 'month' then date_trunc('month',p_day)::date else date '0001-01-01' end
$$;

create function public.process_reward_event(p_event_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.gamification_events%rowtype; cfg jsonb; r jsonb; claim text; period_day date; n integer;
 event_for_reward uuid; cycle date; meta jsonb; amount integer; resource text; current_xp integer; new_level integer;
begin
 select * into e from public.gamification_events where id=p_event_id for update;
 if not found or e.processed then return; end if;
 if e.config_version is null then
   update public.gamification_events set processing_status='awaiting_config' where id=e.id; return;
 end if;
 select parameters into cfg from public.economy_config_versions where version=e.config_version and status in ('active','retired');
 if cfg is null then raise exception 'Configuração do evento indisponível'; end if;
 if e.payload->'difficulty'->>'status'='assessment_failed' then raise exception 'Avaliação do marco exige recuperação auditada'; end if;
 perform 1 from public.player_progress where user_id=e.user_id for update;
 for r in select value from jsonb_array_elements(cfg->'rules') loop
   if r->>'event_type'<>e.event_type and not (r->>'event_type'='financial_activity' and e.event_type in ('expense_recorded','income_recorded','no_expense_day','weekly_review_completed','monthly_review_completed')) then continue; end if;
   if r ? 'events' and not (r->'events' ? e.event_type) then continue; end if;
   if e.event_type in ('expense_recorded','income_recorded') then
     if e.entity_type<>'entry' or not exists(select 1 from public.entries where id=e.entity_id and user_id=e.user_id and archived_at is null and type=e.payload->>'original_type') then continue; end if;
   elsif e.event_type not in ('goal_progress_added','no_expense_day','weekly_review_completed','monthly_review_completed') then continue;
   end if;
   period_day:=public.reward_period(e.activity_date,r->>'period');
   claim:=r->>'code'||':'||e.id::text; cycle:=null;
   if r->>'kind' in ('habit','mission') then
     select count(*) into n from public.activity_days where user_id=e.user_id and day<=e.activity_date and public.reward_period(day,r->>'period')=period_day;
     if n<(r->>'minimum_days')::integer then continue; end if;
     claim:=r->>'code'||':'||period_day::text;
   elsif r->>'kind'='goal' then
     if e.payload->>'goal_kind'<>r->>'goal_kind' or not (e.payload->'milestones' @> jsonb_build_array((r->>'milestone')::integer)) then continue; end if;
     if r->>'goal_kind'='sonho' and (e.payload->'difficulty'->>'status' is distinct from 'ready' or replace(lower(e.payload->'difficulty'->>'difficulty'),' ','_') is distinct from r->>'difficulty') then continue; end if;
     claim:='goal:'||e.entity_id||':'||(r->>'milestone');
   elsif r->>'kind'='streak' then
     select cycle_start into cycle from public.streak_milestone_claims where user_id=e.user_id and event_id=e.id and milestone=(r->>'milestone')::integer;
     if cycle is null then continue; end if;
     claim:='streak:'||(r->>'milestone')||case when r->>'repeat_policy'='per_cycle' then ':'||cycle::text else '' end;
   end if;
   if exists(select 1 from public.reward_claims where user_id=e.user_id and claim_key=claim) then continue; end if;
   select count(*) into n from public.reward_claims where user_id=e.user_id and limit_group=r->>'limit_group' and period_start=period_day;
   if n>=(r->>'max_claims')::integer then continue; end if;
   event_for_reward:=e.id;
   if r->>'kind' in ('habit','mission','streak','goal') then
     insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id,payload,processed,processing_status,processed_at,occurred_at,config_version)
     values(e.user_id,case r->>'kind' when 'habit' then 'habit_completed' when 'mission' then 'mission_completed' when 'streak' then 'streak_milestone_reached' else case when r->>'goal_kind'='sonho' then 'dream_milestone_reached' else 'goal_milestone_reached' end end,
       e.business_date,'reward-source:'||claim,e.entity_type,e.entity_id,jsonb_build_object('parent_event_id',e.id,'rule',r->>'code'),true,'processed',now(),e.occurred_at,e.config_version) returning id into event_for_reward;
   end if;
   insert into public.reward_claims(user_id,claim_key,rule_code,limit_group,period_start,event_id,config_version)
   values(e.user_id,claim,r->>'code',r->>'limit_group',period_day,event_for_reward,e.config_version);
   if r->>'kind' in ('habit','mission') then
     insert into public.behavior_completions(user_id,code,kind,period_start,event_id,config_version)
     values(e.user_id,r->>'code',r->>'kind',period_day,event_for_reward,e.config_version) on conflict do nothing;
   end if;
   meta:=jsonb_build_object('parent_event_id',e.id,'kind',r->>'kind','milestone',r->>'milestone','difficulty',e.payload->'difficulty','formula_version',e.payload->'difficulty'->>'formulaVersion','period_start',period_day,'cycle_start',cycle);
   foreach resource in array array['xp','graninha'] loop
     amount:=(r->>resource)::integer;
     if amount>0 then
       insert into public.reward_ledger(user_id,event_id,reward_type,amount,reason_code,config_version,claim_key,metadata)
       values(e.user_id,event_for_reward,resource,amount,r->>'code',e.config_version,claim,meta);
       update public.player_progress set xp_total=xp_total+case when resource='xp' then amount else 0 end,
         graninha_balance=graninha_balance+case when resource='graninha' then amount else 0 end where user_id=e.user_id;
     end if;
   end loop;
 end loop;
 select xp_total into current_xp from public.player_progress where user_id=e.user_id;
 -- A projeção usa a curva ativa; ledger mantém a versão original da concessão.
 select parameters into cfg from public.economy_config_versions where status='active' and effective_from<=now();
 if cfg is not null then
   select max(ordinality)::integer into new_level from jsonb_array_elements_text(cfg->'levels') with ordinality where value::bigint<=current_xp;
   update public.player_progress set level=coalesce(new_level,1),curve_version=(select version from public.economy_config_versions where status='active') where user_id=e.user_id;
 end if;
 update public.gamification_events set processed=true,processing_status='processed',last_error=null,processed_at=now() where id=e.id;
end $$;

-- Chamada em transação separada da financeira. Uma falha por evento reverte só a concessão.
create function public.process_my_rewards() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e record; completed integer:=0; failures integer:=0;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform 1 from public.player_progress where user_id=u for update;
 for e in select id from public.gamification_events where user_id=u and not processed and config_version is not null order by occurred_at,id limit 100 loop
   update public.gamification_events set attempts=attempts+1 where id=e.id;
   begin
     perform public.process_reward_event(e.id); completed:=completed+1;
   exception when others then
     update public.gamification_events set processing_status='failed',last_error=sqlstate where id=e.id;
     failures:=failures+1;
   end;
 end loop;
 return jsonb_build_object('processed',completed,'failed',failures);
end $$;

create function public.gamification_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); p public.player_progress%rowtype; cfg jsonb; version text; next_xp bigint; start_xp bigint; cursor_day date; streak integer:=0; ledger jsonb; history jsonb; behaviors jsonb; achievements jsonb;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into p from public.player_progress where user_id=u for update;
 select c.parameters,c.version into cfg,version from public.economy_config_versions c where c.status='active' and c.effective_from<=now();
 if cfg is not null then
   select max(ordinality)::integer into p.level from jsonb_array_elements_text(cfg->'levels') with ordinality where value::bigint<=p.xp_total;
   start_xp:=(cfg->'levels'->>(p.level-1))::bigint;
   next_xp:=(cfg->'levels'->>p.level)::bigint;
   update public.player_progress set level=p.level,curve_version=version where user_id=u and (level<>p.level or curve_version is distinct from version);
 end if;
 cursor_day:=(now() at time zone 'America/Sao_Paulo')::date;
 if not exists(select 1 from public.activity_days where user_id=u and day=cursor_day) then cursor_day:=cursor_day-1; end if;
 while exists(select 1 from public.activity_days where user_id=u and day=cursor_day) loop streak:=streak+1; cursor_day:=cursor_day-1; end loop;
 select coalesce(jsonb_agg(t),'[]') into ledger from (select id,event_id,reward_type,amount,reason_code,config_version,created_at,metadata,adjustment_of from public.reward_ledger where user_id=u order by created_at desc,id desc limit 50) t;
 select coalesce(jsonb_agg(t),'[]') into history from (select c.goal_id,g.title,c.milestone,c.created_at from public.milestone_claims c join public.goals g on g.id=c.goal_id where c.user_id=u order by c.created_at desc limit 100) t;
 select coalesce(jsonb_agg(t),'[]') into behaviors from (select code,kind,period_start,created_at from public.behavior_completions where user_id=u order by created_at desc limit 50) t;
 select coalesce(jsonb_agg(t),'[]') into achievements from (select milestone,cycle_start,created_at from public.streak_milestone_claims where user_id=u order by created_at desc limit 50) t;
 return jsonb_build_object('progress',jsonb_build_object('xp_total',p.xp_total,'level',p.level,'graninha_balance',p.graninha_balance,'currentLevelXp',start_xp,'nextLevelXp',next_xp,'curveVersion',version),
 'streak',streak,'rewards',ledger,'milestones',history,'behaviors',behaviors,'streakMilestones',achievements,'configVersion',version,
 'pending',(select count(*) from public.gamification_events where user_id=u and not processed and config_version is not null),
 'awaitingConfig',(select count(*) from public.gamification_events where user_id=u and not processed and config_version is null));
end $$;

-- Ajustes somente administrativos, append-only e vinculados à recompensa corrigida.
create function public.adjust_reward(p_ledger_id uuid,p_amount integer,p_reason text,p_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare original public.reward_ledger%rowtype; result uuid; cfg jsonb; version text; total_xp integer; calculated_level integer;
begin
 if p_amount is null or p_amount=0 or length(trim(coalesce(p_reason,'')))<10 or length(coalesce(p_key,''))<8 then raise exception 'Ajuste exige valor, motivo e chave'; end if;
 select * into original from public.reward_ledger where id=p_ledger_id;
 if not found then raise exception 'Recompensa não encontrada'; end if;
 if original.reward_type not in ('xp','graninha') then raise exception 'Tipo de recompensa não ajustável'; end if;
 perform 1 from public.player_progress where user_id=original.user_id for update;
 select id into result from public.reward_ledger where user_id=original.user_id and claim_key='adjustment:'||p_key and reward_type=original.reward_type;
 if found then return result; end if;
 insert into public.reward_ledger(user_id,event_id,reward_type,amount,reason_code,config_version,claim_key,adjustment_of,metadata)
 values(original.user_id,original.event_id,original.reward_type,p_amount,'adjustment:'||p_key,original.config_version,'adjustment:'||p_key,original.id,jsonb_build_object('reason',p_reason,'actor',session_user)) returning id into result;
 update public.player_progress set xp_total=xp_total+case when original.reward_type='xp' then p_amount else 0 end,
   graninha_balance=graninha_balance+case when original.reward_type='graninha' then p_amount else 0 end where user_id=original.user_id;
 select parameters,c.version into cfg,version from public.economy_config_versions c where status='active' and effective_from<=now();
 if cfg is not null then
   select xp_total into total_xp from public.player_progress where user_id=original.user_id;
   select max(ordinality)::integer into calculated_level from jsonb_array_elements_text(cfg->'levels') with ordinality where value::bigint<=total_xp;
   update public.player_progress set level=calculated_level,curve_version=version where user_id=original.user_id;
 end if;
 return result;
end $$;

-- Novas tabelas somente leitura pelo titular; configurações públicas somente se publicadas.
alter table public.economy_config_versions enable row level security;
alter table public.progress_baselines enable row level security;
alter table public.activity_days enable row level security;
alter table public.streak_milestone_claims enable row level security;
alter table public.behavior_completions enable row level security;
alter table public.reward_claims enable row level security;
create policy economy_read on public.economy_config_versions for select to authenticated using(status in ('active','retired'));
create policy baseline_read on public.progress_baselines for select to authenticated using(user_id=auth.uid());
create policy activity_read on public.activity_days for select to authenticated using(user_id=auth.uid());
create policy streak_read on public.streak_milestone_claims for select to authenticated using(user_id=auth.uid());
create policy behavior_read on public.behavior_completions for select to authenticated using(user_id=auth.uid());
create policy claims_read on public.reward_claims for select to authenticated using(user_id=auth.uid());
revoke all on public.economy_config_versions,public.progress_baselines,public.activity_days,public.streak_milestone_claims,public.behavior_completions,public.reward_claims from public,anon,authenticated;
grant select on public.economy_config_versions,public.progress_baselines,public.activity_days,public.streak_milestone_claims,public.behavior_completions,public.reward_claims to authenticated;
revoke insert,update,delete on public.gamification_events,public.reward_ledger,public.player_progress,public.milestone_claims,public.contributions from authenticated;
revoke all on function public.validate_economy_config(),public.prepare_gamification_event(),public.track_financial_activity(),public.audit_entry_update(),public.reward_period(date,text),public.process_reward_event(uuid),public.adjust_reward(uuid,integer,text,text) from public,anon,authenticated;
revoke all on function public.assess_dream(uuid),public.process_my_rewards(),public.gamification_state() from public,anon;
grant execute on function public.assess_dream(uuid),public.process_my_rewards(),public.gamification_state() to authenticated;


create table public.financial_class_history (
 id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity, user_id uuid not null references auth.users(id),
 class_code text not null, reserve_cents bigint not null check(reserve_cents>=0),
 config_version text not null default 'financial_class_v1', created_at timestamptz not null default now()
);
create index financial_class_recent on public.financial_class_history(user_id,created_at desc);
alter table public.financial_class_history enable row level security;
create policy class_history_read on public.financial_class_history for select to authenticated using(user_id=auth.uid());
revoke all on public.financial_class_history from public,anon,authenticated;
grant select on public.financial_class_history to authenticated;
create trigger class_history_immutable before update or delete on public.financial_class_history for each row execute function public.reject_reward_ledger_mutation();

create function public.refresh_financial_class(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare reserve bigint; code text; previous text;
begin
 perform 1 from public.player_progress where user_id=p_user for update;
 select coalesce(sum(greatest(0,a.opening_cents
   +coalesce((select sum(case when e.type='expense' then -e.amount_cents else e.amount_cents end) from public.entries e where e.user_id=p_user and e.account_id=a.id and e.archived_at is null),0)
   -coalesce((select sum(p.amount_cents) from public.card_payments p where p.user_id=p_user and p.account_id=a.id and p.archived_at is null),0))),0)
 into reserve from public.accounts a where a.user_id=p_user and a.is_reserve;
 code:=case when reserve<50000 then 'Quebradinho' when reserve<200000 then 'Juntador' when reserve<500000 then 'Poupador'
   when reserve<1000000 then 'Rico de Ideia' when reserve<2500000 then 'Patrão' when reserve<5000000 then 'Ricasso'
   when reserve<10000000 then 'Magnata' else 'Tio Gansinhas' end;
 select class_code into previous from public.financial_class_history where user_id=p_user order by sequence desc limit 1;
 if previous is distinct from code then
   insert into public.financial_class_history(user_id,class_code,reserve_cents) values(p_user,code,reserve);
 end if;
 return jsonb_build_object('name',code,'reserveCents',reserve,'version','financial_class_v1');
end $$;
create function public.track_financial_class() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform public.refresh_financial_class(case when tg_op='DELETE' then old.user_id else new.user_id end);
 return null;
end $$;
create trigger accounts_class after insert or update or delete on public.accounts for each row execute function public.track_financial_class();
create trigger entries_class after insert or update or delete on public.entries for each row execute function public.track_financial_class();
create trigger payments_class after insert or update or delete on public.card_payments for each row execute function public.track_financial_class();
create function public.financial_class_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); current_class jsonb; history jsonb;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 current_class:=public.refresh_financial_class(u);
 select coalesce(jsonb_agg(t),'[]') into history from (select id,class_code,reserve_cents,config_version,created_at from public.financial_class_history where user_id=u order by sequence desc limit 100) t;
 return current_class||jsonb_build_object('history',history);
end $$;
revoke all on function public.refresh_financial_class(uuid),public.track_financial_class() from public,anon,authenticated;
revoke all on function public.financial_class_state() from public,anon;
grant execute on function public.financial_class_state() to authenticated;

-- Worker administrativo: também permite recuperar eventos sem sessão ativa do usuário.
create function public.process_pending_rewards(p_limit integer default 100) returns integer language plpgsql security definer set search_path='' as $$
declare e record; n integer:=0;
begin
 for e in select id,user_id from public.gamification_events where not processed and config_version is not null order by occurred_at,id limit least(greatest(p_limit,1),1000) loop
   perform 1 from public.player_progress where user_id=e.user_id for update;
   update public.gamification_events set attempts=attempts+1 where id=e.id;
   begin perform public.process_reward_event(e.id); n:=n+1;
   exception when others then update public.gamification_events set processing_status='failed',last_error=sqlstate where id=e.id; end;
 end loop;
 return n;
end $$;
revoke all on function public.process_pending_rewards(integer) from public,anon,authenticated;


create function public.complete_financial_routine(p_kind text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); d date:=(now() at time zone 'America/Sao_Paulo')::date; start_day date; event_name text; event_id uuid;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_kind not in ('no_expense_day','weekly_review_completed','monthly_review_completed') then raise exception 'Rotina não configurada'; end if;
 perform 1 from public.player_progress where user_id=u for update;
 start_day:=public.reward_period(d,case p_kind when 'weekly_review_completed' then 'week' when 'monthly_review_completed' then 'month' else 'day' end);
 if p_kind='no_expense_day' then
   if exists(select 1 from public.entries where user_id=u and type='expense' and date=d and archived_at is null)
     or exists(select 1 from public.card_purchases where user_id=u and purchase_date=d and archived_at is null) then
     raise exception 'Há gastos registrados hoje. Revise suas movimentações.';
   end if;
 else
   if not exists(select 1 from public.entries where user_id=u and date between start_day and d and type in ('income','expense') and archived_at is null)
     and not exists(select 1 from public.card_purchases where user_id=u and purchase_date between start_day and d and archived_at is null) then
     raise exception 'Registre movimentações do período antes de concluir a revisão.';
   end if;
 end if;
 insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id,payload)
 values(u,p_kind,d,'routine:'||p_kind||':'||start_day,'routine',u,jsonb_build_object('period_start',start_day,'confirmation','user_confirmed'))
 on conflict(user_id,idempotency_key) do nothing returning id into event_id;
 return jsonb_build_object('ok',true,'event_id',event_id);
end $$;
revoke all on function public.complete_financial_routine(text) from public,anon;
grant execute on function public.complete_financial_routine(text) to authenticated;

-- Reconstrói constância histórica pela data de criação no servidor, nunca pela data editável.
insert into public.activity_days(user_id,day,event_id)
select distinct on(e.user_id,e.activity_date) e.user_id,e.activity_date,e.id
from public.gamification_events e join public.entries f on f.id=e.entity_id and f.user_id=e.user_id
where e.entity_type='entry' and e.event_type in ('expense_recorded','income_recorded') and f.archived_at is null and f.type in ('income','expense')
order by e.user_id,e.activity_date,e.occurred_at,e.id on conflict do nothing;
with numbered as (
 select *,day-row_number() over(partition by user_id order by day)::integer as cycle from public.activity_days
), cycles as (
 select *,min(day) over(partition by user_id,cycle) as first_day,row_number() over(partition by user_id,cycle order by day) as length from numbered
)
insert into public.streak_milestone_claims(user_id,cycle_start,milestone,event_id)
select user_id,first_day,length::integer,event_id from cycles where length in (3,7,14,30,60,100,365) on conflict do nothing;

-- Usa o agendador se já estiver instalado no projeto. Não instala extensões implicitamente.
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
   perform cron.schedule('granae-reward-retry','* * * * *','select public.process_pending_rewards(100)');
 end if;
end $$;
