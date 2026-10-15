-- Cartões de crédito: compras e parcelas são despesas; pagamentos apenas liquidam a dívida.
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  last_four text not null default '' check (last_four = '' or last_four ~ '^[0-9]{4}$'),
  limit_cents bigint not null check (limit_cents between 1 and 100000000000),
  closing_day integer not null check (closing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id,user_id)
);
create table public.card_purchases (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null, title text not null check (char_length(trim(title)) between 1 and 80),
  category text not null, subcategory text not null default '',
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  purchase_date date not null check (purchase_date <= (now() at time zone 'America/Sao_Paulo')::date),
  installment_count integer not null check (installment_count between 1 and 60),
  note text not null default '' check (char_length(note) <= 300), archived_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (card_id,user_id) references public.credit_cards(id,user_id),
  check (amount_cents >= installment_count), unique(id,user_id), unique(id,card_id,user_id)
);
create table public.card_installments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid not null, card_id uuid not null, installment_number integer not null check (installment_number between 1 and 60),
  amount_cents bigint not null check (amount_cents > 0), due_date date not null,
  bill_month date not null check (extract(day from bill_month)=1),
  foreign key (purchase_id,card_id,user_id) references public.card_purchases(id,card_id,user_id),
  check (date_trunc('month',due_date)::date=bill_month), unique(purchase_id,installment_number)
);
create table public.card_payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null, account_id uuid not null, bill_month date not null check (extract(day from bill_month)=1),
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  payment_date date not null check (payment_date <= (now() at time zone 'America/Sao_Paulo')::date),
  note text not null default '' check (char_length(note) <= 300), archived_at timestamptz, created_at timestamptz not null default now(),
  foreign key (card_id,user_id) references public.credit_cards(id,user_id),
  foreign key (account_id,user_id) references public.accounts(id,user_id)
);
create index card_purchases_owner on public.card_purchases(user_id,card_id);
create index card_installments_bill on public.card_installments(user_id,card_id,bill_month);
create index card_payments_bill on public.card_payments(user_id,card_id,bill_month);
create index card_payments_account on public.card_payments(user_id,account_id);
alter table public.credit_cards enable row level security;
alter table public.card_purchases enable row level security;
alter table public.card_installments enable row level security;
alter table public.card_payments enable row level security;
create policy cards_owner_read on public.credit_cards for select to authenticated using (user_id=(select auth.uid()));
create policy purchases_owner_read on public.card_purchases for select to authenticated using (user_id=(select auth.uid()));
create policy installments_owner_read on public.card_installments for select to authenticated using (user_id=(select auth.uid()));
create policy payments_owner_read on public.card_payments for select to authenticated using (user_id=(select auth.uid()));
revoke all on public.credit_cards,public.card_purchases,public.card_installments,public.card_payments from public,anon,authenticated;
grant select on public.credit_cards,public.card_purchases,public.card_installments,public.card_payments to authenticated;

create function public.card_calendar_day(p_month date,p_day integer) returns date
language sql immutable set search_path='' as $$
  select date_trunc('month',p_month)::date + (least(p_day,extract(day from (date_trunc('month',p_month)+interval '1 month - 1 day'))::integer)-1);
$$;

-- O bloqueio do cartão serializa compras/pagamentos, protegendo limite e saldo da fatura.
create function public.save_credit_card(p_id uuid,p_name text,p_last_four text,p_limit_cents bigint,p_closing_day integer,p_due_day integer,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); v_id uuid; previous jsonb; committed bigint;
begin
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_key is null or p_key !~ '^[[:alnum:]_:-]{8,120}$' then raise exception 'Chave de operação inválida.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_key,0));
  select response_json into previous from public.request_keys where user_id=u and key=p_key;
  if found then return previous; end if;
  if p_id is null then
    insert into public.credit_cards(user_id,name,last_four,limit_cents,closing_day,due_day)
      values(u,trim(p_name),coalesce(p_last_four,''),p_limit_cents,p_closing_day,p_due_day) returning id into v_id;
  else
    perform 1 from public.credit_cards where id=p_id and user_id=u and archived_at is null for update;
    if not found then raise exception 'Cartão não encontrado.'; end if;
    select coalesce(sum(i.amount_cents),0) into committed from public.card_installments i join public.card_purchases p on p.id=i.purchase_id where i.card_id=p_id and i.user_id=u and p.archived_at is null;
    select committed-coalesce(sum(amount_cents),0) into committed from public.card_payments where card_id=p_id and user_id=u and archived_at is null;
    if p_limit_cents < committed then raise exception 'O limite não pode ser menor que o valor comprometido.'; end if;
    update public.credit_cards set name=trim(p_name),last_four=coalesce(p_last_four,''),limit_cents=p_limit_cents,closing_day=p_closing_day,due_day=p_due_day where id=p_id and user_id=u;
    v_id := p_id;
  end if;
  previous := jsonb_build_object('id',v_id);
  insert into public.request_keys(user_id,key,response_json) values(u,p_key,previous);
  return previous;
