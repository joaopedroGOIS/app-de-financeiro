-- Lojinha, fase 2: catálogo, inventário, itens equipados e compras com Graninhas.
-- Aprovado em 26/11/2026 (documento "Proposta: Perfil, pets e Lojinha", seções 3 a 6).
-- Só acrescenta tabelas e funções; não altera dados existentes. TODOS os itens entram
-- desligados (active=false): ninguém compra nada até a migration de ativação.
-- Desfazer (somente em caso de problema): supabase/rollbacks/20261128000000_cosmetics_shop.down.sql

create table public.cosmetic_items (
  code text primary key check (code ~ '^[a-z]+-[a-z]+$'),
  slot text not null check (slot in ('hair','outfit','hat','accessory','companion','theme','frame','title')),
  name text not null check (char_length(name) between 1 and 60),
  rarity text not null check (rarity in ('padrao','raro','extra','mitico','lendario')),
  -- 0 = grátis; null = só por conquista (Lendários, fase 3).
  price integer check (price is null or price >= 0),
  requirement jsonb,
  active boolean not null default false,
  config_version text not null default 'cosmetics_v1_20261126',
  created_at timestamptz not null default now(),
  check ((rarity = 'lendario') = (price is null)),
  check ((price is null) = (requirement is not null))
);

create table public.inventory_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_code text not null references public.cosmetic_items(code),
  source text not null check (source in ('purchase','achievement')),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_code)
);

create table public.equipped_cosmetics (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null check (slot in ('hair','outfit','hat','accessory','companion','theme','frame','title')),
  item_code text not null references public.cosmetic_items(code),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

-- Cada gasto de Graninhas. Imutável, como o reward_ledger.
create table public.graninha_spend_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_code text not null references public.cosmetic_items(code),
  amount integer not null check (amount > 0),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (user_id, item_code)
);
create or replace function public.reject_spend_ledger_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'graninha_spend_ledger is immutable'; end; $$;
create trigger graninha_spend_ledger_immutable before update or delete on public.graninha_spend_ledger
for each row execute function public.reject_spend_ledger_mutation();

insert into public.cosmetic_items(code, slot, name, rarity, price, requirement) values
  ('hair-short', 'hair', 'Corte curto', 'padrao', 0, null),
  ('hair-bun', 'hair', 'Coque', 'padrao', 50, null),
  ('hair-long', 'hair', 'Cabelo longo', 'padrao', 50, null),
  ('hair-mohawk', 'hair', 'Moicano', 'padrao', 70, null),
  ('outfit-tunic', 'outfit', 'Túnica simples', 'padrao', 0, null),
  ('outfit-ranger', 'outfit', 'Roupa de patrulheiro', 'padrao', 60, null),
  ('outfit-mage', 'outfit', 'Manto do mago', 'raro', 180, null),
  ('outfit-goose', 'outfit', 'Fantasia de ganso', 'raro', 220, null),
  ('outfit-knight', 'outfit', 'Armadura de cavaleiro', 'extra', 450, null),
  ('outfit-stellar', 'outfit', 'Armadura estelar', 'mitico', 850, null),
  ('outfit-royal', 'outfit', 'Traje real', 'lendario', null, '{"kind":"streak","days":100}'::jsonb),
  ('hat-none', 'hat', 'Sem chapéu', 'padrao', 0, null),
  ('hat-cap', 'hat', 'Boné vermelho', 'padrao', 60, null),
  ('hat-wizard', 'hat', 'Chapéu de mago', 'raro', 200, null),
  ('hat-helmet', 'hat', 'Elmo de prata', 'extra', 400, null),
  ('hat-crown', 'hat', 'Coroa da constância', 'lendario', null, '{"kind":"streak","days":30}'::jsonb),
  ('acc-none', 'accessory', 'Sem acessório', 'padrao', 0, null),
  ('acc-glasses', 'accessory', 'Óculos de leitura', 'padrao', 40, null),
  ('acc-scarf', 'accessory', 'Cachecol', 'padrao', 60, null),
  ('acc-cape', 'accessory', 'Capa carmesim', 'raro', 250, null),
  ('acc-wings', 'accessory', 'Asas de cristal', 'mitico', 800, null),
  ('pet-none', 'companion', 'Sem companheiro', 'padrao', 0, null),
  ('pet-slime', 'companion', 'Slime verde', 'padrao', 80, null),
  ('pet-cat', 'companion', 'Gato de rua', 'raro', 180, null),
  ('pet-goose', 'companion', 'Ganso companheiro', 'extra', 500, null),
  ('pet-phoenix', 'companion', 'Fênix de brasa', 'mitico', 900, null),
  ('pet-dragon', 'companion', 'Dragão do controle', 'lendario', null, '{"kind":"mission","code":"control_master"}'::jsonb),
  ('theme-night', 'theme', 'Noite roxa', 'padrao', 0, null),
  ('theme-forest', 'theme', 'Floresta encantada', 'raro', 150, null),
  ('theme-ocean', 'theme', 'Mar profundo', 'raro', 150, null),
  ('theme-ember', 'theme', 'Forja em brasa', 'extra', 400, null),
  ('theme-aurora', 'theme', 'Aurora boreal', 'mitico', 750, null),
  ('theme-royal', 'theme', 'Tesouro real', 'lendario', null, '{"kind":"streak","days":365}'::jsonb),
  ('frame-classic', 'frame', 'Moldura clássica', 'padrao', 0, null),
  ('frame-mint', 'frame', 'Moldura menta', 'padrao', 80, null),
  ('frame-crimson', 'frame', 'Moldura carmesim', 'raro', 160, null),
  ('frame-gold', 'frame', 'Moldura dourada', 'extra', 420, null),
  ('title-adventurer', 'title', 'Aventureiro', 'padrao', 0, null),
  ('title-thrifty', 'title', 'O Econômico', 'padrao', 40, null),
  ('title-sheets', 'title', 'Mestre das Planilhas', 'raro', 150, null),
  ('title-archmage', 'title', 'Arquimago das Finanças', 'mitico', 700, null)
