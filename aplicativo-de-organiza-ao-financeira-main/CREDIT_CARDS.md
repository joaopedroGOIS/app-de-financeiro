# Cartões de crédito

O cadastro fica em **Cartões de crédito**, com nome, limite, fechamento, vencimento e quatro dígitos opcionais. Não há armazenamento de número completo ou CVV, nem conexão automática com a operadora.

- Compras à vista ou em até 60 parcelas. O valor informado é o total final da compra, incluindo juros quando houver.
- Compras no dia do fechamento entram no próximo ciclo. O mês da primeira fatura pode ser ajustado para coincidir com a operadora.
- Cada parcela é uma despesa no mês do vencimento, inclusive em gráficos, histórico, CSV e cálculo da capacidade para Sonhos. A divisão preserva todos os centavos.
- A compra total compromete o limite e entra no passivo do patrimônio imediatamente. O pagamento reduz saldo da conta e dívida, sem duplicar despesas e sem alterar o patrimônio líquido.
- Pagamentos parciais são permitidos. É possível desfazer um registro incorreto; isso não faz nenhuma transação no banco real. Encargos e juros devem ser registrados separadamente.
- Novas datas de fechamento e vencimento não alteram parcelas já existentes.
- Arquivar cartão exige quitar todas as faturas. Compras com pagamentos vinculados exigem desfazer os registros de pagamento antes de serem arquivadas.
- As tabelas possuem RLS e os writes passam por RPCs com validação de propriedade, bloqueio por cartão e idempotência nas criações.

## Banco de dados

Migration: `supabase/migrations/20261015000000_credit_cards.sql`, na raiz do repositório. Foi aplicada ao projeto Supabase conectado `ezzjahpnbinarylpldrd` pelo SQL Editor e registrada no histórico em 15/10/2026. As quatro tabelas tiveram RLS e permissões conferidas.

Em outra instalação, aplique a migration antes de liberar o recurso. Quando o RPC ainda não existe, a página de cartões informa que a atualização está em preparação e as funcionalidades anteriores continuam disponíveis.

## Validação

Testes de interface e regras: `npx tsx --test src/*.test.tsx`.

Os testes SQL usam PostgreSQL em memória via PGlite, sem tocar em dados reais. Instale `@electric-sql/pglite` em um diretório temporário e execute:

```
node scripts/test-credit-cards-db.mjs CAMINHO_DO_MODULO_PGLITE/dist/index.js
```

Se a biblioteca já estiver instalada no projeto, basta `node scripts/test-credit-cards-db.mjs`.

A suíte aplica as migrations em uma base descartável e testa centavos, ciclos, limite, pagamentos parciais, repetição de requisições, reversão de pagamentos e isolamento entre dois usuários, incluindo acesso anônimo negado. O fluxo de cadastrar cartão, comprar parcelado e pagar fatura também foi exercitado no navegador com dados fictícios.
