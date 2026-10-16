-- Extensão do motor existente; valores aprovados pelo responsável em 16/10/2026.
alter table public.profiles add column timezone text not null default 'America/Sao_Paulo';
alter table public.contributions add column economy_confirmed boolean not null default false,
 add column confirmed_at timestamptz;
alter table public.gamification_events drop constraint gamification_events_processing_status_check;
alter table public.gamification_events add constraint gamification_events_processing_status_check
 check(processing_status in ('pending','processed','awaiting_config','failed','awaiting_difficulty'));

create function public.player_day(p_user uuid,p_at timestamptz default now()) returns date
language sql stable security definer set search_path='' as $$
 select (p_at at time zone coalesce((select timezone from public.profiles where id=p_user),'America/Sao_Paulo'))::date
$$;
create function public.validate_player_timezone() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Fuso horário inválido'; end if;
 return new;
end $$;
create trigger player_timezone_guard before insert or update of timezone on public.profiles for each row execute function public.validate_player_timezone();

create or replace function public.reward_period(p_day date,p_period text) returns date language sql immutable set search_path='' as $$
 select case p_period when 'day' then p_day when 'week' then date_trunc('week',p_day)::date
 when 'month' then date_trunc('month',p_day)::date when 'quarter' then date_trunc('quarter',p_day)::date else date '0001-01-01' end
$$;
create function public.reward_period_end(p_start date,p_period text) returns date language sql immutable set search_path='' as $$
 select case p_period when 'day' then p_start when 'week' then p_start+6 when 'month' then (p_start+interval '1 month'-interval '1 day')::date when 'quarter' then (p_start+interval '3 months'-interval '1 day')::date else date '9999-12-31' end
$$;

-- Mesma fonte de validação para hábitos, streak e missões. Correções não apagam o ledger.
create function public.valid_activity_events(p_user uuid) returns table(id uuid,day date,event_type text,occurred_at timestamptz,payload jsonb)
language sql stable security definer set search_path='' as $$
 select e.id,e.activity_date,e.event_type,e.occurred_at,e.payload from public.gamification_events e
 where e.user_id=p_user and (
  (e.entity_type='entry' and e.event_type in ('expense_recorded','income_recorded') and exists(
   select 1 from public.entries f where f.id=e.entity_id and f.user_id=p_user and f.archived_at is null
    and f.type=case e.event_type when 'expense_recorded' then 'expense' else 'income' end))
  or (e.entity_type='routine' and e.event_type in ('no_expense_day','weekly_review_completed','monthly_review_completed')
    and e.payload->>'confirmation'='user_confirmed')
 )
