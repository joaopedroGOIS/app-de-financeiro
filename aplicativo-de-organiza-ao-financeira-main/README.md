# Granaê — Sua grana. Seu jogo. Sua evolução.

Reconstrução web do núcleo do **Granaê**, baseada no [Documento Mestre v1.0](./granae_documento_mestre_v1.0.md) (também disponível em [PDF](./granae_documento_mestre_v1.0.pdf)). A filosofia do produto é melhorar a vida financeira primeiro; a evolução no jogo deve ser consequência de hábitos saudáveis, não um incentivo para gastar.

> **Escopo honesto:** este repositório era composto apenas pelo documento e pelo PDF. O código Base44 original não estava disponível. Esta implementação é uma nova base independente, não uma migração da aplicação Base44 nem uma alegação de que as fases aprovadas no documento já foram reproduzidas integralmente aqui.

## Executar

Requer Node.js 22+.

```bash
npm install
npm run dev
```

O Vite serve o aplicativo em `http://localhost:5173` e encaminha `/api` para o servidor Express em `http://127.0.0.1:3001`. Cadastre-se na tela inicial para começar. O banco SQLite é criado em `.data/granae.sqlite` e não é enviado ao Git.

```bash
npm test       # testes de domínio e integração HTTP
npm run build  # checagem TypeScript e build do frontend
```

## Funcionalidades implementadas

- **Conta e isolamento:** cadastro com senha de no mínimo 8 caracteres e login com senha derivada por scrypt, sessão em cookie HttpOnly (`SameSite=None; Secure; Partitioned` na prévia HTTPS em iframe; `Lax` no desenvolvimento HTTP) e consultas/mutações delimitadas pelo usuário autenticado. Para a prévia funcionar mesmo quando o navegador ou gateway bloquear cookies ou o cabeçalho padrão `Authorization`, o frontend solicita um token de sessão independente no cadastro/login e o envia pelo cabeçalho próprio `X-Granae-Session`. Ele vale por 24 horas, fica apenas em `sessionStorage` na aba e é revogável ao sair. Essa alternativa deliberada deve passar por revisão de segurança antes de produção.
- **Contas financeiras:** saldo inicial, tipo, nome, descrição e marcação explícita de participação na Reserva. Saldo calculado por saldo inicial + receitas − gastos + ajustes. Contas com movimentações não podem ser excluídas para preservar o histórico.
- **Movimentações:** receitas, gastos e ajustes; vínculo à conta, categoria, data, valor e observação. Busca, filtros, navegação mensal e exportação CSV (inclusive lançamentos arquivados). Arquivamento preserva o registro, mas o retira dos saldos atuais.
- **Reserva e Patrimônio:** Reserva calculada apenas a partir de saldos positivos das contas marcadas; Patrimônio registrado como saldos de contas + bens − passivos. São métricas separadas. Bens e Reserva não são usados como capacidade para Sonhos.
- **Metas e Sonhos:** cadastro, aportes de progresso independentes de movimentações, marcos oficiais (10/25/50/75/100%) armazenados uma vez, arquivamento sem apagar o histórico. Criar objetivo não dá recompensa.
- **Analisador de Sonhos:** implementa `difficulty_formula_v1` com mediana dos saldos mensais positivos × 0,70, valor restante, dificuldade por índice de esforço com prazo ou tempo estimado sem prazo. Não presume capacidade onde não há histórico suficiente e mantém avaliações anteriores. Por prudência, esta implementação exige seis meses **completos e com movimentações registradas** antes de calcular capacidade; essa política de suficiência e confiança deve ser validada pelo produto, pois o documento não fixa um limiar exato.
- **Jornada:** XP, nível e Graninha lidos de `player_progress` no servidor; streak calculado por datas distintas com ações financeiras registradas. Eventos são persistidos com chave idempotente e aguardam configuração de recompensas. O ledger de recompensas bloqueia `UPDATE` e `DELETE`.

## Limites desta reconstrução

O documento não especifica as quantias oficiais de XP/Graninha, curva de níveis, limites de Classe Financeira, definições das 30 conquistas/10 selos/5 troféus ou regras econômicas de missões e hábitos. **Não inventamos esses valores**: a interface mostra XP 0, nível 1 e Graninha 0 para novas contas e não concede recompensas ainda. A barra de progresso de nível só é desenhada se o servidor informar o limite do próximo nível (`progress.nextLevelXp`, hoje sempre `null`); enquanto a curva não existir, a interface diz isso explicitamente em vez de estimar uma porcentagem. Classe Financeira aparece como aguardando critérios. Eventos ficam pendentes, sem processamento econômico automático.

