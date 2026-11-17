# Histórico de alterações

## 17/11/2026 — agendamento sem Turnstile ou qualquer CAPTCHA

- Pedido: remover CAPTCHA, preservando cotas, validações, confirmação persistida e segurança. O usuário informou migrations aplicadas; nenhum SQL foi alterado ou reaplicado.
- Recuperação: `backup-nandanails-antes-sem-captcha` → `3cb92400de026920e84973c5542af1c13a022813`.
- Código: `js/api.js`, `js/config.js`, `js/booking.js`, `index.html`, `privacidade.html`, `supabase/functions/_shared/booking-handler.mjs`, `.env.example`. Removidos widget/script/token e verificação externa. Exigidos JSON, entrada válida e ID retornado pelo banco para confirmar.
- Preservados: cotas globais, HMAC de telefone, contagem independente antes de reservar, transações, exclusão de sobreposição, RLS/grants, serviços, preços, calendário, CSS, imagens e animações. Objetos históricos de desafios permanecem restritos e sem uso. Nenhuma migration nova necessária.
- Testes alterados: `tests/booking-handler.test.mjs`, `tests/browser.mjs`, cobrindo ausência de CAPTCHA, limites, falhas fechadas, validações, conflitos, respostas sem ID e envio duplo.
- Documentação: criado `SEM_CAPTCHA.md`; atualizados `AGENTS.md`, `README.md`, estado, regras, recuperação, histórico e avisos históricos em `docs/SUPABASE_PRIMEIRA_ENTREGA.md` e `docs/REVISAO_MIGRATIONS.md`.
- Testes executados, todos aprovados:
  - `node scripts/check.mjs`; `node --check` no navegador, handler e entrada TypeScript.
  - `npm.cmd test`: **17 testes Node**.
  - `python -u tests/security.py`: **5 grupos**, RLS/privilégios, cotas persistentes e concorrentes, objetos legados, expediente e integridade referencial.
  - `python -u tests/installation.py`: **6 grupos**, cadeia 001 → 002 → 003/consolidado, permissões, seed e concorrência em bancos locais novos.
  - `python -u tests/schedule.py`: **8 grupos**, cinco serviços, duração, dias úteis 15h/16h, sábado até 16h, domingo, conflitos e personalizações.
  - `python -u tests/database.py`: **10 grupos**, persistência, exclusão concorrente e regressões.
  - `node tests/browser.mjs`: seis larguras (320, 375, 393, 430, 768, 1440), fluxo sem CAPTCHA, painel e galeria; três respostas sem confirmação bloqueadas; sem exceções ou rolagem horizontal.
  - `npm.cmd run build`: pacote local regenerado. Conferências Git/Python: migrations/SQL Editor e arquivos visuais preservados, documentação e `git diff --check` aprovados.
- Limitações: RPC do handler e backend do navegador simulados; SQL apenas em PostgreSQL local descartável. Sem Deno hospedado, Supabase/Auth remoto, carga/DoS, Safari físico ou WhatsApp real. O teste legado de replay verifica somente o objeto SQL preservado, sem CAPTCHA ativo.
- Risco residual: bots podem alternar telefones, ocupar horários e esgotar cotas compartilhadas. HMAC não comprova posse do telefone; CORS não autentica scripts; cotas não substituem WAF. Acompanhar reservas e erros 429.
- Publicação manual: `supabase functions deploy booking --no-verify-jwt`, na CLI vinculada a `nandanails-agendamento`. Conferir origens, salt e Publishable key; atualizar frontend separadamente. Não reaplicar SQL ou publicar `notify`.
- Nenhuma consulta ou alteração remota, deploy, publicação ou `git push` executados.

## 17/11/2026 — revisão final de segurança e compatibilidade das migrations

