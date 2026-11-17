# Estado atual — NandaNails

Última atualização: 17/11/2026. Concluído localmente: revisão final de segurança das três migrations e do endpoint. Nenhuma operação remota executada; a primeira continua aguardando autorização expressa.

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
supabase/sql-editor/           verificação prévia, instalação completa e conferência
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
- Limites globais independentes de IP e HMAC de telefone no backend, contagem persistente em RPC separada e consumo atômico do captcha contra replay concorrente. A assinatura de `agenda_book` não recebe `p_rate_key`.
- Fila de notificações com adaptador oficial WhatsApp Cloud API; envio isolado da reserva.
- Instruções de execução/deploy/backup e pacote estático por `npm.cmd run build`.

## Integrações e pendências

Supabase, Supabase Auth, Turnstile e WhatsApp estão preparados no código, mas não validados em produção. O usuário informou a criação do projeto separado `nandanails-agendamento`, URL `https://fdxocuhgiypynsjxsqtm.supabase.co`, região East US (Ohio). A URL foi configurada localmente em `js/config.js`; a Publishable key será preenchida pelo próprio usuário e a chave pública Turnstile continua pendente. Secrets ficam fora do frontend. Não existe integração com Livre Escolha. Não consultamos o estado remoto nem aplicamos SQL nele.

Pendente: autorização para a primeira operação remota, verificação do schema real, implantação autorizada das migrations e função `booking`, conta administrativa autorizada, chaves públicas, secrets e captcha. WhatsApp permanece para etapa futura, sem implantar/ativar `notify` ou agendador nesta entrega. Testes reais de persistência compartilhada e Auth dependem dessa configuração e autorização. Não houve publicação ou `git push`.

Diagnóstico do bloqueio: `configured` exige URL, Publishable key e chave pública Turnstile; `serverToday` só vem da resposta `booking/catalog`, que consulta a data do PostgreSQL no fuso comercial. A guarda do frontend não foi removida. SQL aplicado sozinho não implanta a Edge Function e não ativa o calendário.

Preparação atual: `docs/SUPABASE_PRIMEIRA_ENTREGA.md`; migration `202611170003_servicos_iniciais.sql` (seed idempotente que preserva serviços existentes); três SQLs em `supabase/sql-editor/`. O SQL completo inicial consolida `001`/`002`/`003` em uma transação e rejeita tabelas existentes. É alternativa à cadeia de migrations, não uma migration adicional. Não reaplicar em banco existente. O gerador local `scripts/prepare-supabase.mjs` inclui hashes das fontes, sem conexão de rede.

Revisão atual: `docs/REVISAO_MIGRATIONS.md`. Como o usuário confirmou que nenhuma migration foi aplicada, `001`/`002` foram corrigidas diretamente e o consolidado foi regenerado. A `003` foi validada sem mudar dados. Novo handler `_shared/booking-handler.mjs` compartilha o código efetivo do endpoint com os testes locais. Implante o backend e SQL da mesma revisão: a assinatura antiga de reserva não é compatível.

Proteção atual: `agenda_rate_limit` e `agenda_consume_challenge` somente para `service_role`; chamadas separadas da transação de reserva para contar falhas. Cotas globais: catálogo e disponibilidade 300/minuto cada; reservas 60/hora. Após captcha válido, 5 tentativas por telefone/hora com HMAC e salt de no mínimo 32 caracteres; permanece o limite de 5 reservas por telefone/24h. Não há confiança em IP/cabeçalhos enviados pelo cliente. Campos desconhecidos no corpo são recusados. O captcha exige hostname, ação `booking`, timestamp e consumo único do digest no banco. Falhas da proteção não liberam reserva.

## Regras invariáveis

Preservar layout, tema, logo, fotografias, paleta, fontes, animações, serviços, preços, formulário, máscara, painel, login e integrações. Sem barra inferior móvel. Não misturar com Livre Escolha. Não incluir secrets em arquivos públicos, expor dados pessoais ou afirmar integração real sem comprovação. Não apagar reservas ao atualizar horários. Alterações em produção exigem autorização.

## Disponibilidade

A disponibilidade padrão agora permite segunda a sexta somente inícios às 15h e 16h; sábado das 08h às 16h, com término do procedimento até 16h; domingo fechado. Nos dias úteis, o limite técnico herdado de 18h acomoda o serviço atual mais longo iniciado às 16h e não libera inícios adicionais. Sábado mantém a grade de 30 minutos filtrada pela duração.