$$;
create function public.refresh_activity_days(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.player_progress where user_id=p_user for update;
 delete from public.activity_days d where d.user_id=p_user and not exists(select 1 from public.valid_activity_events(p_user) e where e.day=d.day);
 insert into public.activity_days(user_id,day,event_id)
 select distinct on(day) p_user,day,id from public.valid_activity_events(p_user) order by day,occurred_at,id
 on conflict(user_id,day) do update set event_id=excluded.event_id;
end $$;

create function public.mission_progress(p_user uuid,p_rule jsonb,p_day date,p_asof timestamptz,p_activation timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare start_day date:=public.reward_period(p_day,p_rule->>'period'); end_day date; days integer; reviews integer; activation_day date;
begin
 end_day:=public.reward_period_end(start_day,p_rule->>'period');
 activation_day:=public.player_day(p_user,p_activation);
 select count(*) into days from public.activity_days d where user_id=p_user and d.day between greatest(start_day,activation_day) and least(end_day,p_day)
  and exists(select 1 from public.valid_activity_events(p_user) e where e.day=d.day and e.occurred_at<=p_asof);
 select count(distinct e.payload->>'period_start') into reviews from public.valid_activity_events(p_user) e
 where e.event_type=p_rule->>'review_type' and e.occurred_at between p_activation and p_asof
 and case
  when p_rule->>'period'='month' then date_trunc('month',(e.payload->>'period_start')::date+3)::date=start_day
  when p_rule->>'period'='quarter' then date_trunc('quarter',(e.payload->>'period_start')::date)::date=start_day
  else (e.payload->>'period_start')::date=start_day end;
 return jsonb_build_object('days',days,'reviews',reviews,'requiredDays',(p_rule->>'minimum_days')::integer,'requiredReviews',coalesce((p_rule->>'required_reviews')::integer,0),
 'start',start_day,'end',end_day,'eligible',end_day>=activation_day and days>=(p_rule->>'minimum_days')::integer and reviews>=coalesce((p_rule->>'required_reviews')::integer,0));
end $$;

-- O RPC antigo continua registrando progresso financeiro, sem fingir confirmação econômica.
create function public.create_contribution_core(p_goal_id uuid,p_amount_cents bigint,p_date date,p_note text,p_idempotency_key text,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); g public.goals%rowtype; saved bigint; confirmed_saved bigint; contribution_id uuid; prior jsonb;
 reached integer[]:=array[]::integer[]; reward_reached integer[]:=array[]::integer[]; m integer; assessment jsonb;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_idempotency_key is null or p_idempotency_key !~ '^[[:alnum:]_:-]{8,120}$' then raise exception 'Idempotency-Key inválida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_idempotency_key,0));
 select response_json into prior from public.request_keys where user_id=u and key=p_idempotency_key;
 if found then return prior; end if;
 select * into g from public.goals where id=p_goal_id and user_id=u and archived_at is null for update;
 if not found then raise exception 'Objetivo não encontrado'; end if;
 select coalesce(sum(amount_cents),0),coalesce(sum(amount_cents) filter(where economy_confirmed),0) into saved,confirmed_saved from public.contributions where goal_id=g.id and user_id=u;
 if p_amount_cents is null or p_amount_cents<=0 or saved+p_amount_cents>g.target_cents then raise exception 'O aporte ultrapassa o valor do objetivo' using errcode='23514'; end if;
 -- A dificuldade pré-aporte evita classificar automaticamente a conclusão como Fácil.
 if g.kind='sonho' and p_confirmed then
  begin assessment:=public.assess_dream(g.id);
  exception when others then assessment:=jsonb_build_object('status','assessment_failed','error',sqlstate); end;
 end if;
 insert into public.contributions(user_id,goal_id,amount_cents,date,note,economy_confirmed,confirmed_at)
 values(u,g.id,p_amount_cents,p_date,coalesce(p_note,''),p_confirmed,case when p_confirmed then now() end) returning id into contribution_id;
 foreach m in array array[10,25,50,75,100] loop
  if (saved+p_amount_cents)*100>=g.target_cents*m then
   insert into public.milestone_claims(user_id,goal_id,milestone) values(u,g.id,m) on conflict do nothing;
   if found then reached:=array_append(reached,m); end if;
  end if;
  if p_confirmed and confirmed_saved*100<g.target_cents*m and (confirmed_saved+p_amount_cents)*100>=g.target_cents*m then reward_reached:=array_append(reward_reached,m); end if;
 end loop;
 insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id,payload)
 values(u,'goal_progress_added',p_date,'contribution:'||contribution_id,'goal',g.id,jsonb_build_object('contribution_id',contribution_id,
 'milestones',reached,'reward_milestones',reward_reached,'goal_kind',g.kind,'target_cents',g.target_cents,'saved_cents',saved+p_amount_cents,
 'confirmed_saved_cents',confirmed_saved+case when p_confirmed then p_amount_cents else 0 end,'remaining_before_cents',g.target_cents-saved,
 'deadline',g.deadline,'difficulty',assessment,'evidence',case when p_confirmed then 'confirmed_manual' else 'declared' end));
 prior:=jsonb_build_object('id',contribution_id,'milestonesReached',reached,'economyConfirmed',p_confirmed);
 insert into public.request_keys(user_id,key,response_json) values(u,p_idempotency_key,prior);
 return prior;
end $$;
create or replace function public.create_contribution(p_goal_id uuid,p_amount_cents bigint,p_date date,p_note text,p_idempotency_key text)
returns jsonb language sql security definer set search_path='' as $$
 select public.create_contribution_core(p_goal_id,p_amount_cents,p_date,p_note,p_idempotency_key,false)
$$;
create function public.create_confirmed_contribution(p_goal_id uuid,p_amount_cents bigint,p_date date,p_note text,p_idempotency_key text,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_confirmed is distinct from true then raise exception 'Confirme que o aporte representa economia real e não foi contabilizado em outro objetivo.' using errcode='23514'; end if;
 return public.create_contribution_core(p_goal_id,p_amount_cents,p_date,p_note,p_idempotency_key,true);
end $$;

-- Falta de histórico mantém o marco pendente. Recuperação registra nova avaliação,
-- preservando o snapshot original e a versão econômica da ação.
create function public.recover_reward_difficulty(p_event uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.gamification_events%rowtype; live jsonb; result jsonb; capacity bigint; remaining bigint; deadline date;
 months_left integer; effort numeric; months numeric; difficulty text; previous_subject text;
begin
 select * into e from public.gamification_events where id=p_event;
 if e.payload ? 'recovered_reward_difficulty' then return e.payload->'recovered_reward_difficulty'; end if;
 previous_subject:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',e.user_id::text,true);
 live:=public.assess_dream(e.entity_id);
 perform set_config('request.jwt.claim.sub',coalesce(previous_subject,''),true);
 capacity:=(live->>'capacityCents')::bigint;
 if capacity is null or capacity<=0 then return live; end if;
 remaining:=(e.payload->>'remaining_before_cents')::bigint;
 deadline:=(e.payload->>'deadline')::date;
 if deadline is not null then
  months_left:=greatest(0,(extract(year from deadline)::integer-extract(year from e.activity_date)::integer)*12+extract(month from deadline)::integer-extract(month from e.activity_date)::integer+case when extract(day from deadline)>extract(day from e.activity_date) then 1 else 0 end);
  if months_left=0 then return jsonb_build_object('status','expired','formulaVersion','difficulty_formula_v1'); end if;
  effort:=remaining::numeric/months_left/capacity;
  difficulty:=case when effort<=.5 then 'Fácil' when effort<=.75 then 'Moderada' when effort<=1 then 'Difícil' when effort<=1.5 then 'Muito difícil' else 'Lendária' end;
 else
  months:=remaining::numeric/capacity;
  difficulty:=case when months<=6 then 'Fácil' when months<=12 then 'Moderada' when months<=24 then 'Difícil' when months<=48 then 'Muito difícil' else 'Lendária' end;
 end if;
 result:=jsonb_build_object('status','ready','difficulty',difficulty,'capacityCents',capacity,'remainingCents',remaining,'formulaVersion','difficulty_formula_v1','confidence',live->>'confidence','recoveredAt',now(),'basis','remaining_before_contribution');
 insert into public.difficulty_assessments(user_id,goal_id,difficulty_code,inputs_json,result_json,confidence_level,formula_version)
 values(e.user_id,e.entity_id,difficulty,jsonb_build_object('event_id',e.id,'reason','reward_difficulty_recovery','remainingCents',remaining),result,coalesce(live->>'confidence','alta'),'difficulty_formula_v1');
 update public.gamification_events set payload=payload||jsonb_build_object('recovered_reward_difficulty',result) where id=e.id;
 return result;
end $$;

create function public.missions_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); cfg jsonb; activation timestamptz; version text; rule jsonb; stats jsonb; result jsonb:='[]'; previous jsonb:='[]';
 d date; selected_day date; i integer; completed boolean; status text; claim text; item jsonb;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform public.refresh_activity_days(u);
 d:=public.player_day(u);
 select parameters,effective_from,c.version into cfg,activation,version from public.economy_config_versions c where c.status='active' and c.effective_from<=now();
 activation:=coalesce((cfg->>'missions_activated_at')::timestamptz,activation);
 for rule in select value from jsonb_array_elements(coalesce(cfg->'rules','[]')) where value->>'kind'='mission' loop
  for i in 0..1 loop
   selected_day:=case when i=0 then d else public.reward_period(d,rule->>'period')-1 end;
   stats:=public.mission_progress(u,rule,selected_day,now(),activation);
   if (stats->>'end')::date<public.player_day(u,activation) then continue; end if;
   claim:=rule->>'code'||':'||(stats->>'start');
   select exists(select 1 from public.reward_claims where user_id=u and claim_key=claim) into completed;
   status:=case when completed then 'completed' when i=1 then 'expired' when (stats->>'days')::integer>0 or (stats->>'reviews')::integer>0 then 'in_progress' else 'available' end;
   item:=stats||jsonb_build_object('code',rule->>'code','name',rule->>'name','difficulty',rule->>'difficulty','description',rule->>'description',
    'xp',(rule->>'xp')::integer,'graninha',(rule->>'graninha')::integer,'period',rule->>'period','status',status,'configVersion',version);
   if completed then
    item:=item||jsonb_build_object('xp',coalesce((select sum(amount) from public.reward_ledger where user_id=u and claim_key=claim and reward_type='xp'),0),
     'graninha',coalesce((select sum(amount) from public.reward_ledger where user_id=u and claim_key=claim and reward_type='graninha'),0),
     'configVersion',(select config_version from public.reward_claims where user_id=u and claim_key=claim));
   end if;
   if i=0 then result:=result||jsonb_build_array(item); else previous:=previous||jsonb_build_array(item); end if;
  end loop;
 end loop;
 return jsonb_build_object('current',result,'previous',previous,'timezone',(select timezone from public.profiles where id=u));
end $$;

revoke all on function public.player_day(uuid,timestamptz),public.validate_player_timezone(),public.reward_period_end(date,text),public.valid_activity_events(uuid),public.refresh_activity_days(uuid),public.mission_progress(uuid,jsonb,date,timestamptz,timestamptz),public.create_contribution_core(uuid,bigint,date,text,text,boolean) from public,anon,authenticated;
revoke all on function public.recover_reward_difficulty(uuid) from public,anon,authenticated;
revoke all on function public.create_confirmed_contribution(uuid,bigint,date,text,text,boolean),public.missions_state() from public,anon;
grant execute on function public.create_confirmed_contribution(uuid,bigint,date,text,text,boolean),public.missions_state() to authenticated;

create or replace function public.validate_economy_config() returns trigger language plpgsql set search_path='' as $$
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
       or r->>'period' not in ('day','week','month','quarter','lifetime')
       or coalesce(r->>'limit_group','') !~ '^[a-z][a-z0-9_]{2,60}$'
       or coalesce(r->>'max_claims','') !~ '^[1-9][0-9]*$'
       or coalesce(r->>'xp','') !~ '^[0-9]+$' or coalesce(r->>'graninha','') !~ '^[0-9]+$'
       then raise exception 'Regra econômica inválida ou sem limites explícitos'; end if;
     if (r->>'xp')::bigint>2147483647 or (r->>'graninha')::bigint>2147483647 then raise exception 'Recompensa fora do intervalo'; end if;
     if r->>'kind' in ('habit','mission') and coalesce(r->>'minimum_days','') !~ '^[1-9][0-9]*$' then raise exception 'Defina dias distintos para o hábito/missão'; end if;
     if r->>'kind'='goal' and (r->>'event_type'<>'goal_progress_added' or coalesce(r->>'goal_kind','') not in ('meta','sonho') or coalesce(r->>'milestone','') not in ('10','25','50','75','100') or coalesce(r->>'evidence_policy','')<>'declared_progress_approved') then raise exception 'Marco exige tipo e política de evidência aprovada'; end if;
     if r->>'kind'='goal' and r->>'goal_kind'='sonho' and coalesce(r->>'difficulty','') not in ('fácil','moderada','difícil','muito_difícil','lendária') then raise exception 'Informe a dificuldade da recompensa'; end if;
     if r->>'kind'='streak' and (coalesce(r->>'repeat_policy','') not in ('once','per_cycle') or coalesce(r->>'milestone','') not in ('3','7','14','30','60','100','365')) then raise exception 'Defina o marco e sua política de repetição'; end if;
     if r->>'kind'<>'goal' and r->>'code'<>'daily_saving' and r->>'event_type'='goal_progress_added' then raise exception 'Aportes só participam de regras próprias de marcos'; end if;
     if r->>'kind'='mission' and (coalesce(r->>'required_reviews','') !~ '^[0-9]+$' or not (r ?& array['name','description','difficulty'])) then raise exception 'Missão exige condições e descrição'; end if;
     seen:=array_append(seen,r->>'code');
   end loop;
   -- Um grupo tem o mesmo teto/período em todas as regras desta versão.
   if exists(select 1 from jsonb_array_elements(new.parameters->'rules') a, jsonb_array_elements(new.parameters->'rules') b
     where a->>'limit_group'=b->>'limit_group' and (a->>'period'<>b->>'period' or a->>'max_claims'<>b->>'max_claims')) then raise exception 'Limites contraditórios no mesmo grupo'; end if;
 end if;
 return new;
end $$;
create or replace function public.prepare_gamification_event() returns trigger language plpgsql security definer set search_path='' as $$
declare source_row public.entries%rowtype;
begin
 new.timezone:=coalesce((select timezone from public.profiles where id=new.user_id),'America/Sao_Paulo');
 new.activity_date:=public.player_day(new.user_id,new.occurred_at);
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
create or replace function public.track_financial_activity() returns trigger language plpgsql security definer set search_path='' as $$
declare n integer; cursor_day date; start_day date; m integer;
begin
 if (new.event_type in ('expense_recorded','income_recorded') and new.entity_type='entry' and exists(
   select 1 from public.entries where id=new.entity_id and user_id=new.user_id and type in ('income','expense') and archived_at is null
 )) or (new.entity_type='routine' and new.event_type in ('no_expense_day','weekly_review_completed','monthly_review_completed')) then
   -- Serializa o primeiro registro do dia e os marcos de sequência do mesmo usuário.
   perform 1 from public.player_progress where user_id=new.user_id for update;
   perform public.refresh_activity_days(new.user_id);
   n:=0; cursor_day:=new.activity_date;
   while exists(select 1 from public.activity_days where user_id=new.user_id and day=cursor_day) loop n:=n+1; cursor_day:=cursor_day-1; end loop;
   start_day:=cursor_day+1;
   foreach m in array array[3,7,14,30,60,100,365] loop
     if n>=m then insert into public.streak_milestone_claims(user_id,cycle_start,milestone,event_id) values(new.user_id,start_day,m,new.id) on conflict do nothing; end if;
   end loop;
 end if;
 return new;
end $$;
create or replace function public.audit_entry_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new is distinct from old and new.archived_at is null then
   insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id,payload)
   values(new.user_id,'financial_entry_updated',new.date,'entry-update:'||gen_random_uuid(),'entry',new.id,
     jsonb_build_object('previous_type',old.type,'previous_date',old.date,'previous_amount_cents',old.amount_cents));
 end if;
 perform public.refresh_activity_days(new.user_id);
 return new;
end $$;
create or replace function public.complete_financial_routine(p_kind text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); d date:=public.player_day(auth.uid()); start_day date; event_name text; event_id uuid;
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
     and not exists(select 1 from public.card_purchases where user_id=u and purchase_date between start_day and d and archived_at is null) and not exists(select 1 from public.activity_days where user_id=u and day between start_day and d) then
     raise exception 'Registre movimentações do período antes de concluir a revisão.';
   end if;
 end if;
 insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id,payload)
 values(u,p_kind,d,'routine:'||p_kind||':'||start_day,'routine',u,jsonb_build_object('period_start',start_day,'confirmation','user_confirmed'))
 on conflict(user_id,idempotency_key) do nothing returning id into event_id;
 return jsonb_build_object('ok',true,'event_id',event_id);
