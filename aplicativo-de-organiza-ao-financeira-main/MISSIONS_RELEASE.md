# Missões e recompensas completas — 16/10/2026

Extensão incremental do motor PostgreSQL publicado no PR #13. Reutiliza eventos, activity_days, reward_claims, behavior_completions, ledger e player_progress. Níveis, classes e prêmios já aprovados permanecem.

## Regras ativadas

| Missão | Condição no período | XP | Graninha | Frequência |
|---|---|---:|---:|---|
| Primeiro Passo | 3 dias financeiros distintos | 10 | 10 | Semanal |
| Semana Organizada | 5 dias e 1 revisão semanal | 25 | 25 | Semanal |
| Controle de Verdade | 20 dias e 4 revisões de semanas diferentes | 60 | 50 | Mensal |
| Mestre do Controle | 75 dias e 3 revisões, uma de cada mês | 100 | 100 | Trimestre civil |

Uma concessão por missão/período, automática, sem resgate. A mesma ação participa de missões diferentes. Abrir telas ou repetir lançamentos não cria dias adicionais. A semana começa segunda-feira; uma revisão semanal é atribuída ao mês da quinta-feira dessa semana, sem dupla contagem entre meses. O perfil registra o fuso IANA (padrão já usado: America/Sao_Paulo); o cliente não pode alterá-lo para fabricar dias.

**Metas:** 10% = 20 XP/15 Graninhas; 25% = 30/25; 50% = 50/40; 75% = 75/60; 100% = 150/150. Cada marco só é premiado uma vez por objetivo, mesmo após edição. Criar objetivo não premia.

**Economia diária:** um novo aporte com confirmação de economia real concede 5 XP, uma vez por dia, sem proporcionalidade ao valor. O checkbox também confirma que a quantia não foi contabilizada em outro objetivo. É um modelo de declaração manual aprovado pelo responsável, não uma verificação bancária. Não há movimentação automática de contas. Aportes antigos não confirmados continuam no saldo financeiro, sem concessão retroativa.

**Sonhos:** 500 XP-base com multiplicadores 1/1,5/2/3/5. Distribuição aprovada entre 10/25/50/75/100%: 5/10/15/20/50% do total de referência. Graninha zero.

| Dificuldade | 10% | 25% | 50% | 75% | 100% | Total de referência |
|---|---:|---:|---:|---:|---:|---:|
| Fácil | 25 | 50 | 75 | 100 | 250 | 500 |
| Moderada | 37 | 75 | 112 | 150 | 376 | 750 |
| Difícil | 50 | 100 | 150 | 200 | 500 | 1.000 |
| Muito difícil | 75 | 150 | 225 | 300 | 750 | 1.500 |
| Lendária | 125 | 250 | 375 | 500 | 1.250 | 2.500 |

XP é inteiro: arredonda para baixo os quatro primeiros marcos e deixa o restante na conclusão. A dificuldade é avaliada antes do aporte, para a conclusão não virar automaticamente Fácil pelo saldo restante zero. Pode mudar entre aportes; cada concessão preserva avaliação e versão próprias, sem modificar prêmios anteriores. Portanto o total efetivo pode combinar marcos de dificuldades diferentes. Sem seis meses completos, os marcos ficam pendentes. Quando há histórico suficiente, uma avaliação de recuperação é registrada, preservando o snapshot original, o valor restante anterior ao aporte e a economia vigente na ação. O hábito de economia diária pode ser premiado enquanto o marco aguarda dados.

## Segurança e correções

- Todos os pagamentos virtuais usam o motor/ledger existentes e bloqueio por jogador.
- A confirmação do aporte passa por RPC autenticado; clientes não escrevem confirmação, XP, Graninha, eventos ou progresso diretamente.
- Correções recalculam os dias válidos e o progresso de missões inacabadas. Datas financeiras editáveis não alteram a data de atividade no servidor.
- Conquistas já concedidas não são apagadas ou premiadas novamente. A política existente de correção é ajuste administrativo append-only, com justificativa, referência à recompensa e idempotência; não há retirada silenciosa por edição.
- Versões anteriores dos eventos preservam suas regras. Missões não premiam períodos anteriores à ativação. A contagem começa na data local de ativação; revisões exigem evento posterior à ativação.

## Arquivos e banco

Migration `supabase/migrations/20261016000000_complete_rewards.sql`: adiciona fuso a profiles e confirmação a contributions, estende o estado de processamento e as funções existentes. Adiciona os RPCs `create_confirmed_contribution` e `missions_state`; regras em `config/economy-v2.json`. O RPC antigo de aporte continua disponível para registro financeiro, sem fingir confirmação econômica. Nenhum motor paralelo ou nova tabela de saldo foi criado.

Interface: `src/Missions.tsx`, `src/pages/Journey.tsx`, `src/forms.tsx`, `src/gamification.tsx`, `src/data.ts` e estilos. Missões mostram progresso de dias e revisões, período, prêmio e estados disponível/em andamento/concluída/expirada.

## Testes

- 37 testes de interface e domínio passaram.
- 22 cenários PostgreSQL/PGlite de missões, calendário, confirmação, Metas, cinco multiplicadores de Sonhos, recuperação de dificuldade, ledger e segurança passaram.
- 14 regressões de cartões passaram com a migration nova.
- TypeScript e build Vite passaram.
- PGlite serializa conexões; concorrência multiconexão PostgreSQL não foi executada neste ambiente.

## Limites preservados

Não há vínculo bancário automático: a confirmação manual foi escolhida pelo responsável. Sem histórico suficiente, o sistema não inventa dificuldade. Valores e critérios são configuráveis por versão administrativa. Esta entrega não inclui loja, mascote, rankings ou outras funcionalidades.
