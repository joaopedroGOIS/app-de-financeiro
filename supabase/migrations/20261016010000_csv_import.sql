-- CSV imports reuse financial RPCs. Preview does not write; commit rechecks duplicates.
create table public.csv_import_rows (
  user_id uuid not null references auth.users(id),
  fingerprint text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(user_id,fingerprint)
);
alter table public.csv_import_rows enable row level security;
create policy csv_import_owner_read on public.csv_import_rows for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.csv_import_rows from authenticated;
grant select on public.csv_import_rows to authenticated;
revoke all on public.csv_import_rows from anon,public;

create function public.import_csv(p_destination text,p_destination_id uuid,p_rows jsonb,p_commit boolean default false,p_first_month date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u uuid:=auth.uid(); r jsonb; results jsonb:='[]'; seen text[]:='{}'; v_fingerprint text;
  title text; normalized text; kind text; category text; amount bigint; day date; entity uuid; response jsonb; duplicate boolean;
begin
  if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_commit is null or p_destination not in ('account','card') or p_destination is null then raise exception 'Destino inválido.'; end if;
  if p_destination='account' and not exists(select 1 from public.accounts where id=p_destination_id and user_id=u) then raise exception 'Conta não encontrada.'; end if;
  if p_destination='card' and not exists(select 1 from public.credit_cards where id=p_destination_id and user_id=u and archived_at is null) then raise exception 'Cartão não encontrado.'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then raise exception 'Envie de 1 a 500 linhas.'; end if;
  if p_destination='card' and (p_first_month is null or extract(day from p_first_month)<>1) then raise exception 'Selecione a primeira fatura.'; end if;
  -- Serializes imports for this user, including overlapping files and simultaneous retries.
  perform pg_advisory_xact_lock(hashtextextended('csv:'||u::text,0));
  for r in select value from jsonb_array_elements(p_rows) loop
    title:=btrim(r->>'title'); normalized:=lower(regexp_replace(title,'\s+',' ','g'));
    kind:=r->>'type'; category:=r->>'category'; amount:=(r->>'amountCents')::bigint; day:=(r->>'date')::date;
    if title is null or char_length(title) not between 1 and 80 or amount is null or amount not between 1 and 100000000000
      or day is null or day>public.player_day(u) or kind is null or kind not in ('income','expense') then raise exception 'Linha inválida: confira descrição, data, tipo e valor.'; end if;
    if p_destination='card' and kind<>'expense' then raise exception 'Importe apenas compras no cartão; pagamentos e estornos exigem conferência separada.'; end if;
    if not exists(select 1 from public.categories where user_id=u and type=kind and name=category and archived_at is null) then raise exception 'Selecione uma categoria ativa para cada linha.'; end if;
    if p_destination='card' and title ~* '(parcela|parcelado|estorno|pagamento|[0-9]{1,2}[[:space:]]*/[[:space:]]*[0-9]{1,2})' then raise exception 'Parcelas, estornos e pagamentos não são compras completas importáveis.'; end if;
    v_fingerprint:=md5(jsonb_build_array(p_destination,p_destination_id,normalized,day,kind,amount)::text);
    duplicate:=v_fingerprint=any(seen) or exists(select 1 from public.csv_import_rows where user_id=u and csv_import_rows.fingerprint=v_fingerprint);
    if p_destination='account' then
      duplicate:=duplicate or exists(select 1 from public.entries e where e.user_id=u and e.account_id=p_destination_id and e.date=day and e.type=kind and e.amount_cents=amount and lower(regexp_replace(btrim(e.title),'\s+',' ','g'))=normalized);
    else
      duplicate:=duplicate or exists(select 1 from public.card_purchases c where c.user_id=u and c.card_id=p_destination_id and c.purchase_date=day and c.amount_cents=amount and lower(regexp_replace(btrim(c.title),'\s+',' ','g'))=normalized);
    end if;
    seen:=array_append(seen,v_fingerprint);
    entity:=null;
    if p_commit and not duplicate then
      if p_destination='account' then
        response:=public.create_entry_v2(p_destination_id,title,category,'',kind,amount,day,coalesce(r->>'note',''),'csv:'||v_fingerprint);
      else
        response:=public.create_card_purchase_with_interest(p_destination_id,title,category,'',amount,0,day,1,p_first_month,coalesce(r->>'note',''),'csv:'||v_fingerprint);
      end if;
      entity:=(response->>'id')::uuid;
      insert into public.csv_import_rows(user_id,fingerprint,entity_id) values(u,v_fingerprint,entity);
    end if;
    results:=results||jsonb_build_array(jsonb_build_object('line',r->'line','status',case when duplicate then 'duplicate' when p_commit then 'imported' else 'ready' end,'id',entity));
  end loop;
  return jsonb_build_object('rows',results);
end; $$;
revoke all on function public.import_csv(text,uuid,jsonb,boolean,date) from public,anon;
grant execute on function public.import_csv(text,uuid,jsonb,boolean,date) to authenticated;