end; $$;

create function public.create_card_purchase(p_card_id uuid,p_title text,p_category text,p_subcategory text,p_amount_cents bigint,p_date date,p_installments integer,p_first_month date,p_note text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); c public.credit_cards%rowtype; v_id uuid; previous jsonb; committed bigint; i integer; m date; first_due date;
begin
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_key is null or p_key !~ '^[[:alnum:]_:-]{8,120}$' then raise exception 'Chave de operação inválida.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_key,0));
  select response_json into previous from public.request_keys where user_id=u and key=p_key;
  if found then return previous; end if;
  select * into c from public.credit_cards where id=p_card_id and user_id=u and archived_at is null for update;
  if not found then raise exception 'Cartão não encontrado.'; end if;
  if p_amount_cents is null or p_amount_cents<=0 or p_installments is null or p_installments not between 1 and 60 or p_amount_cents<p_installments then raise exception 'Confira o valor e o número de parcelas.'; end if;
  if not exists(select 1 from public.categories where user_id=u and type='expense' and name=trim(p_category) and archived_at is null) then raise exception 'Selecione uma categoria de gasto ativa.'; end if;
  if trim(coalesce(p_subcategory,''))<>'' and not exists(select 1 from public.subcategories s join public.categories cat on cat.id=s.category_id and cat.user_id=s.user_id where s.user_id=u and cat.type='expense' and cat.name=trim(p_category) and cat.archived_at is null and s.name=trim(p_subcategory) and s.archived_at is null) then raise exception 'Selecione uma subcategoria ativa desta categoria.'; end if;
  select coalesce(sum(i.amount_cents),0) into committed from public.card_installments i join public.card_purchases p on p.id=i.purchase_id where i.card_id=c.id and i.user_id=u and p.archived_at is null;
  select committed-coalesce(sum(amount_cents),0) into committed from public.card_payments where card_id=c.id and user_id=u and archived_at is null;
  if committed+p_amount_cents>c.limit_cents then raise exception 'A compra ultrapassa o limite disponível do cartão.'; end if;
  m := date_trunc('month',p_date)::date;
  if p_date>=public.card_calendar_day(m,c.closing_day) then m := (m+interval '1 month')::date; end if;
  if c.due_day<=c.closing_day then m := (m+interval '1 month')::date; end if;
  if p_first_month is not null then m := date_trunc('month',p_first_month)::date; end if;
  first_due := public.card_calendar_day(m,c.due_day);
  if first_due<p_date or m>(date_trunc('month',p_date)+interval '12 months')::date then raise exception 'Confira o mês da primeira fatura.'; end if;
  insert into public.card_purchases(user_id,card_id,title,category,subcategory,amount_cents,purchase_date,installment_count,note)
    values(u,c.id,trim(p_title),trim(p_category),trim(coalesce(p_subcategory,'')),p_amount_cents,p_date,p_installments,coalesce(p_note,'')) returning id into v_id;
  for i in 0..p_installments-1 loop
    insert into public.card_installments(user_id,purchase_id,card_id,installment_number,amount_cents,due_date,bill_month)
      values(u,v_id,c.id,i+1,p_amount_cents/p_installments+case when i<p_amount_cents%p_installments then 1 else 0 end,public.card_calendar_day((m+make_interval(months=>i))::date,c.due_day),(m+make_interval(months=>i))::date);
  end loop;
  previous := jsonb_build_object('id',v_id);
  insert into public.request_keys(user_id,key,response_json) values(u,p_key,previous);
  return previous;
end; $$;

create function public.pay_card_bill(p_card_id uuid,p_month date,p_account_id uuid,p_amount_cents bigint,p_date date,p_note text,p_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); v_id uuid; previous jsonb; total bigint; paid bigint;
begin
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_key is null or p_key !~ '^[[:alnum:]_:-]{8,120}$' then raise exception 'Chave de operação inválida.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_key,0));
  select response_json into previous from public.request_keys where user_id=u and key=p_key;
  if found then return previous; end if;
  perform 1 from public.credit_cards where id=p_card_id and user_id=u and archived_at is null for update;
  if not found then raise exception 'Cartão não encontrado.'; end if;
  perform 1 from public.accounts where id=p_account_id and user_id=u for update;
  if not found then raise exception 'Conta não encontrada.'; end if;
  select coalesce(sum(i.amount_cents),0) into total from public.card_installments i join public.card_purchases p on p.id=i.purchase_id where i.user_id=u and i.card_id=p_card_id and i.bill_month=p_month and p.archived_at is null;
  select coalesce(sum(amount_cents),0) into paid from public.card_payments where user_id=u and card_id=p_card_id and bill_month=p_month and archived_at is null;
  if p_amount_cents is null or p_amount_cents<=0 or p_amount_cents>total-paid then raise exception 'O pagamento deve ser maior que zero e não pode exceder o saldo da fatura.'; end if;
  if exists(select 1 from public.card_installments i join public.card_purchases p on p.id=i.purchase_id where i.card_id=p_card_id and i.user_id=u and i.bill_month=p_month and p.archived_at is null and p.purchase_date>p_date) then raise exception 'O pagamento não pode ser anterior às compras da fatura.'; end if;
  insert into public.card_payments(user_id,card_id,account_id,bill_month,amount_cents,payment_date,note) values(u,p_card_id,p_account_id,p_month,p_amount_cents,p_date,coalesce(p_note,'')) returning id into v_id;
  previous := jsonb_build_object('id',v_id);
  insert into public.request_keys(user_id,key,response_json) values(u,p_key,previous);
  return previous;
