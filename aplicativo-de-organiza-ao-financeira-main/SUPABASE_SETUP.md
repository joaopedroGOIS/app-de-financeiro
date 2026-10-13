# Configuração do Supabase

O app usa o Supabase Auth e a Data REST API diretamente do navegador. A migração cria as tabelas, políticas de Row Level Security (RLS) e funções transacionais usadas pelo app. Cada usuário só pode acessar seus próprios registros.

## Estado do projeto conectado

A migração `20261013233000_initial_schema.sql` já foi executada no projeto Supabase `ezzjahpnbinarylpldrd`. As 13 tabelas da aplicação estão com RLS habilitado.

Como o SQL foi aplicado pelo SQL Editor do Dashboard, o banco ainda precisa registrar essa versão no histórico de migrações do CLI antes do próximo `db push`.

## Sincronizar o histórico de migrações

Na raiz deste repositório, autentique e vincule o CLI ao projeto. Depois marque a migração já aplicada como concluída e confira o estado:

```sh
npx supabase login
npx supabase link --project-ref ezzjahpnbinarylpldrd
npx supabase migration repair 20261013233000 --status applied
npx supabase migration list
```

A senha do banco pode ser solicitada pelo CLI ao vincular o projeto. Digite-a somente no terminal local; não a envie em chats nem a salve no repositório. Depois de sincronizar o histórico, `npx supabase db push` não deverá tentar recriar este esquema.

Para um projeto Supabase novo e vazio, vincule o projeto e use `npx supabase db push` para aplicar as migrações. Não use `db push` no projeto conectado antes de sincronizar o histórico acima.

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

Na Vercel, a pasta `aplicativo-de-organiza-ao-financeira-main` deve ser a **Root Directory**, com `npm run build` como comando de build e `dist` como diretório de saída. As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` já foram configuradas para produção e preview; é necessário gerar um novo deploy para que os builds usem os valores.

## Autenticação por e-mail

O cadastro usa Supabase Auth. O projeto conectado está configurado com Site URL `https://app-de-financeiro.vercel.app` e callbacks permitidos `https://app-de-financeiro.vercel.app/**` e `http://localhost:5173/**`. Se a confirmação de e-mail estiver ativada, o usuário precisa confirmar o endereço antes de entrar. Ao mudar de domínio, atualize **Authentication → URL Configuration** no Dashboard.

## Dados SQLite existentes

A migração do esquema não apaga nem converte automaticamente um banco SQLite local. Se houver dados financeiros que queira preservar, faça e valide uma exportação/importação separada antes de abandonar o banco antigo.
