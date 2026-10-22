-- Monthly plans are separate from expenses. Only an explicit payment creates an entry.
create table public.recurring_expenses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 80),
 category text not null check(char_length(btrim(category)) between 1 and 40),
 amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 due_day integer not null check(due_day between 1 and 31),
 start_month date not null check(extract(day from start_month)=1), stopped_on date,
 unique(id,user_id)
);
create table public.recurring_payments (
 user_id uuid not null references auth.users(id) on delete cascade,
 recurring_id uuid not null, month date not null check(extract(day from month)=1), entry_id uuid not null,
 primary key(recurring_id,month), unique(entry_id),
 foreign key(recurring_id,user_id) references public.recurring_expenses(id,user_id),
 foreign key(entry_id,user_id) references public.entries(id,user_id)
);
alter table public.recurring_expenses enable row level security;
alter table public.recurring_payments enable row level security;
create policy recurring_owner_read on public.recurring_expenses for select to authenticated using(user_id=(select auth.uid()));
create policy recurring_payment_owner_read on public.recurring_payments for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.recurring_expenses,public.recurring_payments from public,anon,authenticated;
grant select on public.recurring_expenses,public.recurring_payments to authenticated;

create function public.recurring_due_date(p_month date,p_day integer) returns date language sql immutable set search_path='' as $$
 select (p_month + (least(p_day,extract(day from (p_month+interval '1 month - 1 day'))::integer)-1))::date;
$$;
create function public.create_recurring_expense(p_title text,p_category text,p_amount_cents bigint,p_due_day integer,p_start_month date,p_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb; rid uuid;
begin
 if u is null then raise exception 'Sessão necessária.'; end if;
 if p_key is null or p_key !~ '^[[:alnum:]_:-]{8,90}$' then raise exception 'Chave inválida.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':recurring-create:'||p_key,0));
 select response_json into result from public.request_keys where user_id=u and key='recurring-create:'||p_key;
 if found then return result; end if;
 if not exists(select 1 from public.categories where user_id=u and type='expense' and name=btrim(p_category) and archived_at is null) then raise exception 'Selecione uma categoria de gasto ativa.'; end if;
 insert into public.recurring_expenses(user_id,title,category,amount_cents,due_day,start_month) values(u,btrim(p_title),btrim(p_category),p_amount_cents,p_due_day,p_start_month) returning id into rid;
 result:=jsonb_build_object('id',rid);
 insert into public.request_keys(user_id,key,response_json) values(u,'recurring-create:'||p_key,result);
 return result;
end $$;

create function public.recurring_expense_state(p_month date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); d date:=public.player_day(auth.uid()); result jsonb;
begin
 if u is null then raise exception 'Sessão necessária.'; end if;
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Mês inválido.'; end if;
 select jsonb_build_object('today',d,
 'templates',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'category',r.category,'amountCents',r.amount_cents,'dueDay',r.due_day,'startMonth',to_char(r.start_month,'YYYY-MM'),'stoppedOn',r.stopped_on) order by r.title) from public.recurring_expenses r where r.user_id=u),'[]'::jsonb),
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'category',r.category,'amountCents',r.amount_cents,'dueDay',r.due_day,'startMonth',to_char(r.start_month,'YYYY-MM'),'stoppedOn',r.stopped_on,'dueDate',public.recurring_due_date(p_month,r.due_day),'entryId',p.entry_id,'paidAmountCents',e.amount_cents,'paidCategory',e.category,'paymentDate',e.date,'status',case when p.entry_id is not null then case when e.archived_at is null and e.type='expense' then 'paid' else 'reversed' end when public.recurring_due_date(p_month,r.due_day)<d then 'overdue' else 'pending' end) order by public.recurring_due_date(p_month,r.due_day),r.title)
 from public.recurring_expenses r left join public.recurring_payments p on p.recurring_id=r.id and p.user_id=u and p.month=p_month left join public.entries e on e.id=p.entry_id and e.user_id=u
 where r.user_id=u and r.start_month<=p_month and (r.stopped_on is null or public.recurring_due_date(p_month,r.due_day)<=r.stopped_on or p.entry_id is not null)),'[]'::jsonb)) into result;
 return result;
end $$;

