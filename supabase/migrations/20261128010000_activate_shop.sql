-- Lojinha: abre as vendas. Só liga os itens à venda (preço > 0) do catálogo aprovado em 26/11/2026.
-- Grátis não precisam de ativação; Lendários (preço nulo) continuam só por conquista.
-- Desligar de novo, se necessário: supabase/rollbacks/20261128010000_activate_shop.down.sql
update public.cosmetic_items set active = true where price > 0;
