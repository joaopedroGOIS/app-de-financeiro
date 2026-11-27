-- Desfaz 20261128000000_cosmetics_shop.sql. NÃO fica em migrations/: só é aplicado à mão, se necessário.
-- ATENÇÃO: se já houver compras, apagar o histórico de gastos perde o registro delas. Antes, exporte
-- graninha_spend_ledger e inventory_items. O saldo já descontado NÃO volta sozinho; um estorno precisa
-- ser decidido e lançado como compensação auditada.
drop function if exists public.cosmetics_state();
drop function if exists public.equip_cosmetic(text, text);
drop function if exists public.purchase_cosmetic(text, text);
drop table if exists public.graninha_spend_ledger;
drop function if exists public.reject_spend_ledger_mutation();
drop table if exists public.equipped_cosmetics;
drop table if exists public.inventory_items;
drop table if exists public.cosmetic_items;
