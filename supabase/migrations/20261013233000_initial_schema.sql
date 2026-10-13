-- Granaê: banco inicial no Supabase.
-- Os dados são sempre isolados por auth.uid(); nunca use a chave secret no navegador.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp_total integer not null default 0 check (xp_total >= 0),
  level integer not null default 1 check (level >= 1),
  graninha_balance integer not null default 0 check (graninha_balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text check (theme in ('dark','light','system')),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  type text not null check (type in ('corrente','poupança','dinheiro','investimento','outro')),
  opening_cents bigint not null default 0 check (abs(opening_cents) <= 100000000000),
  is_reserve boolean not null default false,
  description text not null default '' check (char_length(description) <= 200),
  created_at timestamptz not null default now(),
  unique (id,user_id)
);
create index accounts_user_created on public.accounts(user_id,created_at);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 80),
  category text not null check (char_length(trim(category)) between 1 and 40),
  type text not null check (type in ('income','expense','adjustment')),
  amount_cents bigint not null check (abs(amount_cents) <= 100000000000),
  date date not null check (date <= (now() at time zone 'America/Sao_Paulo')::date),
  note text not null default '' check (char_length(note) <= 300),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (account_id,user_id) references public.accounts(id,user_id) on delete restrict,
  check ((type='adjustment' and amount_cents <> 0) or (type<>'adjustment' and amount_cents > 0)),
  unique (id,user_id)
);
create index entries_user_date on public.entries(user_id,date desc,created_at desc);
create index entries_account on public.entries(account_id,date desc);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 70),
  kind text not null check (kind in ('asset','liability')),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (id,user_id)
);
create index assets_user_name on public.assets(user_id,name);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 70),
  kind text not null check (kind in ('meta','sonho')),
  target_cents bigint not null check (target_cents > 0 and target_cents <= 100000000000),
  icon text not null default '✦' check (char_length(icon) between 1 and 10),
  deadline date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id,user_id)
);
create index goals_user_active on public.goals(user_id,created_at desc) where archived_at is null;

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  date date not null check (date <= (now() at time zone 'America/Sao_Paulo')::date),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  foreign key (goal_id,user_id) references public.goals(id,user_id) on delete restrict,
  unique (id,user_id)
);
create index contributions_goal_date on public.contributions(user_id,goal_id,date desc);

create table public.milestone_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  milestone integer not null check (milestone in (10,25,50,75,100)),
  created_at timestamptz not null default now(),
  foreign key (goal_id,user_id) references public.goals(id,user_id) on delete restrict,
  unique (goal_id,milestone)
);

create table public.difficulty_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  difficulty_code text not null,
  inputs_json jsonb not null,
  result_json jsonb not null,
  confidence_level text not null check (confidence_level in ('baixa','alta')),
  formula_version text not null,
  calculated_at timestamptz not null default now(),
  foreign key (goal_id,user_id) references public.goals(id,user_id) on delete restrict
);
create index difficulty_goal_history on public.difficulty_assessments(user_id,goal_id,calculated_at desc);

create table public.gamification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  business_date date not null,
  idempotency_key text not null,
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  unique (user_id,idempotency_key)
);
create table public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.gamification_events(id) on delete restrict,
  reward_type text not null,
  amount integer not null,
  reason_code text not null,
  config_version text not null,
  created_at timestamptz not null default now(),
  unique (event_id,reason_code,reward_type)
);
create table public.request_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key ~ '^[[:alnum:]_:-]{8,120}$'),
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id,key)
);