`202611170002_horarios_padrao.sql` atualiza o padrão original apenas quando os seis turnos têm exatamente os valores históricos e não existe edição de horários na auditoria. Caso contrário, preserva a configuração e registra `applied=false` em `private.schedule_default_updates`. É idempotente e não altera reservas, clientes, preços ou durações. A política privada `allowed_weekday_starts` também é validada nas remarcações e persiste ao salvar turnos pelo painel. Turnos continuam limitando o término; liberar outros inícios exigiria revisão explícita da política. Não há mudança de interface.

Inícios explícitos agora independem da grade da abertura: turno 15h15–18h permite 16h para 120 minutos. Expedientes ativos sem nenhum início permitido são recusados e a alteração inteira é revertida; dados `hours` inválidos não fecham a agenda por acidente. `hours: []` continua sendo fechamento intencional. Revogações de privilégios incluem `PUBLIC`, evitando permissões herdadas, e abrangem sequência de auditoria/tabelas privadas.

Código e pacote `dist/` atualizados; migration testada apenas no PostgreSQL local descartável. Para ativar em projeto existente é necessário revisar e aplicar a migration nova com autorização. Não reaplicar a migration inicial. Alterações diretas de SQL sem auditoria que reconstituam exatamente o seed não podem ter origem distinguida automaticamente; revisar a configuração real antes da execução remota.

## Versão estável e problemas conhecidos

Referência anterior às alterações: tag `backup-nandanails-antes-horarios`, commit `4d81ead2b8572d4de023f332986ad847ad4199d2`. Repositório local próprio inicializado nesta pasta; o Git encontrado acima pertence à pasta do usuário e não foi alterado.

Versão atual validada localmente: `nandanails-horarios-2026-11-17` (tag local; consultar o histórico para o commit). Essa referência não significa versão publicada nem integração online comprovada.

Recuperação anterior à preparação Supabase: tag `backup-nandanails-antes-supabase-real`, commit `a6360e1810a0c715d482bcf93c86706b285401d2`. Continua sendo a referência estável anterior; a preparação nova não significa ativação online.

Preparação Supabase documentada: `nandanails-supabase-preparado-2026-11-17`; commit principal `f030f570ae1c8ef5fbd24d0bda491a06ad5e8fc9`. A tag inclui o registro final da documentação, sem operações remotas.

A configuração padrão antiga era 09–18h nos dias úteis e 09–14h no sábado. A migration inicial foi revisada nesta entrega a pedido expresso do usuário, antes da primeira aplicação. Após aplicação em qualquer ambiente, não editar seu histórico: criar nova migration. Novas instalações usam os arquivos atuais em ordem `001 → 002 → 003`, ou o consolidado atual, nunca ambos. Configurações personalizadas não podem ser substituídas automaticamente.

Limitações herdadas: sem validação em Safari/iPhone físico, leitor de tela, Lighthouse móvel ou backend remoto; testes Chromium usam mocks. `docs/ENTREGA.md` relata a primeira entrega e não substitui este estado atual. Campos de configuração de horário no catálogo são referência; a disponibilidade real vem do servidor.

Validação da atualização anterior de horários: verificações estáticas, quatro testes Node, dez grupos de regressão PostgreSQL, oito grupos específicos da migration e teste Chromium em seis larguras. O teste do calendário inclui domingo fechado e somente 15h/16h em dia útil, com respostas simuladas. Os resultados e comandos estão no histórico.

Validação adicional da primeira entrega Supabase: cinco testes Node; dez grupos de regressão PostgreSQL; oito grupos de horários; seis grupos da instalação completa. Incluem equivalência entre consolidado e migrations, RLS/grants sob permissões iniciais amplas, seed repetido/customizado, rejeição de reinstalação, data de referência e concorrência. Apenas bancos locais descartáveis. Navegador, Auth remoto, Edge Functions reais e mensagens reais não foram executados nesta etapa.

Revisão final: 15 testes Node; testes SQL de segurança (privilégios reais com fixtures e permissões iniciais amplas para PUBLIC, rate limiting, replay concorrente, horários alterados e FKs); repetidas as suítes de instalação, horários e regressão; navegador Chromium em seis larguras com backend simulado. Sem alteração dos arquivos HTML/CSS, logo, fotos ou animações. Somente `js/api.js` (ação do captcha) e `js/admin.js` (mensagens) mudaram fora do backend/testes/documentação.

Limites operacionais: cotas globais são compartilhadas e podem ser esgotadas por abuso; não são WAF nem verificação de posse do telefone. Execução Deno hospedada, Cloudflare real, Supabase/Auth remoto, carga real e Safari físico continuam sem teste. Não afirmar ativação online nem garantia contra toda automação.
