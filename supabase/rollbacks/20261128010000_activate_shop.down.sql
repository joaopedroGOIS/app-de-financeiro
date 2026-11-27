-- Fecha a Lojinha de novo: novas compras ficam bloqueadas (SHOP_CLOSED).
-- Itens já comprados continuam no inventário de cada jogador e podem ser equipados.
update public.cosmetic_items set active = false;