- Escopo autorizado: revisar `001`/`002`/`003`, backend e regras de expediente antes de qualquer aplicação remota. O usuário confirmou que ainda não executou os SQLs; essa autorização específica permite corrigir diretamente os arquivos locais históricos nesta ocasião.
- Recuperação: árvore limpa em `c19799aa6dda48e73983ed31728d843b770a88bd`; tag inédita `backup-nandanails-antes-revisao-migrations` criada sem sobrescrever versões.
- Correções `001`: removido `p_rate_key` da assinatura de `agenda_book`; novo `agenda_rate_limit` exclusivo do backend, com escopos globais fixos e escopo de telefone HMAC; contadores retornam booleano e são confirmados em RPC separada antes da reserva. Novo claim atômico do digest do captcha para impedir replay concorrente. Revogações incluem `PUBLIC`, sequência de auditoria e tabelas privadas; seed inicial usa `ON CONFLICT DO NOTHING`; dados `hours` incompletos são recusados.
- Correções `002`: candidatos úteis vêm diretamente de `allowed_weekday_starts`, independentes da grade da abertura. Consultas e remarcação aceitam 16h num turno 15h15–18h. Turnos incompatíveis com todos os inícios permitidos e payloads inválidos são recusados sem perder o expediente anterior. Fechamento explícito com lista vazia continua disponível.
- `003`: revisada e preservada sem mudanças; mantém os cinco serviços/valores e seed idempotente sem sobrescrever personalizações.
- Backend: novo `_shared/booking-handler.mjs` executável com dependências simuladas; entrada `booking/index.ts` mantém credencial somente no servidor. Sem confiança em IP/cabeçalhos/UUID escolhidos pela cliente. Reject de campos desconhecidos, corpo limitado durante leitura, datas válidas, CORS explícito, captcha com hostname/ação/timestamp, claim único e cota por telefone. Falhas retornam erro sem sucesso falso ou detalhes internos.
- Frontend: somente `js/api.js` (ação lógica `booking` no widget captcha) e `js/admin.js` (mensagens claras para horários incompatíveis) mudaram. Nenhum HTML, CSS, logo, fotografia, serviço/preço, animação ou layout foi modificado.
- Documentos: `docs/REVISAO_MIGRATIONS.md`, README, roteiro anterior, `AGENTS.md` e todos os documentos de controle atualizados. Consolidado SQL regenerado com hashes das migrations; consultas de verificação atualizadas. `.env.example` explica salt mínimo de 32 caracteres, sem inserir credencial real.
- Arquivos de testes: criados `tests/booking-handler.test.mjs` e `tests/security.py`; adaptadas assinaturas em `tests/database.py`, `tests/schedule.py`, `tests/installation.py`. O teste de instalação passou a simular grants iniciais para `PUBLIC` e comparar as novas funções.
- Testes executados e aprovados:
  - `node scripts/prepare-supabase.mjs`: consolidado regenerado localmente.
  - `node scripts/check.mjs`: sintaxe JS, caminhos e IDs.
  - `npm.cmd test`: **15 testes Node**, incluindo handler efetivo com mocks, rejeição de chaves escolhidas/cabeçalhos forjados, cotas/captcha, replay, erros sem falsa confirmação, integridade do SQL, imagens originais e WhatsApp simulado.
  - `python -u tests/security.py`: **5 grupos**, com dados reais de teste no banco local: todas as tabelas/RLS/grants sob permissões iniciais amplas para PUBLIC, papéis autorizado/não autorizado, ausência da assinatura antiga, tentativas persistentes, expiração, concorrência de cotas/captcha, expediente 15h15, rollback de edições incompatíveis/incompletas, fechamento e FKs de administradora/cliente/serviço.
  - `python -u tests/installation.py`: **6 grupos**, incluindo sequência/consolidado equivalentes, RLS, seed, preservação, rejeição de reinstalação e concorrência de reservas.
  - `python -u tests/schedule.py`: **8 grupos**, incluindo os cinco serviços, início 15h/16h, sábado até 16h, domingo, conflitos, preservação e personalizações.
  - `python -u tests/database.py`: **10 grupos** de regressão do schema e operações existentes.
  - `node tests/browser.mjs`: aprovado em seis larguras, fluxo público/painel/galeria com backend simulado, sem erros JS nem rolagem horizontal.
  - `node --check` nas entradas TypeScript/módulos backend e `npm.cmd run build`: aprovados; pacote estático regenerado sem publicar.
  - Verificação local Python/Git: aprovados links da documentação, tag de recuperação, `git diff --check`, ausência de variável de credencial backend nos módulos frontend e ausência de alterações em HTML/CSS, imagens, animações, catálogo e migration `003`.
- Limitações: testes de handler com RPC/Siteverify simulados e PostgreSQL local com shim Auth; sem Deno hospedado, Supabase/Auth/Cloudflare reais, carga/DoS, Safari físico, comunicação WhatsApp ou persistência entre dispositivos pela internet. Cotas globais são compartilhadas pelo estúdio, não são proteção WAF anterior à função nem verificam posse de telefone. Não há garantia contra toda automação com desafio válido.
- Entrega: SQLs revisados para execução posterior autorizada na ordem `001 → 002 → 003`, ou consolidado alternativo, nunca ambos. Backend antigo não é compatível com a assinatura revisada. Nenhum acesso remoto, publicação, alteração de dados reais ou `git push`.
- Commit principal da revisão: `675c3da75fea36bdf68eb3eac0186aad1a19a909`. Tag local da versão documentada: `nandanails-migrations-revisadas-2026-11-17` (inclui o registro final, sem aplicação remota).