Ainda não há integração bancária, sincronização com Base44/Supabase, recuperação de senha, painel administrativo, histórico de classes e snapshots, motor de hábitos/missões/conquistas, inventário, loja, Tio Gansinhas animado, trilha completa de auditoria ou proteção de produção contra abuso (rate limiting, proteção contra fraude, operação multi-instância). Não use esta versão como serviço financeiro de produção sem essas etapas e revisão de segurança. O banco SQLite local precisa de backup próprio; o CSV exporta movimentações, não é um backup completo.

**Importante:** aportes em objetivos registram progresso, não transferem dinheiro nem alteram o saldo das contas. Registre a movimentação da conta separadamente se ela ocorreu. Reserva não deve ser gasta automaticamente para Sonhos.

## Temas e design system

Dois temas oficiais, definidos uma única vez em `src/styles/tokens.css`:

- **Escuro — Roxo (padrão):** fundo `#111116`, superfície `#1A1A23`, cards elevados `#22222E`, roxo principal `#8B5CF6`, roxo luminoso `#A78BFA`, roxo profundo `#5B21B6`, texto `#F5F3FF`, texto secundário `#A1A1B5`, positivo `#34D399`, alertas `#FB7185`, bordas `#30303B`.
- **Claro — Azul:** fundo `#F4F7FC`, superfície `#FFFFFF`, azul principal `#2563EB`, azul claro `#60A5FA`, texto `#172033`, texto secundário `#64748B`, bordas `#E2E8F0`.

As cores semânticas vivem em `src/styles/tokens.css`, permitindo que a troca de tema repinte a interface inteira. Texto, superfícies, estados e foco têm tokens próprios; o layout mantém foco visível e respeita `prefers-reduced-motion`.

**Seletor** (perfil → *Aparência do aplicativo*, e também no menu do cabeçalho):

| Modo | Comportamento |
| --- | --- |
| Escuro — Roxo | Sempre o tema escuro. **Padrão quando não há preferência salva.** |
| Claro — Azul | Sempre o tema claro. |
| Automático | Acompanha `prefers-color-scheme` do dispositivo e reage à mudança em tempo real. |

- A troca é imediata, sem recarregar a página; a opção ativa fica marcada com ícone de conferência e `aria-checked`.
- A preferência é gravada em `localStorage` e, com sessão ativa, sincronizada com a conta via `PATCH /api/preferences` (tabela `user_preferences`, coluna `theme` nula até a primeira escolha) — assim vale entre dispositivos.
- Um script inline em `index.html` aplica o tema salvo antes da primeira pintura, evitando mostrar o tema errado no carregamento.

Componentes reutilizáveis em `src/ui.tsx`: cabeçalhos de página, botões, cartões financeiros e de metas, molde visual de missão, badges (incluindo raridades), anel e barra de progresso, campos, modais, estados de carregamento/erro/vazio, confirmações, toasts, gráfico de linha e rosca em SVG próprio (sem dependência nova) e seletores de tema. O cartão de missão é somente uma peça visual e não é preenchido: este repositório ainda não possui dados ou motor de missões. Ícones são `lucide-react`; emojis aparecem apenas onde são dados do usuário (símbolo de objetivo).

## Arquitetura

- `src/theme.ts`: modos de tema, resolução, persistência e aplicação no documento.
- `src/styles/tokens.css`: tokens de design (cores, raios, espaçamento, sombras) por tema.
- `src/styles.css`: design system, layout e páginas, sempre sobre tokens.
- `src/ui.tsx`: componentes visuais reutilizáveis e gráficos SVG.
- `src/pages/`: uma página por arquivo (dashboard, movimentações, contas, patrimônio, objetivos, jornada).
- `src/forms.tsx`: formulários, com os mesmos campos e regras aceitos pelo servidor.
- `src/App.tsx`: shell, navegação, topbar, modais e sincronização do tema com a conta.
- `server/app.ts`: API autenticada Express com validação Zod, regras de escrita e isolamento por usuário.
- `server/domain.ts`: cálculos puros de saldos, reserva/patrimônio, streak, marcos e dificuldade.
- `server/db.ts`: SQLite, tabelas, índices e proteção de imutabilidade do ledger.
- `server/*.test.ts`: testes de regras, isolamento/idempotência da API e da preferência de tema.
- `src/render.test.tsx`: testes de renderização das páginas e do sistema de temas.

Valores monetários persistidos como **inteiros de centavos**. Entradas e aportes usam `Idempotency-Key` nas requisições de criação para que um retry não duplique a operação. A interface usa URLs relativas à própria origem (`/api`) para funcionar também em prévias remotas.
