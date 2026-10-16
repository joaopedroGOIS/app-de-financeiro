# Auditoria de gamificação — 15/10/2026

## Antes das alterações

- Produção: React/TypeScript/Vite com Supabase Auth e PostgreSQL/RPC. `src/data.ts` é o adaptador usado pelo aplicativo. `server/` contém uma implementação Express/SQLite anterior, sem ligação com o frontend atual; não criar outro motor nessa implementação.
- Existem `gamification_events`, `reward_ledger` (imutável), `player_progress`, `milestone_claims`, `difficulty_assessments` e RPCs de movimentação/aporte. Nenhum processador concede recompensas.
- O documento mestre v1.0 descreve regras qualitativas, mas não contém valores de recompensas, limites ou curva dos 100 níveis. README, testes e código confirmam a ausência. Nenhuma tabela econômica foi localizada no código local nem na árvore atual do GitHub.
- Eventos de criação e arquivamento existem; atualização direta pelo cliente não registra evento. Clientes podem inserir/excluir lançamentos diretamente e inserir avaliações de dificuldade. RLS isola usuários, mas não torna esses cálculos confiáveis.
- O cliente calcula streak pelas datas financeiras, incluindo ajustes; lançamentos retroativos podem fabricar uma sequência. O cliente calcula e salva a dificuldade. A barra usa XP total/próximo limite, em vez do intervalo do nível.
- Perfil não apresenta progresso/histórico. Dashboard e Evolução leem `player_progress`, porém próximo limite é sempre nulo.
- Metas e Sonhos compartilham armazenamento e marcos, mas não têm recompensas configuradas. Aportes são declarações de progresso, sem débito/vínculo bancário. Não há validação externa da veracidade.
- Cartões, parcelas, juros e pagamentos existem. Não há loja, transferências dedicadas, orçamentos ou despesas recorrentes nesta versão. Ajustes e pagamentos não devem gerar recompensas.

## Decisões pendentes (solicitadas ao responsável)

1. Tabela oficial v1.0: XP, Graninha, limites compartilhados e por período, hábitos e missões elegíveis; tabela própria de Metas e tabela de Sonhos por dificuldade/marco.
2. Curva oficial dos níveis 1–100 e sua versão.
3. Repetição dos marcos de streak após quebra; política para eventos anteriores à ativação e para reversão de recompensas após correções financeiras.
4. Evidência de progresso real dos objetivos e proteção contra recriar objetivos. Até haver política aprovada, não ativar recompensas de objetivos com base somente em autodeclarações.
5. Quantidade mínima de meses para dificuldade: preservar os seis meses completos exigidos pelo código atual até definição. Corrigir o limite de 48 meses para Muito difícil, conforme documento e solicitação atual.

Não converter exemplos do pedido em economia oficial. Configurações de teste serão isoladas, com versão `test-only`, sem ativação em produção.

## Decisões posteriores à auditoria

O responsável forneceu os valores em 15/10/2026, aprovou a interpolação dos 100 níveis e prêmios de streak uma vez por usuário. Em 16/10/2026 autorizou publicar o conjunto ativo da prévia. A tabela aplicada e as pendências remanescentes estão em GAMIFICATION_RELEASE.md.
