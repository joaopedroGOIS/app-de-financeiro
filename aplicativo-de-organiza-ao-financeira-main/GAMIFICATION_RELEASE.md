# Gamificação — versão de 16/10/2026

## Arquitetura e comportamento

O aplicativo continua em React/TypeScript/Vite com Supabase Auth e PostgreSQL. Reutiliza `gamification_events`, `reward_ledger` e `player_progress`. O código Express/SQLite anterior não recebe um motor paralelo.

O registro financeiro é confirmado primeiro. A sincronização chama `process_my_rewards` em outra transação: erros não desfazem o lançamento. Cada evento registra a versão econômica vigente no momento da ação. A concessão, a chave única da recompensa, o ledger e o progresso são atualizados atomicamente sob bloqueio por jogador. Falhas ficam pendentes para repetição, sem conceder parte de uma recompensa.

O processador administrativo `process_pending_rewards` pode ser executado por um agendador privilegiado; a migration cria o job por minuto somente se `pg_cron` já estiver instalado. Sem essa extensão, a sincronização autenticada reprocessa até 100 eventos por chamada. Clientes não podem chamar os processadores administrativos nem escrever nas tabelas de progresso, configuração ou recompensas.

Dashboard, perfil e Evolução usam o mesmo resultado de `gamification_state`. A barra usa o intervalo entre o mínimo do nível atual e o próximo. O feedback aparece após confirmação do backend. O envio de movimentações/aportes mantém uma chave de idempotência ao repetir a mesma tentativa.

## Economia ativa

Versão: `economy_v1_20261015`, configurada em `config/economy-v1.json` e na migration de ativação. Valores aprovados pelo responsável; a curva completa interpolada está em `XP_CURVE_PROPOSAL.md`, aprovada explicitamente em 15/10/2026. Níveis 1 a 100, com 151.375 XP no nível 100.

| Ação | XP | Graninha | Limite |
|---|---:|---:|---|
| Registro diário ou confirmação de dia sem gastos | 5 | 0 | Um prêmio compartilhado por dia |
| Revisão semanal confirmada | 10 | 0 | Uma por semana |
| Revisão mensal confirmada | 20 | 0 | Uma por mês |
| Streak 3 dias | 10 | 10 | Uma vez por usuário |
| Streak 7 dias | 30 | 25 | Uma vez por usuário |
| Streak 14 dias | 50 | 40 | Uma vez por usuário |
| Streak 30 dias | 100 | 100 | Uma vez por usuário |
| Streak 60 dias | 200 | 150 | Uma vez por usuário |
| Streak 100 dias | 400 | 300 | Uma vez por usuário |
| Streak 365 dias | 1.000 | 1.000 | Uma vez por usuário |

O valor financeiro não multiplica prêmios. Revisões exigem confirmação explícita e registros no período; abrir telas não concede prêmios. Dia sem gastos exige confirmação e ausência de despesas bancárias ou compras de cartão naquele dia. Se um gasto for registrado depois, não há outro prêmio diário. Não existe estorno silencioso de recompensas: correções utilizam ajuste administrativo auditado.

Streak usa dias de ações observados pelo servidor no fuso `America/Sao_Paulo`, separado da data financeira editável. Ajustes, pagamentos de fatura e operações técnicas não geram XP. Compras no cartão permanecem sem recompensa própria enquanto não houver regra aprovada.

## Reserva e dificuldade

Classes financeiras usam centavos inteiros e apenas contas com `is_reserve=true`, considerando movimentações ativas e pagamentos de cartão. Saldos negativos não aumentam a reserva. As oito classes e seus limites foram fornecidos pelo responsável. Cada mudança de classe preserva o histórico, incluindo descidas; XP não determina classe.

A dificuldade dos Sonhos é calculada no backend e seu histórico não pode ser inserido pelo cliente. Preserva a política existente de seis meses completos, a mediana dos saldos positivos e 70%, com aritmética decimal exata. O limite de 48 meses pertence a Muito difícil, conforme o documento mestre e a solicitação. Marcos guardam a avaliação e a versão usada no evento.

## Banco e arquivos

- `20261015020000_gamification_engine.sql`: processamento, segurança, avaliações no backend, rotina financeira e classes.
- `20261015030000_approved_economy.sql`: ativa somente as regras aprovadas acima.
- Novas entidades: `economy_config_versions`, `progress_baselines`, `activity_days`, `streak_milestone_claims`, `behavior_completions`, `reward_claims`, `financial_class_history`.
- Entidades estendidas: `gamification_events`, `reward_ledger`, `player_progress`. As tabelas existentes de objetivos e avaliações continuam sendo utilizadas.
- Interface/adaptador: `src/data.ts`, `src/App.tsx`, `src/gamification.tsx`, `src/FinancialRoutines.tsx`, Dashboard, Journey e estilos.
- A migration preserva ledger e saldos legados, registra um ponto inicial de conciliação e reconstrói dias históricos pelas datas do servidor. Eventos antigos sem configuração permanecem sem concessão retroativa automática.

## Validação executada

- 34 testes de interface/regras/domínio passaram (`tsx --test src/*.test.tsx server/domain.test.ts`).
- 31 cenários PostgreSQL/PGlite passaram (`scripts/test-gamification-db.mjs`), incluindo os 100 níveis, limites, idempotência, RLS, mudanças de classe, falha parcial e reprocessamento.
- 14 cenários de cartões passaram com as migrations novas aplicadas em banco descartável.
- TypeScript e compilação Vite passaram; fluxo no navegador salvou uma despesa fictícia, concedeu 55 XP e 40 Graninhas (hábito + marco de 14 dias), atualizou o nível 1 para 2 e exibiu o histórico.
- PGlite serializa conexões. Chamadas simultâneas foram testadas nesse ambiente, mas concorrência real com múltiplas conexões PostgreSQL não foi executada. O banco usa bloqueios e restrições únicas para protegê-la.
- Testes de prêmios de missão/Meta/Sonho usam configurações `test-only` isoladas, sem ativá-las em produção. Não existe loja nesta versão. A suíte Express/SQLite legada não faz parte desta validação do backend Supabase.

## Pendências mantidas desativadas

`config/rewards-pending.json` registra os valores fornecidos para Metas, missões, Sonhos e economia diária. Faltam evidência de progresso/economia real e proteção contra recriar objetivos, condições e limites de missões, distribuição dos prêmios dos Sonhos por marco e Graninha correspondente. Criar objetivo não dá recompensa. Esses contratos foram exercitados em testes, mas não representam regras ativas.

Publicação autorizada pelo responsável em 16/10/2026: manter por enquanto a tabela que estava ativa na prévia.
