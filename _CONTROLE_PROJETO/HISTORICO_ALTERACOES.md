# Histórico de alterações

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