end $$;
create or replace function public.process_reward_event(p_event_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare e public.gamification_events%rowtype; cfg jsonb; r jsonb; claim text; period_day date; n integer;
 event_for_reward uuid; cycle date; meta jsonb; amount integer; resource text; current_xp integer; new_level integer; mission_stats jsonb; waiting_difficulty boolean:=false; assessment jsonb; activation timestamptz;
begin
 select * into e from public.gamification_events where id=p_event_id for update;
 if not found or e.processed then return; end if;
 if e.config_version is null then
   update public.gamification_events set processing_status='awaiting_config' where id=e.id; return;
 end if;
 select parameters into cfg from public.economy_config_versions where version=e.config_version and status in ('active','retired');
 if cfg is null then raise exception 'Configuração do evento indisponível'; end if;
 if e.payload->'difficulty'->>'status'='assessment_failed' then raise exception 'Avaliação do marco exige recuperação auditada'; end if;
 assessment:=e.payload->'difficulty';
 if e.payload->>'goal_kind'='sonho' and e.payload->>'evidence'='confirmed_manual' and jsonb_array_length(coalesce(e.payload->'reward_milestones','[]'))>0 and assessment->>'status' is distinct from 'ready' then
   assessment:=public.recover_reward_difficulty(e.id);
   if assessment->>'status' is distinct from 'ready' then waiting_difficulty:=true; end if;
 end if;
 activation:=coalesce((cfg->>'missions_activated_at')::timestamptz,(select effective_from from public.economy_config_versions where version=e.config_version));
 perform 1 from public.player_progress where user_id=e.user_id for update;
 for r in select value from jsonb_array_elements(cfg->'rules') loop
   if r->>'event_type'<>e.event_type and not (r->>'event_type'='financial_activity' and e.event_type in ('expense_recorded','income_recorded','no_expense_day','weekly_review_completed','monthly_review_completed')) then continue; end if;
   if r ? 'events' and not (r->'events' ? e.event_type) then continue; end if;
   if e.event_type in ('expense_recorded','income_recorded') then
     if e.entity_type<>'entry' or not exists(select 1 from public.entries where id=e.entity_id and user_id=e.user_id and archived_at is null and type=e.payload->>'original_type') then continue; end if;
   elsif e.event_type not in ('goal_progress_added','no_expense_day','weekly_review_completed','monthly_review_completed') then continue;
   end if;
   if e.event_type='goal_progress_added' and (r->>'kind'='goal' or r->>'code'='daily_saving') and cfg->>'confirmed_contributions'='required' and (e.payload->>'evidence' is distinct from 'confirmed_manual' or not exists(select 1 from public.contributions c where c.id=(e.payload->>'contribution_id')::uuid and c.user_id=e.user_id and c.economy_confirmed)) then continue; end if;
   period_day:=public.reward_period(e.activity_date,r->>'period');
   claim:=r->>'code'||':'||e.id::text; cycle:=null;
   if r->>'kind'='mission' then
     mission_stats:=public.mission_progress(e.user_id,r,e.activity_date,e.occurred_at,activation);
     if not (mission_stats->>'eligible')::boolean then continue; end if;
     claim:=r->>'code'||':'||period_day::text;
   elsif r->>'code'='daily_saving' then
     claim:='daily_saving:'||period_day::text;
   elsif r->>'kind'='habit' then
     select count(*) into n from public.activity_days where user_id=e.user_id and day<=e.activity_date and public.reward_period(day,r->>'period')=period_day;
     if n<(r->>'minimum_days')::integer then continue; end if;
     claim:=r->>'code'||':'||period_day::text;
   elsif r->>'kind'='goal' then
     if e.payload->>'goal_kind'<>r->>'goal_kind' or not (coalesce(e.payload->'reward_milestones',e.payload->'milestones') @> jsonb_build_array((r->>'milestone')::integer)) then continue; end if;
     if r->>'goal_kind'='sonho' and (assessment->>'status' is distinct from 'ready' or replace(lower(assessment->>'difficulty'),' ','_') is distinct from r->>'difficulty') then continue; end if;
     claim:='goal:'||e.entity_id||':'||(r->>'milestone');
   elsif r->>'kind'='streak' then
     select cycle_start into cycle from public.streak_milestone_claims where user_id=e.user_id and event_id=e.id and milestone=(r->>'milestone')::integer;
     if cycle is null then continue; end if;
     claim:='streak:'||(r->>'milestone')||case when r->>'repeat_policy'='per_cycle' then ':'||cycle::text else '' end;
   end if;
   if exists(select 1 from public.reward_claims where user_id=e.user_id and claim_key=claim) then continue; end if;
   select count(*) into n from public.reward_claims where user_id=e.user_id and limit_group=case when r->>'kind'='goal' then (r->>'limit_group')||':'||e.entity_id::text else r->>'limit_group' end and period_start=period_day;
   if n>=(r->>'max_claims')::integer then continue; end if;
   event_for_reward:=e.id;
   if r->>'kind' in ('habit','mission','streak','goal') then
     insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id,payload,processed,processing_status,processed_at,occurred_at,config_version)
     values(e.user_id,case r->>'kind' when 'habit' then 'habit_completed' when 'mission' then 'mission_completed' when 'streak' then 'streak_milestone_reached' else case when r->>'goal_kind'='sonho' then 'dream_milestone_reached' else 'goal_milestone_reached' end end,
       e.business_date,'reward-source:'||claim,e.entity_type,e.entity_id,jsonb_build_object('parent_event_id',e.id,'rule',r->>'code'),true,'processed',now(),e.occurred_at,e.config_version) returning id into event_for_reward;
   end if;
   insert into public.reward_claims(user_id,claim_key,rule_code,limit_group,period_start,event_id,config_version)
   values(e.user_id,claim,r->>'code',case when r->>'kind'='goal' then (r->>'limit_group')||':'||e.entity_id::text else r->>'limit_group' end,period_day,event_for_reward,e.config_version);
   if r->>'kind' in ('habit','mission') then
     insert into public.behavior_completions(user_id,code,kind,period_start,event_id,config_version)
     values(e.user_id,r->>'code',r->>'kind',period_day,event_for_reward,e.config_version) on conflict do nothing;
   end if;
   meta:=jsonb_build_object('parent_event_id',e.id,'kind',r->>'kind','milestone',r->>'milestone','difficulty',assessment,'formula_version',assessment->>'formulaVersion','mission_progress',mission_stats,'period_start',period_day,'cycle_start',cycle);
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
 update public.gamification_events set processed=not waiting_difficulty,processing_status=case when waiting_difficulty then 'awaiting_difficulty' else 'processed' end,last_error=null,processed_at=case when waiting_difficulty then null else now() end where id=e.id;
