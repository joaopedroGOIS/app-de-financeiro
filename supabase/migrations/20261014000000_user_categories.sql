-- Per-user category catalogs. Entry labels remain snapshots so catalog edits never
-- rewrite financial history.
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense','adjustment')),
  name text not null check (char_length(trim(name)) between 1 and 40),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id,user_id)
);
create unique index if not exists categories_active_name
  on public.categories(user_id,type,lower(trim(name))) where archived_at is null;
create index if not exists categories_user_type
  on public.categories(user_id,type,archived_at);

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 40),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id,user_id),
  foreign key (category_id,user_id) references public.categories(id,user_id) on delete restrict
);
create unique index if not exists subcategories_active_name
  on public.subcategories(user_id,category_id,lower(trim(name))) where archived_at is null;
create index if not exists subcategories_user_category
  on public.subcategories(user_id,category_id,archived_at);

alter table public.entries
  add column if not exists subcategory text not null default ''
  check (char_length(subcategory) <= 40);

create or replace function public.seed_categories_for_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.categories(user_id,type,name)
  select distinct on (e.type,pg_catalog.lower(pg_catalog.btrim(e.category)))
    p_user_id,e.type,pg_catalog.btrim(e.category)
  from public.entries e
  where e.user_id=p_user_id and e.type in ('income','expense','adjustment')
    and pg_catalog.char_length(pg_catalog.btrim(e.category)) between 1 and 40
  order by e.type,pg_catalog.lower(pg_catalog.btrim(e.category)),e.created_at asc,e.id asc
  on conflict do nothing;

  insert into public.categories(user_id,type,name)
  select p_user_id,d.type,d.name
  from (values
    ('expense','Alimentação'),('expense','Moradia'),('expense','Transporte'),
    ('expense','Compras'),('expense','Saúde'),('expense','Lazer'),
    ('expense','Educação'),('expense','Outros'),
    ('income','Salário'),('income','Freelance'),('income','Investimentos'),
    ('income','Presente'),('income','Outros'),
    ('adjustment','Ajuste de saldo')
  ) as d(type,name)
  on conflict do nothing;
end; $$;

-- Seed current users without changing the labels stored in entries.
do $$
declare v_user record;
begin
  for v_user in select id from auth.users loop
    perform public.seed_categories_for_user(v_user.id);
  end loop;
end; $$;

-- New accounts receive the same starter catalog as existing accounts.
create or replace function public.bootstrap_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,name)
  values (new.id,coalesce(new.raw_user_meta_data ->> 'name',''));
  insert into public.player_progress(user_id) values (new.id);
  perform public.seed_categories_for_user(new.id);
  return new;
end; $$;

alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
create policy categories_owner_all on public.categories for all to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy subcategories_owner_all on public.subcategories for all to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

grant select,insert,update on public.categories,public.subcategories to authenticated;
revoke all on public.categories,public.subcategories from public,anon;

create or replace function public.validate_entry_category() returns trigger
language plpgsql set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if tg_op='UPDATE'
    and new.category is not distinct from old.category
    and new.type is not distinct from old.type
    and new.subcategory is not distinct from old.subcategory then
    return new;
  end if;
  if v_user is null or not exists (
    select 1 from public.categories c
    where c.user_id=v_user and c.type=new.type and c.name=new.category and c.archived_at is null
  ) then
    raise exception 'Selecione uma categoria ativa da sua conta.' using errcode='23514';
  end if;
  if pg_catalog.btrim(coalesce(new.subcategory,'')) <> '' and not exists (
    select 1 from public.subcategories s
    join public.categories c on c.id=s.category_id and c.user_id=s.user_id
    where s.user_id=v_user and c.name=new.category and c.type=new.type
      and c.archived_at is null and s.name=new.subcategory and s.archived_at is null
  ) then
    raise exception 'Selecione uma subcategoria ativa desta categoria.' using errcode='23514';
  end if;
  return new;
end; $$;
drop trigger if exists entries_category_guard on public.entries;
create trigger entries_category_guard before insert or update of category,type,subcategory
  on public.entries for each row execute function public.validate_entry_category();

create or replace function public.create_entry_v2(
  p_account_id uuid,p_title text,p_category text,p_subcategory text,p_type text,
  p_amount_cents bigint,p_date date,p_note text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_id uuid; v_previous jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[[:alnum:]_:-]{8,120}$' then raise exception 'Idempotency-Key inválida'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_idempotency_key,0));
  select response_json into v_previous from public.request_keys where user_id=v_user and key=p_idempotency_key;
  if found then return v_previous; end if;
  insert into public.entries(user_id,account_id,title,category,subcategory,type,amount_cents,date,note)
  values(v_user,p_account_id,pg_catalog.btrim(p_title),pg_catalog.btrim(p_category),coalesce(pg_catalog.btrim(p_subcategory),''),p_type,p_amount_cents,p_date,coalesce(p_note,''))
  returning id into v_id;
  insert into public.gamification_events(user_id,event_type,business_date,idempotency_key,entity_type,entity_id)
  values(v_user,case when p_type='expense' then 'expense_recorded' when p_type='income' then 'income_recorded' else 'financial_entry_updated' end,p_date,'entry:'||v_id::text||':created','entry',v_id);
  v_previous := pg_catalog.jsonb_build_object('id',v_id);
  insert into public.request_keys(user_id,key,response_json) values(v_user,p_idempotency_key,v_previous);
  return v_previous;
end; $$;

create or replace function public.archive_category(p_category_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_updated integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update public.categories set archived_at=coalesce(archived_at,now())
    where id=p_category_id and user_id=v_user and archived_at is null;
  get diagnostics v_updated = row_count;
  if v_updated=0 then raise exception 'Categoria não encontrada.' using errcode='P0002'; end if;
  update public.subcategories set archived_at=coalesce(archived_at,now())
    where category_id=p_category_id and user_id=v_user and archived_at is null;
  return pg_catalog.jsonb_build_object('ok',true);
end; $$;

grant execute on function public.create_entry_v2(uuid,text,text,text,text,bigint,date,text,text) to authenticated;
grant execute on function public.archive_category(uuid) to authenticated;
revoke all on function public.seed_categories_for_user(uuid) from public,anon,authenticated;
revoke all on function public.validate_entry_category() from public,anon,authenticated;
revoke all on function public.create_entry_v2(uuid,text,text,text,text,bigint,date,text,text) from public,anon;
revoke all on function public.archive_category(uuid) from public,anon;
