# Etapa: recuperação de acesso, primeiros passos e acessibilidade

## Recuperação de acesso

- A tela Entrar possui "Esqueci minha senha".
- Solicita link pelo endpoint recover do Supabase, com destino fixo https://granae-cash.vercel.app/; não usa credenciais administrativas nem envia a sessão normal junto do pedido.
- O callback implícito type=recovery é consumido antes de carregar dados financeiros. Retira o fragmento sensível do endereço e mantém o token de recuperação somente em memória, separado da sessão normal.
- Nova senha exige confirmação e 8–128 caracteres. O PUT /auth/v1/user usa apenas o token recebido no link; falhas não recorrem à sessão normal.
- Após sucesso, tenta revogar a sessão de recuperação, limpa os tokens locais e solicita novo login. Não altera dados financeiros ou recompensas.
- Link incompleto, expirado, usado ou recarregado sem token permite solicitar outro. Erros e limites de envio não são apresentados como entrega confirmada.
- Implementação de produção via Supabase; o backend SQLite de desenvolvimento não possui serviço de e-mail.

## Configuração verificada em 21/10/2026

Site URL do projeto ainda apontava para app-de-financeiro.vercel.app. Atualizada para o endereço atual https://granae-cash.vercel.app/.

O projeto usa o serviço padrão de e-mail do Supabase. O usuário confirmou que ainda não possui provedor próprio. A ativação de entrega para todos os usuários está PENDENTE de configuração SMTP: o serviço padrão é restrito à equipe do projeto. Nenhum serviço foi contratado, nenhuma mensagem real foi enviada e nenhuma senha de produção foi alterada nesta etapa.

Não considerar o fluxo de recuperação totalmente validado em produção até configurar o provedor e executar o ciclo real de e-mail/troca/login, com a senha preenchida pelo próprio usuário.

Fontes oficiais:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/redirect-urls

## Guia de primeiros passos

Guia na Visão geral acompanha conta/saldo inicial, primeiro lançamento financeiro e limite do mês atual. Usa dados reais, sem criar movimentações, sem conceder XP e sem tratar ajustes ou pagamentos de fatura como primeira despesa. O orçamento pode estar em verificação/indisponível, sem inventar conclusão. Pode ocultar/reabrir o guia neste aparelho; preferência local separada por ID de usuário. Atualiza após salvar/retirar um limite.

## Formulários

Modal compartilhado mantém o foco dentro da janela, trata Tab/Shift+Tab, fecha a janela superior por Escape, restaura o foco ao controle de origem e bloqueia rolagem do fundo. Usa a função de fechamento atual sem reiniciar foco a cada digitação. Modais sobrepostos recebem tratamento de pilha.

## Validação

81 testes aprovados, incluindo links válidos/incompletos/expirados, remoção de token do endereço, montagem repetida do React, limites, confirmação da senha, destinos/headers dos endpoints com fetch simulado e progresso do guia. TypeScript e build Vite aprovados. A troca de senha usa dados fictícios em mocks; não é evidência de entrega de e-mail real. Revisão visual e de teclado em produção realizada sem envio de e-mail nem mudança de senha.
