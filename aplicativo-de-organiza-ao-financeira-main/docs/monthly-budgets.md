# Etapa de melhoria: orçamento mensal por categoria

## Entrega

Painel "Seu plano do mês" na Visão geral. Define e atualiza limites por categoria e mês, exibe gasto, restante, proximidade (80%), limite atingido e excesso. Gastos sem limite aparecem separadamente. O usuário pode retirar um limite sem excluir movimentações.

A categoria usa o mesmo rótulo histórico dos lançamentos. Renomear categorias não reescreve despesas antigas nem migra limites automaticamente. Os limites são independentes por mês; não são copiados automaticamente.

## Dados e preservação

- Migração aditiva: supabase/migrations/20261022000000_monthly_budgets.sql.
- monthly_budgets com RLS por auth.uid(), limites positivos em centavos e unicidade de usuário/mês/categoria.
- monthly_budget_state agrega gastos no PostgreSQL, sem depender da paginação do histórico no navegador.
- Inclui despesas ativas e parcelas ativas por mês de vencimento; exclui receitas, ajustes, registros arquivados e pagamentos de fatura.
- Não altera saldos, reserva, patrimônio, XP ou Graninha; não cria eventos de recompensa.
- Suporte equivalente a limites e despesas manuais no backend SQLite de desenvolvimento (ele não implementa os cartões Supabase).
- Erro no carregamento do orçamento é apresentado no painel, preservando acesso ao restante da tela.

## Validação

TypeScript e build Vite aprovados. Suíte de aplicação aprovada, teste dedicado de cálculo de limites aprovado. Script test-budgets-db.mjs validou a migração em PGlite descartável: mais de mil despesas, parcelas por mês, pagamentos não duplicados, arquivamento, renda/ajustes excluídos, usuários isolados, unicidade, valores inválidos, acesso anônimo bloqueado e ausência de novas recompensas.

Próximas etapas: recorrências e vencimentos, pagamento de dívidas, recuperação de acesso, acessibilidade dos modais. Não declarar produto 100% concluído apenas por esta entrega.