## 17/11/2026 — primeira entrega Supabase: auditoria e preparação local

- Pedido: preparar integração com o projeto exclusivo `fdxocuhgiypynsjxsqtm`, começando pela auditoria e migrations; aguardar autorização para a primeira operação remota.
- Ponto anterior: árvore limpa em `a6360e1810a0c715d482bcf93c86706b285401d2`; tag inédita `backup-nandanails-antes-supabase-real` criada, sem sobrescrever referências.
- Diagnóstico: URL/chaves vazias impediam `configured`; `serverToday` depende da resposta `booking/catalog`, derivada do relógio PostgreSQL em `America/Sao_Paulo`. A guarda continua intacta. A URL pública informada foi preenchida; Publishable key fica a cargo do usuário e não foi solicitada pelo chat.
- Criados: `supabase/migrations/202611170003_servicos_iniciais.sql`; `scripts/prepare-supabase.mjs`; `supabase/sql-editor/000_verificar_estrutura.sql`, `001_instalacao_nandanails.sql`, `002_conferir_instalacao.sql`; `tests/installation.py`, `tests/installation.test.mjs`; `docs/SUPABASE_PRIMEIRA_ENTREGA.md`.
- Modificados: `js/config.js` (somente URL pública e comentário); `README.md`; `AGENTS.md`; documentos de controle (estado, histórico, recuperação; regra permanente de autorização preservada).
- Motivo: disponibilizar SQL completo revisável para o SQL Editor, com schema existente, RLS, reservas transacionais, horários atuais e seed repetível sem sobrescrever serviços personalizados. Mantidas as migrations históricas e o comportamento da interface. O consolidado contém hashes das fontes e uma transação, e rejeita instalação sobre tabelas existentes.
- Testes executados nesta etapa:
  - `node scripts/prepare-supabase.mjs`: aprovado — SQL completo gerado apenas localmente.
  - `node scripts/check.mjs`: aprovado — sintaxe JavaScript, arquivos locais e IDs HTML.
  - `npm.cmd test`: cinco testes aprovados — imagens originais, integridade do consolidado e adaptador WhatsApp com mocks.
  - `python -u tests/database.py`: dez grupos de regressão aprovados no PostgreSQL local.
  - `python -u tests/schedule.py`: oito grupos aprovados — horários, duração, preservação, remarcações e personalizações.
  - `python -u tests/installation.py`: seis grupos aprovados — instalação/conferência, oito tabelas com RLS, anonimato e autorização, rejeição de reinstalação, seed idempotente/customizado, data do servidor, concorrência e equivalência do consolidado com as migrations.
  - `npm.cmd run build`: pacote estático local regenerado com a URL pública; sem deploy. Verificações de sintaxe das funções TypeScript, links dos documentos, tag de recuperação, `git diff --check` e ausência de diferenças nos arquivos protegidos: aprovadas.
- Limitações: apenas bancos locais descartáveis em `127.0.0.1:55432`, com shim de Auth. Não executamos navegador nesta etapa nem Deno/Edge Functions reais, Auth Supabase, chamadas ao projeto remoto ou envio real de WhatsApp. Os testes antigos de navegador usam mocks e não comprovam operação online.
- Entrega operacional: roteiro do SQL Editor, mapeamento das tabelas, segurança, autorização administrativa por UID e próximos passos para `booking`, CORS e captcha em `docs/SUPABASE_PRIMEIRA_ENTREGA.md`. Nenhum usuário administrativo é criado pelo SQL inicial. WhatsApp continua pendente e sem ativação.
- Sem publicação, `git push`, alterações em credenciais ou dados reais. A primeira operação remota aguarda autorização expressa do usuário.
- Commit da preparação: `f030f570ae1c8ef5fbd24d0bda491a06ad5e8fc9`. Tag local da entrega documentada: `nandanails-supabase-preparado-2026-11-17` (preparação, não ativação).

## 17/11/2026 — ponto de recuperação anterior aos horários

