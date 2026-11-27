-- Perfil, fase 1: aparência gratuita do personagem (cor de pele e de cabelo).
-- Só acrescenta colunas com valor padrão: não altera dados existentes e não envolve Graninhas.
-- Desfazer (somente em caso de problema): supabase/rollbacks/20261127000000_avatar_appearance.down.sql
alter table public.user_preferences
  add column if not exists avatar_skin smallint not null default 1 check (avatar_skin between 0 and 3),
  add column if not exists avatar_hair_color smallint not null default 0 check (avatar_hair_color between 0 and 5);
