# Revisão de missões e gamificação — 21/10/2026

## Interface

- Corrigida colisão com a classe legada mission-card: cartões usam estilos próprios, com objetivos, datas, progresso e recompensas separados.
- Resumo de missões concluídas, orientação sobre dias financeiros e atalhos para movimentações e revisão.
- Histórico preservado; indisponibilidade de dados é diferente de ausência de missões.
- O pet continua desativado. Nenhuma regra econômica, tabela ou registro financeiro foi alterado.

## Regras verificadas no código e em PostgreSQL descartável

A configuração economy_v2_20261016 define a curva de 100 níveis. Recompensas são calculadas no servidor, registradas no ledger e protegidas por concessões únicas e limites por período.

- Registro diário OU confirmação de dia sem gastos: juntos no máximo 5 XP/dia.
- Revisão semanal: 10 XP; revisão mensal: 20 XP.
- Primeiro Passo: 3 dias na semana, 10 XP e 10 Graninhas.
- Semana Organizada: 5 dias e uma revisão semanal, 25 XP e 25 Graninhas.
- Controle de Verdade: 20 dias e quatro revisões semanais distintas no mês, 60 XP e 50 Graninhas.
- Mestre do Controle: 75 dias e três revisões mensais no trimestre, 100 XP e 100 Graninhas.
- Compras de cartão não geram o hábito de registro diário; entram na análise das revisões e impedem confirmar um dia sem gastos.
- Aportes confirmados e marcos de Metas/Sonhos possuem regras próprias. Sonhos sem histórico suficiente aguardam cálculo de dificuldade.
- Navegação não gera recompensas. Usuários não podem forjar confirmações diretamente.

## Evidências e limites

- TypeScript sem erros e build Vite concluído.
- 70 testes de aplicação aprovados.
- 22 cenários SQL aprovados pelo script test-missions-db.mjs com PGlite isolado: calendário, fuso, replay, correções, isolamento, marcos, pendências e conciliação ledger/projeção.
- Testes SQL executados em banco descartável, sem alterar produção. Não simulam concorrência multiconexão.
- Conferência visual local bloqueada pela política de acesso do navegador nesta sessão; responsividade ainda precisa de inspeção visual.
- A auditoria não confirma o estado operacional das filas/configuração no banco de produção.

## Próximas melhorias sugeridas

1. Mostrar histórico dos hábitos com nomes amigáveis, evitando códigos internos.
2. Tornar explícito quando uma missão não pode mais ser concluída dentro do período, respeitando o fuso e os dias já contabilizados pelo servidor.
3. Expor falhas de processamento separadamente das recompensas aguardando dificuldade/configuração.
4. Planejar utilidade da Graninha e uma loja de cosméticos antes de reativar o companheiro; não apresentar compras ou recompensas simuladas como reais.