end; $$;

create function public.archive_card_purchase(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); v_card uuid;
begin
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select card_id into v_card from public.card_purchases where id=p_id and user_id=u and archived_at is null;
  if not found then raise exception 'Compra não encontrada.'; end if;
  perform 1 from public.credit_cards where id=v_card and user_id=u for update;
  if exists(select 1 from public.card_payments pay join public.card_installments i on i.card_id=pay.card_id and i.bill_month=pay.bill_month and i.user_id=pay.user_id where i.purchase_id=p_id and i.user_id=u and pay.archived_at is null) then raise exception 'Esta compra tem fatura com pagamento registrado e não pode ser arquivada.'; end if;
  update public.card_purchases set archived_at=now() where id=p_id and user_id=u;
  return jsonb_build_object('ok',true);
end; $$;

create function public.archive_credit_card(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); committed bigint;
begin
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform 1 from public.credit_cards where id=p_id and user_id=u and archived_at is null for update;
  if not found then raise exception 'Cartão não encontrado.'; end if;
  select coalesce(sum(i.amount_cents),0) into committed from public.card_installments i join public.card_purchases p on p.id=i.purchase_id where i.card_id=p_id and i.user_id=u and p.archived_at is null;
  select committed-coalesce(sum(amount_cents),0) into committed from public.card_payments where card_id=p_id and user_id=u and archived_at is null;
  if committed<>0 then raise exception 'Quite todas as faturas antes de arquivar este cartão.'; end if;
  update public.credit_cards set archived_at=now() where id=p_id and user_id=u;
  return jsonb_build_object('ok',true);
end; $$;

create function public.reverse_card_payment(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); v_card uuid;
begin
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select card_id into v_card from public.card_payments where id=p_id and user_id=u and archived_at is null;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  perform 1 from public.credit_cards where id=v_card and user_id=u for update;
  update public.card_payments set archived_at=now() where id=p_id and user_id=u and archived_at is null;
  -- Se o cartão foi arquivado após a quitação, volta a aparecer para permitir pagar a dívida reaberta.
  update public.credit_cards set archived_at=null where id=v_card and user_id=u;
  return jsonb_build_object('ok',true);
end; $$;
revoke all on function public.reverse_card_payment(uuid) from public,anon;
grant execute on function public.reverse_card_payment(uuid) to authenticated;

-- Evita apagar uma categoria histórica do saldo ao arquivar a compra; as linhas continuam auditáveis.
-- O RPC é invoker: cada SELECT respeita RLS. Agrega no banco para não truncar valores no limite de linhas REST.
create function public.credit_card_state() returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object(
    'cards',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at,c.id) from public.credit_cards c),'[]'::jsonb),
    'purchases',coalesce((select jsonb_agg(to_jsonb(p) order by p.purchase_date desc,p.id) from public.card_purchases p where p.archived_at is null),'[]'::jsonb),
    'installments',coalesce((select jsonb_agg(to_jsonb(i) order by i.due_date,i.id) from public.card_installments i join public.card_purchases p on p.id=i.purchase_id where p.archived_at is null),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.payment_date desc,p.id) from public.card_payments p where p.archived_at is null),'[]'::jsonb)
  );
$$;
revoke all on function public.card_calendar_day(date,integer) from public,anon,authenticated;
revoke all on function public.save_credit_card(uuid,text,text,bigint,integer,integer,text) from public,anon;
revoke all on function public.create_card_purchase(uuid,text,text,text,bigint,date,integer,date,text,text) from public,anon;
revoke all on function public.pay_card_bill(uuid,date,uuid,bigint,date,text,text) from public,anon;
revoke all on function public.archive_card_purchase(uuid),public.archive_credit_card(uuid),public.credit_card_state() from public,anon;
grant execute on function public.save_credit_card(uuid,text,text,bigint,integer,integer,text),public.create_card_purchase(uuid,text,text,text,bigint,date,integer,date,text,text),public.pay_card_bill(uuid,date,uuid,bigint,date,text,text),public.archive_card_purchase(uuid),public.archive_credit_card(uuid),public.credit_card_state() to authenticated;
