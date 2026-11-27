-- Desfaz 20261127000000_avatar_appearance.sql. NÃO fica em migrations/: só é aplicado à mão, se necessário.
-- Remove apenas as duas colunas de aparência; a preferência de tema e os demais dados ficam intactos.
alter table public.user_preferences
  drop column if exists avatar_hair_color,
  drop column if exists avatar_skin;
