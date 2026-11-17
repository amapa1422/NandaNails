# Estado atual — NandaNails

Última atualização: 17/11/2026. Concluído localmente: controle de versões e disponibilidade padrão.

## Objetivo e arquitetura

Sistema de agendamento para nail designer, preservando o HTML original e sua identidade premium dark, vinho, rosa e dourado. Frontend estático mobile-first, compatível com GitHub Pages; backend preparado para Supabase (PostgreSQL, Auth e Edge Functions). A confirmação depende de ID retornado pelo banco. Sem configuração online, a agenda fica indisponível; não cria reservas fictícias locais.

## Estrutura e tecnologias

```text
index.html / admin.html / privacidade.html
css/styles.css                 estilos originais e ajustes responsivos
js/                            catálogo, API, fluxo, painel, máscara e animações
assets/                        logo e 12 imagens únicas originais
reference/                     HTML original e manifesto SHA-256
supabase/migrations/           schema e atualizações versionadas
supabase/functions/            booking, notify e adaptador WhatsApp
tests/                         Node, PostgreSQL local e Chromium com mocks
scripts/                       verificações e pacote estático
docs/ENTREGA.md                 relatório histórico da primeira entrega
_CONTROLE_PROJETO/              estado, regras, histórico e recuperação
AGENTS.md                      entrada para instruções permanentes
README.md / .env.example / package.json
dist/                          pacote gerado, ignorado pelo Git
.local/                        artefatos de testes locais, ignorados pelo Git
```

HTML5, CSS3, JavaScript moderno, Node para testes; Python para servidor local e testes SQL; PostgreSQL com GiST; TypeScript/Deno e Supabase JS nas Edge Functions. Sem dependências de build no frontend.

## Implementado

- Fluxo serviço → data → horário → dados → confirmação, consulta online e tratamento de conflitos.
- Cinco serviços e respectivos preços/durações originais; centavos inteiros e snapshots nas reservas.
- Máscara WhatsApp, validação, resumo, prevenção de envio duplo e idempotência.
- Galeria, ampliação por teclado/gestos e animações com movimento reduzido.
- Agenda e painel administrativo com login, autorização por UUID, visões por período, status, remarcação, serviços, turnos e bloqueios.
- RLS, funções com grants restritos, captcha Turnstile, limites de criação, exclusão de sobreposição e lock transacional.
- Fila de notificações com adaptador oficial WhatsApp Cloud API; envio isolado da reserva.
- Instruções de execução/deploy/backup e pacote estático por `npm.cmd run build`.

## Integrações e pendências

Supabase, Supabase Auth, Turnstile e WhatsApp estão preparados no código, mas não configurados nem validados em produção. `js/config.js` contém somente campos públicos vazios; secrets ficam fora do frontend. Não existe integração com Livre Escolha.

Pendente: novo projeto Supabase exclusivo, implantação autorizada das migrations e funções, conta administrativa autorizada, chaves públicas, secrets, captcha, template Meta aprovado, destinatário/opt-in e agendador. Testes reais de persistência compartilhada, Auth e envio WhatsApp dependem dessa configuração e autorização. Não houve publicação ou `git push`.

## Regras invariáveis

Preservar layout, tema, logo, fotografias, paleta, fontes, animações, serviços, preços, formulário, máscara, painel, login e integrações. Sem barra inferior móvel. Não misturar com Livre Escolha. Não incluir secrets em arquivos públicos, expor dados pessoais ou afirmar integração real sem comprovação. Não apagar reservas ao atualizar horários. Alterações em produção exigem autorização.

## Disponibilidade

A disponibilidade padrão agora permite segunda a sexta somente inícios às 15h e 16h; sábado das 08h às 16h, com término do procedimento até 16h; domingo fechado. Nos dias úteis, o limite técnico herdado de 18h acomoda o serviço atual mais longo iniciado às 16h e não libera inícios adicionais. Sábado mantém a grade de 30 minutos filtrada pela duração.

`202611170002_horarios_padrao.sql` atualiza o padrão original apenas quando os seis turnos têm exatamente os valores históricos e não existe edição de horários na auditoria. Caso contrário, preserva a configuração e registra `applied=false` em `private.schedule_default_updates`. É idempotente e não altera reservas, clientes, preços ou durações. A política privada `allowed_weekday_starts` também é validada nas remarcações e persiste ao salvar turnos pelo painel. Turnos continuam limitando o término; liberar outros inícios exigiria revisão explícita da política. Não há mudança de interface.

Código e pacote `dist/` atualizados; migration testada apenas no PostgreSQL local descartável. Para ativar em projeto existente é necessário revisar e aplicar a migration nova com autorização. Não reaplicar a migration inicial. Alterações diretas de SQL sem auditoria que reconstituam exatamente o seed não podem ter origem distinguida automaticamente; revisar a configuração real antes da execução remota.

## Versão estável e problemas conhecidos

Referência anterior às alterações: tag `backup-nandanails-antes-horarios`, commit `4d81ead2b8572d4de023f332986ad847ad4199d2`. Repositório local próprio inicializado nesta pasta; o Git encontrado acima pertence à pasta do usuário e não foi alterado.

Versão atual validada localmente: `nandanails-horarios-2026-11-17` (tag local; consultar o histórico para o commit). Essa referência não significa versão publicada nem integração online comprovada.

A configuração padrão antiga era 09–18h nos dias úteis e 09–14h no sábado. A migration inicial é histórica e deve permanecer intacta; novas instalações precisam aplicar todas as migrations em ordem. Configurações personalizadas não podem ser substituídas automaticamente.

Limitações herdadas: sem validação em Safari/iPhone físico, leitor de tela, Lighthouse móvel ou backend remoto; testes Chromium usam mocks. `docs/ENTREGA.md` relata a primeira entrega e não substitui este estado atual. Campos de configuração de horário no catálogo são referência; a disponibilidade real vem do servidor.

Validação desta atualização: verificações estáticas, quatro testes Node, dez grupos de regressão PostgreSQL, oito grupos específicos da migration e teste Chromium em seis larguras. O teste do calendário inclui domingo fechado e somente 15h/16h em dia útil, com respostas simuladas. Os resultados e comandos estão no histórico.
