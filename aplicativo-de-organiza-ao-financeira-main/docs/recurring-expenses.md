# Etapa: despesas recorrentes e vencimentos

## Escopo

Compromissos mensais de pagamento direto por conta (aluguel, internet etc.), com descrição, categoria, valor previsto, dia de vencimento e primeiro mês. São previsões, sem débito bancário, sem despesa automática e sem recompensa pelo cadastro. Compras já registradas no cartão continuam no fluxo de Cartões.

Movimentações permite criar e gerenciar recorrências; Visão geral apresenta resumo do mês e atalho. O seletor de mês fica no cabeçalho de Movimentações, sem repetir o botão de importação CSV.

## Fluxo financeiro

- Previsto/vencido é calculado pelo calendário e fuso do perfil. Dias 29/30/31 usam o último dia de meses curtos, sem deslocar os meses seguintes.
- Confirmar pagamento exige data realizada, valor efetivo, categoria e conta de saída. Só então cria uma despesa normal, usando as regras existentes de saldo e gamificação.
- Pode vincular uma despesa já registrada: não duplica movimento, saldo nem evento de recompensa. Uma despesa só pode estar vinculada a uma ocorrência.
- Uma ocorrência por recorrência/mês, com trava transacional e vínculo único. Repetir pagamento devolve o lançamento já existente.
- Desfazer arquiva o lançamento. Confirmar novamente reativa o mesmo ID, sem outro evento expense_recorded.
- Orçamento e relatórios contam o gasto pela data real do pagamento; a referência de vencimento é informativa.
- Encerrar cancela previsões com vencimento após hoje. Mantém pagamentos anteriores/futuros já registrados e pendências anteriores/hoje.
- Para alterar a previsão, encerrar e criar outra a partir do mês desejado. O valor real pode variar a cada confirmação.

## Implementação e preservação

Migração aditiva 20261022010000_recurring_expenses.sql. Novas tabelas recurring_expenses e recurring_payments, com RLS de leitura por usuário; escritas somente por RPC autenticada com validação de propriedade. Vínculos compostos impedem relacionar dados de usuários distintos. Não altera tabelas nem movimentos existentes na instalação.

Backend SQLite acompanha cadastro, calendário, pagamento, vínculo, reversão e encerramento. Não depende de cron, notificações ou serviços pagos. Nesta etapa os avisos são dentro do app; não há push ou e-mail.

## Validação

TypeScript, build Vite e suíte de aplicação. Script test-recurring-db.mjs com PGlite isolado valida calendário, criação sem recompensa, replay, confirmação, orçamento por data real, reversão, reativação, vínculo de despesa existente, encerramento e isolamento. Concorrência multiconexão não é simulada pelo PGlite.

Nenhum dado financeiro fictício é criado na conta de produção durante a revisão visual.
