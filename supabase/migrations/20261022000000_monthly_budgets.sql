-- Additive planning data: never changes financial balances or rewards.
create table public.monthly_budgets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 month date not null check (extract(day from month)=1),
 category text not null check (category=btrim(category) and char_length(category) between 1 and 40),
 limit_cents bigint not null check (limit_cents between 1 and 100000000000),
 unique(user_id,month,category)
);
alter table public.monthly_budgets enable row level security;
create policy budgets_owner on public.monthly_budgets for all to authenticated
 using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
revoke all on public.monthly_budgets from public,anon;
grant select,insert,update,delete on public.monthly_budgets to authenticated;

create function public.monthly_budget_state(p_month date) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare u uuid:=auth.uid(); result jsonb;
begin
 if u is null then raise exception 'Sessão necessária.'; end if;
 if p_month is null or extract(day from p_month)<>1 then raise exception 'Mês inválido.'; end if;
 select jsonb_build_object(
  'budgets',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'category',b.category,'limitCents',b.limit_cents) order by b.category) from public.monthly_budgets b where b.user_id=u and b.month=p_month),'[]'::jsonb),
  'spending',coalesce((select jsonb_agg(jsonb_build_object('category',s.category,'spentCents',s.amount) order by s.category) from (
   select raw.category,sum(raw.amount) amount from (
    select e.category,e.amount_cents amount from public.entries e where e.user_id=u and e.type='expense' and e.archived_at is null and e.date>=p_month and e.date<(p_month+interval '1 month')
    union all
    select p.category,i.amount_cents from public.card_installments i join public.card_purchases p on p.id=i.purchase_id and p.user_id=i.user_id where i.user_id=u and i.bill_month=p_month and p.archived_at is null
   ) raw group by raw.category
  ) s),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.monthly_budget_state(date) from public,anon;
grant execute on function public.monthly_budget_state(date) to authenticated;
