# Importação CSV — 16/10/2026

## Fluxo
Movimentações ou Cartões → Importar CSV → arquivo ou conteúdo colado → mapear colunas → escolher conta/cartão e categorias → selecionar linhas → conferir duplicados no servidor → confirmar.

Arquivo até 2 MB e 500 linhas. UTF-8/BOM ou Windows-1252, separadores ponto e vírgula, vírgula ou tabulação, aspas escapadas e campos multilinha. Datas DD/MM/AAAA ou AAAA-MM-DD. Valores convertidos em centavos inteiros, sem cálculo monetário em ponto flutuante.

## Banco
Migration supabase/migrations/20261016010000_csv_import.sql cria csv_import_rows e RPC import_csv. RLS de leitura por proprietário; cliente sem permissão de escrita na trilha. A prévia não escreve. A confirmação reavalia os duplicados, serializa importações do usuário e registra todo o lote em uma transação. Reutiliza create_entry_v2 e create_card_purchase_with_interest, sem motor financeiro ou de XP paralelo. Eventos financeiros seguem o processamento de recompensas existente e seus limites; compras de cartão não recebem recompensa automática nova.

## Duplicidade
Compara destino, descrição normalizada (maiúsculas/espaços), data, tipo e centavos, independentemente da categoria. Detecta linhas repetidas no arquivo e registros manuais ou arquivados. Trilha por usuário preserva a identificação após edição/arquivamento. Não detecta equivalências com descrições ou datas diferentes nem a mesma despesa registrada em outra conta/cartão. Duas compras legítimas idênticas são bloqueadas conservadoramente; a segunda pode ser registrada manualmente após conferência. Importações simultâneas são serializadas; criação manual concorrente utiliza o fluxo anterior e não compartilha o bloqueio de importação.

## Cartões e limites
Cada linha é uma compra completa à vista no crédito, com valor total, em uma fatura selecionada. Não reconstrói compras parceladas a partir de linhas de fatura. Indícios de parcelas, estornos ou pagamentos bloqueiam a linha. Pagamentos, ajustes, transferências e registros arquivados não são restaurados automaticamente. O usuário deve remover totais de fatura e conferir se cada linha é uma compra real; formatos genéricos não identificam semanticamente todos os totais de todos os bancos.

Sem conexão automática ao banco, PDF, OCR, serviço pago ou envio do arquivo original. Somente dados selecionados vão ao backend existente para conferir/salvar.

## Arquivos
src/CsvImportDialog.tsx, src/csvImport.ts, src/csvImport.test.tsx, src/App.tsx, src/data.ts, src/pages/CreditCards.tsx, src/styles.css, scripts/test-csv-import-db.mjs e a migration citada.

## Validação executada
43 testes de domínio/renderização/parser aprovados; 11 testes PostgreSQL isolados com todas as migrations aprovados; TypeScript e build Vite aprovados. Navegador: prévia de 3 linhas detectou 1 lançamento novo e 2 duplicados (um no arquivo e outro manual); confirmação salvou apenas o novo e atualizou o histórico. PostgreSQL inclui isolamento, permissões, rollback integral, reenvio, arquivo sobreposto, cartão sem duplicar despesa bancária e limite de crédito. Não houve teste real com múltiplas conexões PostgreSQL nem arquivo bancário real do usuário.
