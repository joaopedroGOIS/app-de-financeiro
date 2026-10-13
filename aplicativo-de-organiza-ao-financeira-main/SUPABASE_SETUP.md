# Configuração do Supabase

O app usa o Supabase Auth e a Data REST API diretamente do navegador. A migração cria as tabelas, políticas de Row Level Security (RLS) e funções transacionais usadas pelo app. Cada usuário só pode acessar seus próprios registros.

## Aplicar o esquema

Na raiz deste repositório, instale e autentique o Supabase CLI, depois vincule o projeto e aplique as migrações:

```sh
npx supabase login
npx supabase link --project-ref ezzjahpnbinarylpldrd
npx supabase db push
```

O CLI pode solicitar a senha do banco ao vincular o projeto. Digite-a apenas no terminal local; não a envie em chats nem a salve no repositório. A migração só cria o esquema e não importa os dados que estejam em um arquivo SQLite local.

Também é possível executar o SQL da pasta `supabase/migrations` pelo SQL Editor do Dashboard, mas, se fizer isso, mantenha o histórico de migrações sincronizado antes de usar `db push`.

## Configurar o app

Na pasta `aplicativo-de-organiza-ao-financeira-main`, copie `.env.example` para `.env.local` e informe a URL e a chave publishable do projeto:

```sh
cp .env.example .env.local
```

Use a chave `sb_publishable_...` em `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca coloque uma chave `sb_secret_...`, `service_role` ou senha do banco em variável `VITE_*`, no navegador ou no Git. RLS é a barreira de acesso aos dados; mantenha-a habilitada.

Inicie o app a partir dessa pasta:

```sh
npm install
npm run dev
```

Para publicar em uma hospedagem estática como Vercel, defina essa pasta como **Root Directory**, use `npm run build` como comando de build e `dist` como diretório de saída. Cadastre as duas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nas variáveis de ambiente de build/produção e faça novo deploy.

## Autenticação por e-mail

O cadastro usa Supabase Auth. Se a confirmação de e-mail estiver ativada no projeto, o usuário precisa confirmar o endereço antes de entrar. Configure os URLs de redirecionamento permitidos em **Authentication → URL Configuration** para os domínios locais e de produção do app.

## Dados SQLite existentes

A migração do esquema não apaga nem converte automaticamente um banco SQLite local. Se houver dados financeiros que queira preservar, faça e valide uma exportação/importação separada antes de abandonar o banco antigo.
