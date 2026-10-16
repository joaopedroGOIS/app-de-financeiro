-- Registra o custo dos juros separadamente, mantendo amount_cents como total financiado.
alter table public.card_purchases add column interest_cents bigint not null default 0
  check (interest_cents >= 0 and interest_cents < amount_cents);

create function public.create_card_purchase_with_interest(
  p_card_id uuid,p_title text,p_category text,p_subcategory text,p_principal_cents bigint,p_interest_cents bigint,
  p_date date,p_installments integer,p_first_month date,p_note text,p_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); previous jsonb; result jsonb;
begin
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_key is null or p_key !~ '^[[:alnum:]_:-]{8,120}$' then raise exception 'Chave de operação inválida.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_key,0));
  select response_json into previous from public.request_keys where user_id=u and key=p_key;
  if found then return previous; end if;
  if p_principal_cents is null or p_principal_cents<=0 or p_principal_cents>100000000000
    or p_interest_cents is null or p_interest_cents<0 or p_interest_cents>100000000000
    or p_principal_cents+p_interest_cents>100000000000 then
    raise exception 'Confira o valor original e os juros totais da compra.';
  end if;
  result := public.create_card_purchase(p_card_id,p_title,p_category,p_subcategory,p_principal_cents+p_interest_cents,p_date,p_installments,p_first_month,p_note,p_key);
  update public.card_purchases set interest_cents=p_interest_cents where id=(result->>'id')::uuid and user_id=u;
  return result;
end; $$;
revoke all on function public.create_card_purchase_with_interest(uuid,text,text,text,bigint,bigint,date,integer,date,text,text) from public,anon;
grant execute on function public.create_card_purchase_with_interest(uuid,text,text,text,bigint,bigint,date,integer,date,text,text) to authenticated;