- Descrição: criado repositório Git exclusivo para NandaNails e registrado o estado integral anterior à alteração solicitada.
- Arquivos: 44 arquivos existentes de código, imagens, documentação e testes; sem `.local/`, `dist/` ou secrets.
- Motivo: não havia histórico próprio do projeto. O Git encontrado acima da pasta era da pasta pessoal do usuário; não foi modificado.
- Commit: `4d81ead2b8572d4de023f332986ad847ad4199d2`.
- Tag: `backup-nandanails-antes-horarios`, criada sem substituir tag anterior.
- Verificações executadas: `git rev-parse HEAD` e `git status --short` após o commit/tag.
- Resultado: commit/tag criados; árvore do projeto limpa antes das alterações. Testes funcionais ainda não foram repetidos nesta etapa.

## 17/11/2026 — controle do projeto e novos horários

- Descrição: criados os documentos permanentes e `AGENTS.md`; configurados inícios de segunda a sexta às 15h e 16h, sábado 08–16h com duração respeitada e domingo fechado.
- Motivo: solicitação expressa de somente duas alterações, preservando todo o restante do sistema.
- Criados: `AGENTS.md`; `_CONTROLE_PROJETO/ESTADO_ATUAL.md`, `HISTORICO_ALTERACOES.md`, `REGRAS_CODEX.md`, `RECUPERACAO.md`; `supabase/migrations/202611170002_horarios_padrao.sql`; `tests/schedule.py`.
- Modificados: `js/catalog.js` (padrões); `README.md` (somente instruções relacionadas à atualização); `tests/browser.mjs` (fixtures e verificações do novo calendário). `dist/` foi regenerado como artefato local ignorado pelo Git.
- Decisão técnica: preservado o encerramento herdado de 18h nos dias úteis, necessário ao serviço de 120 minutos iniciado às 16h. A lista privada de inícios não libera 15h30, 16h30 ou outros horários. Sábado continua com grade de 30 minutos e término até 16h. Reservas antigas fora do novo expediente permanecem intactas.
- Migração: verifica os seis turnos originais e a ausência de edição administrativa registrada; preserva personalizações ou origem incerta. Registra o resultado, admite repetição sem duplicar dados e mantém constraints, grants, RLS e locks existentes. Consultas retornam horários em ordem cronológica. Nenhuma execução em produção.
- Testes executados e resultados:
  - `node scripts/check.mjs`: aprovado — sintaxe JavaScript, caminhos locais e IDs HTML.
  - `npm.cmd test`: quatro testes aprovados — bytes de imagens e adaptador WhatsApp com mocks.
  - `python -u tests/database.py`: dez grupos aprovados — regressão do schema original, persistência, RLS, conflitos concorrentes, snapshots, remarcação e fila.
  - `python -u tests/schedule.py`: oito grupos aprovados — preservação de seis tabelas, todos os cinco serviços de segunda a sexta, limites do sábado, domingo, idempotência, conflitos, remarcação, salvamento pelo painel e duas situações de configuração personalizada.
  - `node tests/browser.mjs`: aprovado no Edge/Chromium — calendário com domingo fechado, horários 15h/16h, fluxo da cliente, galeria, login/logout simulados, todas as abas e seis larguras (320, 375, 393, 430, 768, 1440), sem exceções JavaScript nem rolagem horizontal.
  - `npm.cmd run build`: pacote estático regenerado, sem publicar.
  - Verificação local por Python/Git: aprovados os quatro documentos, as três referências de `AGENTS.md`, a tag de recuperação e a ausência de diferenças em layout, CSS, imagens, formulário, painel, login, funções backend existentes e migration inicial.
- Correção durante os testes: a primeira execução do teste novo detectou horários retornando fora de ordem pela consulta existente. A nova migration ordena os resultados; a rodada final passou. Essa falha inicial não foi registrada como aprovação.
- Limitações: browser com backend simulado; Supabase/Auth/WhatsApp reais e Safari físico não testados nesta atualização. Não houve alteração de credenciais, banco remoto, layout, fotos, serviços, preços, formulário, painel ou login.
- Ponto anterior: `backup-nandanails-antes-horarios` → `4d81ead2b8572d4de023f332986ad847ad4199d2`.
- Commit da implementação: `89a6eaaa89458d5e9af42a62c7585b1f8e07fb2b`.
- Identificação da versão atual: tag local `nandanails-horarios-2026-11-17`, que inclui este registro final; resolver o commit com `git rev-parse nandanails-horarios-2026-11-17`.