end $$;
create or replace function public.process_my_rewards() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); e record; completed integer:=0; failures integer:=0;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform 1 from public.player_progress where user_id=u for update;
 perform public.refresh_activity_days(u);
 for e in select id from public.gamification_events where user_id=u and not processed and config_version is not null order by case when processing_status='awaiting_difficulty' then 1 else 0 end,occurred_at,id limit 100 loop
   update public.gamification_events set attempts=attempts+1 where id=e.id;
   begin
     perform public.process_reward_event(e.id); if exists(select 1 from public.gamification_events where id=e.id and processed) then completed:=completed+1; end if;
   exception when others then
     update public.gamification_events set processing_status='failed',last_error=sqlstate where id=e.id;
     failures:=failures+1;
   end;
 end loop;
 return jsonb_build_object('processed',completed,'failed',failures);
end $$;
create or replace function public.gamification_state() returns jsonb language plpgsql security definer set search_path='' as $$
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
 cursor_day:=public.player_day(u);
 if not exists(select 1 from public.activity_days where user_id=u and day=cursor_day) then cursor_day:=cursor_day-1; end if;
 while exists(select 1 from public.activity_days where user_id=u and day=cursor_day) loop streak:=streak+1; cursor_day:=cursor_day-1; end loop;
 select coalesce(jsonb_agg(t),'[]') into ledger from (select id,event_id,reward_type,amount,reason_code,config_version,created_at,metadata,adjustment_of from public.reward_ledger where user_id=u order by created_at desc,id desc limit 50) t;
 select coalesce(jsonb_agg(t),'[]') into history from (select c.goal_id,g.title,c.milestone,c.created_at from public.milestone_claims c join public.goals g on g.id=c.goal_id where c.user_id=u order by c.created_at desc limit 100) t;
 select coalesce(jsonb_agg(t),'[]') into behaviors from (select code,kind,period_start,created_at from public.behavior_completions where user_id=u order by created_at desc limit 50) t;
 select coalesce(jsonb_agg(t),'[]') into achievements from (select milestone,cycle_start,created_at from public.streak_milestone_claims where user_id=u order by created_at desc limit 50) t;
 return jsonb_build_object('progress',jsonb_build_object('xp_total',p.xp_total,'level',p.level,'graninha_balance',p.graninha_balance,'currentLevelXp',start_xp,'nextLevelXp',next_xp,'curveVersion',version),
 'streak',streak,'rewards',ledger,'milestones',history,'behaviors',behaviors,'streakMilestones',achievements,'configVersion',version,
 'pending',(select count(*) from public.gamification_events where user_id=u and not processed and config_version is not null),
 'awaitingConfig',(select count(*) from public.gamification_events where user_id=u and not processed and config_version is null),
 'awaitingDifficulty',(select count(*) from public.gamification_events where user_id=u and processing_status='awaiting_difficulty'));