;

alter table public.cosmetic_items enable row level security;
alter table public.inventory_items enable row level security;
alter table public.equipped_cosmetics enable row level security;
alter table public.graninha_spend_ledger enable row level security;
create policy cosmetic_items_read on public.cosmetic_items for select to authenticated using (true);
create policy inventory_owner_read on public.inventory_items for select to authenticated using (user_id = (select auth.uid()));
create policy equipped_owner_read on public.equipped_cosmetics for select to authenticated using (user_id = (select auth.uid()));
create policy spend_owner_read on public.graninha_spend_ledger for select to authenticated using (user_id = (select auth.uid()));
-- Só leitura direta: toda escrita passa pelas funções abaixo.
revoke all on public.cosmetic_items, public.inventory_items, public.equipped_cosmetics, public.graninha_spend_ledger from public, anon, authenticated;
grant select on public.cosmetic_items, public.inventory_items, public.equipped_cosmetics, public.graninha_spend_ledger to authenticated;

-- Compra: confere tudo e desconta o saldo numa única transação.
create or replace function public.purchase_cosmetic(p_item text, p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  item public.cosmetic_items;
  prior public.graninha_spend_ledger;
  balance integer;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_key is null or char_length(p_key) not between 8 and 100 then raise exception 'INVALID_KEY' using errcode = '22023'; end if;
  -- Trava o saldo do jogador: compras simultâneas e recompensas esperam umas pelas outras.
  select graninha_balance into balance from public.player_progress where user_id = uid for update;
  if not found then raise exception 'PROGRESS_MISSING' using errcode = 'P0002'; end if;
  -- Mesma chave = mesma compra, sem cobrar de novo.
  select * into prior from public.graninha_spend_ledger where user_id = uid and idempotency_key = p_key;
  if found then
    return jsonb_build_object('status','already','item',prior.item_code,'price',prior.amount,'balance',balance);
  end if;
  select * into item from public.cosmetic_items where code = p_item;
  if not found then raise exception 'ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item.price is null or item.price = 0 then raise exception 'NOT_FOR_SALE' using errcode = '22023'; end if;
  if not item.active then raise exception 'SHOP_CLOSED' using errcode = '55000'; end if;
  if exists (select 1 from public.inventory_items where user_id = uid and item_code = item.code) then
    raise exception 'ALREADY_OWNED' using errcode = '23505';
  end if;
  if balance < item.price then raise exception 'INSUFFICIENT_GRANINHAS' using errcode = '22003'; end if;
  insert into public.graninha_spend_ledger(user_id, item_code, amount, idempotency_key) values (uid, item.code, item.price, p_key);
  update public.player_progress set graninha_balance = graninha_balance - item.price, updated_at = now() where user_id = uid;
  insert into public.inventory_items(user_id, item_code, source) values (uid, item.code, 'purchase');
  return jsonb_build_object('status','purchased','item',item.code,'price',item.price,'balance',balance - item.price);
end; $$;

-- Equipar: só itens grátis ou do inventário, no espaço certo.
create or replace function public.equip_cosmetic(p_slot text, p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); item public.cosmetic_items;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into item from public.cosmetic_items where code = p_item;
  if not found then raise exception 'ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
  if item.slot <> p_slot then raise exception 'WRONG_SLOT' using errcode = '22023'; end if;
  if coalesce(item.price, -1) <> 0 and not exists (select 1 from public.inventory_items where user_id = uid and item_code = item.code) then
    raise exception 'NOT_OWNED' using errcode = '42501';
  end if;
  insert into public.equipped_cosmetics(user_id, slot, item_code) values (uid, p_slot, item.code)
  on conflict (user_id, slot) do update set item_code = excluded.item_code, updated_at = now();
  return jsonb_build_object('slot', p_slot, 'item', item.code);
end; $$;

-- Uma leitura com tudo o que a tela precisa.
create or replace function public.cosmetics_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  return jsonb_build_object(
    'shopOpen', exists (select 1 from public.cosmetic_items where active),
    'active', coalesce((select jsonb_agg(code order by code) from public.cosmetic_items where active), '[]'::jsonb),
    'owned', coalesce((select jsonb_agg(item_code order by acquired_at) from public.inventory_items where user_id = uid), '[]'::jsonb),
    'equipped', coalesce((select jsonb_object_agg(slot, item_code) from public.equipped_cosmetics where user_id = uid), '{}'::jsonb),
    'spent', coalesce((select sum(amount) from public.graninha_spend_ledger where user_id = uid), 0)
  );
end; $$;

revoke all on function public.reject_spend_ledger_mutation() from public, anon, authenticated;
revoke all on function public.purchase_cosmetic(text, text), public.equip_cosmetic(text, text), public.cosmetics_state() from public, anon;
grant execute on function public.purchase_cosmetic(text, text), public.equip_cosmetic(text, text), public.cosmetics_state() to authenticated;