create or replace function public.bootstrap_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,name)
  values (new.id,coalesce(new.raw_user_meta_data ->> 'name',''));
  insert into public.player_progress(user_id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.bootstrap_user();

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger progress_touch before update on public.player_progress for each row execute function public.touch_updated_at();
create trigger preferences_touch before update on public.user_preferences for each row execute function public.touch_updated_at();

create or replace function public.guard_goal_target() returns trigger
language plpgsql set search_path = '' as $$
declare v_saved bigint;
begin
  select coalesce(sum(amount_cents),0) into v_saved
  from public.contributions where goal_id=new.id and user_id=new.user_id;
  if new.target_cents < v_saved then
    raise exception 'O objetivo não pode ser menor que o valor já registrado.' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger goals_target_guard before update of target_cents on public.goals
for each row execute function public.guard_goal_target();

create or replace function public.reject_reward_ledger_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'reward_ledger is immutable'; end; $$;
create trigger reward_ledger_immutable before update or delete on public.reward_ledger
for each row execute function public.reject_reward_ledger_mutation();

alter table public.profiles enable row level security;
alter table public.player_progress enable row level security;
alter table public.user_preferences enable row level security;
alter table public.accounts enable row level security;
alter table public.entries enable row level security;
alter table public.assets enable row level security;
alter table public.goals enable row level security;
alter table public.contributions enable row level security;
alter table public.milestone_claims enable row level security;
alter table public.difficulty_assessments enable row level security;
alter table public.gamification_events enable row level security;
alter table public.reward_ledger enable row level security;
alter table public.request_keys enable row level security;

create policy profiles_owner_select on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy profiles_owner_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy progress_owner_select on public.player_progress for select to authenticated using (user_id=(select auth.uid()));
create policy preferences_owner_all on public.user_preferences for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy accounts_owner_all on public.accounts for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy entries_owner_all on public.entries for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy assets_owner_all on public.assets for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy goals_owner_all on public.goals for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy contributions_owner_select on public.contributions for select to authenticated using (user_id=(select auth.uid()));
create policy milestones_owner_select on public.milestone_claims for select to authenticated using (user_id=(select auth.uid()));
create policy difficulty_owner_select on public.difficulty_assessments for select to authenticated using (user_id=(select auth.uid()));
create policy difficulty_owner_insert on public.difficulty_assessments for insert to authenticated with check (user_id=(select auth.uid()));
create policy events_owner_select on public.gamification_events for select to authenticated using (user_id=(select auth.uid()));
create policy rewards_owner_select on public.reward_ledger for select to authenticated using (user_id=(select auth.uid()));
create policy request_keys_owner_select on public.request_keys for select to authenticated using (user_id=(select auth.uid()));

create or replace function public.create_entry(
  p_account_id uuid,p_title text,p_category text,p_type text,p_amount_cents bigint,p_date date,p_note text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_id uuid; v_previous jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[[:alnum:]_:-]{8,120}$' then raise exception 'Idempotency-Key inválida'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_idempotency_key,0));
  select response_json into v_previous from public.request_keys where user_id=v_user and key=p_idempotency_key;
  if found then return v_previous; end if;
  insert into public.entries(user_id,account_id,title,category,type,amount_cents,date,note)
  values(v_user,p_account_id,trim(p_title),trim(p_category),p_type,p_amount_cents,p_date,coalesce(p_note,''))
  returning id into v_id;
  insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id)
  values(v_user,case when p_type='expense' then 'expense_recorded' when p_type='income' then 'income_recorded' else 'financial_entry_updated' end,p_date,'entry:'||v_id::text||':created','entry',v_id);
  v_previous := pg_catalog.jsonb_build_object('id',v_id);
  insert into public.request_keys(user_id,key,response_json) values(v_user,p_idempotency_key,v_previous);
  return v_previous;
end; $$;

create or replace function public.create_contribution(
  p_goal_id uuid,p_amount_cents bigint,p_date date,p_note text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid()); v_goal public.goals%rowtype; v_saved bigint;
  v_id uuid; v_previous jsonb; v_reached integer[] := array[]::integer[]; v_milestone integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[[:alnum:]_:-]{8,120}$' then raise exception 'Idempotency-Key inválida'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_idempotency_key,0));
  select response_json into v_previous from public.request_keys where user_id=v_user and key=p_idempotency_key;
  if found then return v_previous; end if;
  select * into v_goal from public.goals where id=p_goal_id and user_id=v_user and archived_at is null for update;
  if not found then raise exception 'Objetivo não encontrado'; end if;
  select coalesce(sum(amount_cents),0) into v_saved from public.contributions where goal_id=p_goal_id and user_id=v_user;
  if p_amount_cents <= 0 or v_saved+p_amount_cents > v_goal.target_cents then
    raise exception 'O aporte ultrapassa o valor do objetivo' using errcode='23514';
  end if;
  insert into public.contributions(user_id,goal_id,amount_cents,date,note)
  values(v_user,p_goal_id,p_amount_cents,p_date,coalesce(p_note,'')) returning id into v_id;
  foreach v_milestone in array array[10,25,50,75,100] loop
    if v_saved*100 < v_goal.target_cents*v_milestone
      and (v_saved+p_amount_cents)*100 >= v_goal.target_cents*v_milestone then
      insert into public.milestone_claims(user_id,goal_id,milestone)
      values(v_user,p_goal_id,v_milestone) on conflict(goal_id,milestone) do nothing;
      if found then v_reached := pg_catalog.array_append(v_reached,v_milestone); end if;
    end if;
  end loop;
  insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id)
  values(v_user,'goal_progress_added',p_date,'contribution:'||v_id::text,'goal',p_goal_id);
  v_previous := pg_catalog.jsonb_build_object('id',v_id,'milestonesReached',v_reached);
  insert into public.request_keys(user_id,key,response_json) values(v_user,p_idempotency_key,v_previous);
  return v_previous;
end; $$;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.user_preferences,public.accounts,public.entries,public.assets,public.goals to authenticated;
grant select on public.profiles,public.player_progress,public.contributions,public.milestone_claims,public.difficulty_assessments,public.gamification_events,public.reward_ledger,public.request_keys to authenticated;
grant insert on public.difficulty_assessments to authenticated;
grant update(name) on public.profiles to authenticated;
grant execute on function public.create_entry(uuid,text,text,text,bigint,date,text,text) to authenticated;
grant execute on function public.create_contribution(uuid,bigint,date,text,text) to authenticated;

create or replace function public.archive_entry(p_entry_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_date date;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update public.entries set archived_at=now()
    where id=p_entry_id and user_id=v_user and archived_at is null returning date into v_date;
  if not found then raise exception 'Movimentação não encontrada' using errcode='P0002'; end if;
  insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id)
    values(v_user,'financial_entry_archived',v_date,'entry:'||p_entry_id::text||':archived','entry',p_entry_id)
    on conflict(user_id,idempotency_key) do nothing;
  return pg_catalog.jsonb_build_object('ok',true);
end; $$;
grant execute on function public.archive_entry(uuid) to authenticated;