end $$;

-- A nova versão vale somente para novos eventos; o ledger antigo mantém sua configuração.
update public.economy_config_versions set status='retired' where status='active';
insert into public.economy_config_versions(version,status,parameters,source) values('economy_v2_20261016','active','{"levels":[0,125,250,375,500,850,1200,1550,1900,2250,2625,3000,3375,3750,4125,4875,5625,6375,7125,7875,8625,9375,10125,10875,11625,12375,13125,13875,14625,15375,16800,18225,19650,21075,22500,23925,25350,26775,28200,29625,31200,32775,34350,35925,37500,39075,40650,42225,43800,45375,47375,49375,51375,53375,55375,57375,59375,61375,63375,65375,67475,69575,71675,73775,75875,77975,80075,82175,84275,86375,88125,89875,91625,93375,95125,96875,98625,100375,102125,103875,105975,108075,110175,112275,114375,116475,118575,120675,122775,124875,127525,130175,132825,135475,138125,140775,143425,146075,148725,151375],"curve_version":"xp_curve_proposal_20261015","rules":[{"code":"daily_record","kind":"habit","event_type":"financial_activity","period":"day","max_claims":1,"limit_group":"daily_organization","xp":5,"graninha":0,"minimum_days":1,"events":["expense_recorded","income_recorded"]},{"code":"no_expense_day","kind":"habit","event_type":"no_expense_day","period":"day","max_claims":1,"limit_group":"daily_organization","xp":5,"graninha":0,"minimum_days":1},{"code":"weekly_review","kind":"habit","event_type":"weekly_review_completed","period":"week","max_claims":1,"limit_group":"weekly_review","xp":10,"graninha":0,"minimum_days":1},{"code":"monthly_review","kind":"habit","event_type":"monthly_review_completed","period":"month","max_claims":1,"limit_group":"monthly_review","xp":20,"graninha":0,"minimum_days":1},{"code":"streak_3","kind":"streak","event_type":"financial_activity","period":"lifetime","max_claims":1,"limit_group":"streak_3","xp":10,"graninha":10,"milestone":3,"repeat_policy":"once"},{"code":"streak_7","kind":"streak","event_type":"financial_activity","period":"lifetime","max_claims":1,"limit_group":"streak_7","xp":30,"graninha":25,"milestone":7,"repeat_policy":"once"},{"code":"streak_14","kind":"streak","event_type":"financial_activity","period":"lifetime","max_claims":1,"limit_group":"streak_14","xp":50,"graninha":40,"milestone":14,"repeat_policy":"once"},{"code":"streak_30","kind":"streak","event_type":"financial_activity","period":"lifetime","max_claims":1,"limit_group":"streak_30","xp":100,"graninha":100,"milestone":30,"repeat_policy":"once"},{"code":"streak_60","kind":"streak","event_type":"financial_activity","period":"lifetime","max_claims":1,"limit_group":"streak_60","xp":200,"graninha":150,"milestone":60,"repeat_policy":"once"},{"code":"streak_100","kind":"streak","event_type":"financial_activity","period":"lifetime","max_claims":1,"limit_group":"streak_100","xp":400,"graninha":300,"milestone":100,"repeat_policy":"once"},{"code":"streak_365","kind":"streak","event_type":"financial_activity","period":"lifetime","max_claims":1,"limit_group":"streak_365","xp":1000,"graninha":1000,"milestone":365,"repeat_policy":"once"},{"code":"daily_saving","kind":"habit","event_type":"goal_progress_added","period":"day","max_claims":1,"limit_group":"daily_saving","xp":5,"graninha":0,"minimum_days":1,"evidence_policy":"confirmed_manual"},{"code":"goal_10","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"goal_10","xp":20,"graninha":15,"goal_kind":"meta","milestone":10,"evidence_policy":"declared_progress_approved"},{"code":"goal_25","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"goal_25","xp":30,"graninha":25,"goal_kind":"meta","milestone":25,"evidence_policy":"declared_progress_approved"},{"code":"goal_50","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"goal_50","xp":50,"graninha":40,"goal_kind":"meta","milestone":50,"evidence_policy":"declared_progress_approved"},{"code":"goal_75","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"goal_75","xp":75,"graninha":60,"goal_kind":"meta","milestone":75,"evidence_policy":"declared_progress_approved"},{"code":"goal_100","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"goal_100","xp":150,"graninha":150,"goal_kind":"meta","milestone":100,"evidence_policy":"declared_progress_approved"},{"code":"dream_facil_10","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_10","xp":25,"graninha":0,"goal_kind":"sonho","milestone":10,"difficulty":"fácil","evidence_policy":"declared_progress_approved"},{"code":"dream_facil_25","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_25","xp":50,"graninha":0,"goal_kind":"sonho","milestone":25,"difficulty":"fácil","evidence_policy":"declared_progress_approved"},{"code":"dream_facil_50","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_50","xp":75,"graninha":0,"goal_kind":"sonho","milestone":50,"difficulty":"fácil","evidence_policy":"declared_progress_approved"},{"code":"dream_facil_75","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_75","xp":100,"graninha":0,"goal_kind":"sonho","milestone":75,"difficulty":"fácil","evidence_policy":"declared_progress_approved"},{"code":"dream_facil_100","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_100","xp":250,"graninha":0,"goal_kind":"sonho","milestone":100,"difficulty":"fácil","evidence_policy":"declared_progress_approved"},{"code":"dream_moderada_10","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_10","xp":37,"graninha":0,"goal_kind":"sonho","milestone":10,"difficulty":"moderada","evidence_policy":"declared_progress_approved"},{"code":"dream_moderada_25","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_25","xp":75,"graninha":0,"goal_kind":"sonho","milestone":25,"difficulty":"moderada","evidence_policy":"declared_progress_approved"},{"code":"dream_moderada_50","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_50","xp":112,"graninha":0,"goal_kind":"sonho","milestone":50,"difficulty":"moderada","evidence_policy":"declared_progress_approved"},{"code":"dream_moderada_75","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_75","xp":150,"graninha":0,"goal_kind":"sonho","milestone":75,"difficulty":"moderada","evidence_policy":"declared_progress_approved"},{"code":"dream_moderada_100","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_100","xp":376,"graninha":0,"goal_kind":"sonho","milestone":100,"difficulty":"moderada","evidence_policy":"declared_progress_approved"},{"code":"dream_dificil_10","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_10","xp":50,"graninha":0,"goal_kind":"sonho","milestone":10,"difficulty":"difícil","evidence_policy":"declared_progress_approved"},{"code":"dream_dificil_25","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_25","xp":100,"graninha":0,"goal_kind":"sonho","milestone":25,"difficulty":"difícil","evidence_policy":"declared_progress_approved"},{"code":"dream_dificil_50","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_50","xp":150,"graninha":0,"goal_kind":"sonho","milestone":50,"difficulty":"difícil","evidence_policy":"declared_progress_approved"},{"code":"dream_dificil_75","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_75","xp":200,"graninha":0,"goal_kind":"sonho","milestone":75,"difficulty":"difícil","evidence_policy":"declared_progress_approved"},{"code":"dream_dificil_100","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_100","xp":500,"graninha":0,"goal_kind":"sonho","milestone":100,"difficulty":"difícil","evidence_policy":"declared_progress_approved"},{"code":"dream_muito_dificil_10","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_10","xp":75,"graninha":0,"goal_kind":"sonho","milestone":10,"difficulty":"muito_difícil","evidence_policy":"declared_progress_approved"},{"code":"dream_muito_dificil_25","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_25","xp":150,"graninha":0,"goal_kind":"sonho","milestone":25,"difficulty":"muito_difícil","evidence_policy":"declared_progress_approved"},{"code":"dream_muito_dificil_50","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_50","xp":225,"graninha":0,"goal_kind":"sonho","milestone":50,"difficulty":"muito_difícil","evidence_policy":"declared_progress_approved"},{"code":"dream_muito_dificil_75","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_75","xp":300,"graninha":0,"goal_kind":"sonho","milestone":75,"difficulty":"muito_difícil","evidence_policy":"declared_progress_approved"},{"code":"dream_muito_dificil_100","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_100","xp":750,"graninha":0,"goal_kind":"sonho","milestone":100,"difficulty":"muito_difícil","evidence_policy":"declared_progress_approved"},{"code":"dream_lendaria_10","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_10","xp":125,"graninha":0,"goal_kind":"sonho","milestone":10,"difficulty":"lendária","evidence_policy":"declared_progress_approved"},{"code":"dream_lendaria_25","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_25","xp":250,"graninha":0,"goal_kind":"sonho","milestone":25,"difficulty":"lendária","evidence_policy":"declared_progress_approved"},{"code":"dream_lendaria_50","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_50","xp":375,"graninha":0,"goal_kind":"sonho","milestone":50,"difficulty":"lendária","evidence_policy":"declared_progress_approved"},{"code":"dream_lendaria_75","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_75","xp":500,"graninha":0,"goal_kind":"sonho","milestone":75,"difficulty":"lendária","evidence_policy":"declared_progress_approved"},{"code":"dream_lendaria_100","kind":"goal","event_type":"goal_progress_added","period":"lifetime","max_claims":1,"limit_group":"dream_100","xp":1250,"graninha":0,"goal_kind":"sonho","milestone":100,"difficulty":"lendária","evidence_policy":"declared_progress_approved"},{"code":"mission_first_step","name":"Primeiro Passo","difficulty":"Fácil","description":"Acompanhe sua situação financeira em 3 dias distintos da semana.","period":"week","minimum_days":3,"required_reviews":0,"review_type":null,"xp":10,"graninha":10,"kind":"mission","event_type":"financial_activity","max_claims":1,"limit_group":"mission_first_step"},{"code":"mission_organized_week","name":"Semana Organizada","difficulty":"Média","description":"Acompanhe 5 dias financeiros e confirme a revisão da semana.","period":"week","minimum_days":5,"required_reviews":1,"review_type":"weekly_review_completed","xp":25,"graninha":25,"kind":"mission","event_type":"financial_activity","max_claims":1,"limit_group":"mission_organized_week"},{"code":"mission_true_control","name":"Controle de Verdade","difficulty":"Difícil","description":"Acompanhe 20 dias no mês e conclua 4 revisões de semanas diferentes.","period":"month","minimum_days":20,"required_reviews":4,"review_type":"weekly_review_completed","xp":60,"graninha":50,"kind":"mission","event_type":"financial_activity","max_claims":1,"limit_group":"mission_true_control"},{"code":"mission_control_master","name":"Mestre do Controle","difficulty":"Muito difícil","description":"Acompanhe 75 dias no trimestre civil e revise seus 3 meses.","period":"quarter","minimum_days":75,"required_reviews":3,"review_type":"monthly_review_completed","xp":100,"graninha":100,"kind":"mission","event_type":"financial_activity","max_claims":1,"limit_group":"mission_control_master"}],"confirmed_contributions":"required"}'::jsonb||jsonb_build_object('missions_activated_at',now()),'Missões v1.0, aportes manuais confirmados e distribuição dos Sonhos aprovados pelo responsável em 16/10/2026');