create function public.pay_recurring_expense(p_id uuid,p_month date,p_account_id uuid,p_amount_cents bigint,p_date date,p_category text,p_existing_entry_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r public.recurring_expenses; e public.entries; eid uuid; result jsonb;
begin
 if u is null then raise exception 'Sessão necessária.'; end if;
 select * into r from public.recurring_expenses where id=p_id and user_id=u for update;
 if not found then raise exception 'Recorrência não encontrada.'; end if;
 if p_month is null or extract(day from p_month)<>1 or p_month<r.start_month then raise exception 'Mês inválido.'; end if;
 select entry_id into eid from public.recurring_payments where recurring_id=p_id and user_id=u and month=p_month;
 if eid is not null then
  select * into e from public.entries where id=eid and user_id=u for update;
  if e.archived_at is null and e.type='expense' then return jsonb_build_object('id',eid,'alreadyPaid',true); end if;
 elsif r.stopped_on is not null and public.recurring_due_date(p_month,r.due_day)>r.stopped_on then raise exception 'Esta ocorrência foi encerrada.';
 end if;
 if p_existing_entry_id is not null then
  if eid is not null then raise exception 'Reative o lançamento original desta ocorrência.'; end if;
  select * into e from public.entries where id=p_existing_entry_id and user_id=u and type='expense' and archived_at is null and date<=public.player_day(u) for update;
  if not found then raise exception 'Selecione uma despesa ativa da sua conta.'; end if;
  if exists(select 1 from public.recurring_payments where entry_id=e.id) then raise exception 'Esta movimentação já está vinculada a outro compromisso.'; end if;
  insert into public.recurring_payments(user_id,recurring_id,month,entry_id) values(u,p_id,p_month,e.id);
  return jsonb_build_object('id',e.id,'linked',true);
 end if;
 if p_date is null or p_date>public.player_day(u) then raise exception 'Use uma data de pagamento de hoje ou anterior.'; end if;
 if p_amount_cents is null or p_amount_cents<1 or p_amount_cents>100000000000 then raise exception 'Valor inválido.'; end if;
 if not exists(select 1 from public.accounts where id=p_account_id and user_id=u) then raise exception 'Conta não encontrada.'; end if;
 if eid is null then
  result:=public.create_entry_v2(p_account_id,r.title,p_category,'','expense',p_amount_cents,p_date,'Pagamento de despesa recorrente · referência '||to_char(p_month,'YYYY-MM'),'recurring-pay:'||gen_random_uuid()::text);
  eid:=(result->>'id')::uuid;
  insert into public.recurring_payments(user_id,recurring_id,month,entry_id) values(u,p_id,p_month,eid);
 else
  -- Reactivate the same entry; never create a second purchase/reward event for this occurrence.
  update public.entries set account_id=p_account_id,title=r.title,category=p_category,subcategory='',type='expense',amount_cents=p_amount_cents,date=p_date,archived_at=null where id=eid and user_id=u;
 end if;
 return jsonb_build_object('id',eid);
end $$;
create function public.reverse_recurring_payment(p_id uuid,p_month date) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); eid uuid;
begin
 if u is null then raise exception 'Sessão necessária.'; end if;
 perform 1 from public.recurring_expenses where id=p_id and user_id=u for update;
 if not found then raise exception 'Recorrência não encontrada.'; end if;
 select entry_id into eid from public.recurring_payments where recurring_id=p_id and user_id=u and month=p_month;
 if eid is null then raise exception 'Pagamento não encontrado.'; end if;
 if exists(select 1 from public.entries where id=eid and user_id=u and archived_at is null) then perform public.archive_entry(eid); end if;
 return jsonb_build_object('ok',true);
end $$;
create function public.stop_recurring_expense(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sessão necessária.'; end if;
 update public.recurring_expenses set stopped_on=coalesce(stopped_on,public.player_day(auth.uid())) where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Recorrência não encontrada.'; end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.recurring_due_date(date,integer),public.create_recurring_expense(text,text,bigint,integer,date,text),public.recurring_expense_state(date),public.pay_recurring_expense(uuid,date,uuid,bigint,date,text,uuid),public.reverse_recurring_payment(uuid,date),public.stop_recurring_expense(uuid) from public,anon;
grant execute on function public.recurring_due_date(date,integer),public.create_recurring_expense(text,text,bigint,integer,date,text),public.recurring_expense_state(date),public.pay_recurring_expense(uuid,date,uuid,bigint,date,text,uuid),public.reverse_recurring_payment(uuid,date),public.stop_recurring_expense(uuid) to authenticated;
