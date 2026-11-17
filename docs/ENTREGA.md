# Relatório de implementação — 17/11/2026

## Fase 1 — auditoria e preservação

Arquivos: `reference/index.original.html`, `reference/assets.sha256.json`, `assets/`.

O original tinha 1.820.169 bytes, CSS no HTML, seis scripts inline e imagens base64 repetidas. Foi lido integralmente com as imagens extraídas para inspeção do código. Identificamos calendário por etapas, cards, máscara de WhatsApp, galeria com dez fotos, ampliação por teclado/toque, revelações na rolagem e configurações locais. A ordem mobile prioriza o agendamento. A barra inferior já estava removida e continua removida.

As chaves `lumiere-demo-config-v1` e `lumiere-demo-bookings-v1` armazenavam informações apenas no navegador. A disponibilidade dependia do relógio local; a reserva não tinha confirmação compartilhada ou proteção concorrente. Essas chaves não são lidas, migradas ou apagadas pelo sistema novo. Dados antigos de demonstração não entram no banco real.

Logo e 12 imagens únicas foram extraídas sem recompressão. Manifesto e teste SHA-256 comprovam a preservação dos bytes. Mantivemos serviços, preços, fontes, paleta dark, vinho, rosa e dourado, seções e animações. Cópia original intacta disponível para comparação.

## Fase 2 — frontend

Arquivos: `index.html`, `privacidade.html`, `css/styles.css`, `js/{config,catalog,api,booking,phone,animations,experience}.js`.

CSS e JavaScript passaram para arquivos próprios; o HTML principal tem cerca de 11 KB. Fotos permitem cache independente e a galeria mantém lazy loading. A cascata visual original foi preservada para manter a identidade; permanece CSS de componentes históricos, que pode ser reduzido posteriormente com uma comparação visual mais ampla. Não foi feita uma substituição generalizada de estilos.

Reservas locais foram removidas. A interface consulta disponibilidade online, trata respostas fora de ordem, atualiza ao voltar à aba, bloqueia envios repetidos e preserva a chave da requisição em tentativas de rede. Calendário e horários têm estados de carregamento e falha. Não há sucesso sem ID devolvido pelo banco. A confirmação mostra os valores persistidos; mudanças no catálogo durante o envio exigem nova confirmação. A falta de configuração bloqueia reservas e mantém catálogo e galeria visíveis.

Mantivemos máscara com cursor, mensagens junto aos campos, foco por etapa, navegação de fotos por teclado e gestos, `IntersectionObserver`, suporte a movimento reduzido e campos de 16 px para evitar zoom automático no iPhone. Ajustamos quebra de textos, áreas de toque e painel em telas estreitas. Incluímos aviso de uso dos dados e página de privacidade.

## Fase 3 — banco e reservas

Arquivos: `supabase/migrations/202611170001_agenda.sql`, `supabase/functions/booking/index.ts`, `supabase/functions/_shared/http.ts`, `supabase/config.toml`.

Tabelas de serviços, clientes, agendamentos, turnos, bloqueios, auditoria, administradoras e fila. Preços em centavos inteiros; snapshots de preço, duração e nomes. Consultas públicas retornam catálogo e horários, sem dados pessoais. Criação exige captcha validado no backend, limites de abuso e chave idempotente.

Horários usam `America/Sao_Paulo`, instante real do servidor, antecedência mínima e horizonte de reserva. Pausas são separações entre turnos. Intervalos `[início,fim)` permitem serviços adjacentes. Constraint de exclusão GiST e lock transacional protegem contra concorrência e conflitos com bloqueios. Sem escrita direta por visitantes ou administradoras: funções controladas e RLS restringem dados e operações.

**Validado no PostgreSQL 18 local**, com papéis simulando o ambiente Supabase. Não aplicado em projeto remoto. Dependência de Supabase JS no backend está fixada; sintaxe TypeScript foi verificada, mas as Edge Functions ainda precisam de execução no ambiente Deno/Supabase real.

## Fase 4 — painel

Arquivos: `admin.html`, `js/admin.js`, estilos e RPC `admin_action` na migration.

Login com endpoints oficiais de Supabase Auth, renovação da sessão em memória e logout. Autorização explícita pelo UUID da administradora no banco. Visões de agenda por dia, semana e mês, navegação por data, horários livres por serviço, detalhes de clientes, WhatsApp, status, cancelamento, conclusão e remarcação. Edição de catálogo, preços, duração, ativação, turnos, bloqueios e folgas.

Seis indicadores com período explícito: hoje, semana, próximos na semana, cancelamentos, concluídos e faturamento estimado dos concluídos. Faturamento não é registro de recebimento. Histórico registra ações e dados operacionais anteriores em alterações de reserva. O painel usa lista por período, adequada ao celular; a escolha da data é o controle nativo do dispositivo.

Login e logout passaram com backend simulado no navegador. Permissões reais das funções e RLS passaram no banco local. O serviço remoto Supabase Authentication ainda não foi testado.

## Fase 5 — WhatsApp

Arquivos: `supabase/functions/{notify/index.ts,_shared/whatsapp.mjs}`, tabela `notification_outbox`, `.env.example` e testes do adaptador.

Fila transacional isolada da reserva. Adaptador para template oficial da Cloud API, credenciais em secrets, destinatário configurável, consentimento explícito da destinatária, processamento exclusivo de itens e tentativas limitadas. HTTP 429 permite retentar; resultado ambíguo exige revisão para não duplicar avisos. ID de resposta registra aceitação do provedor. Não existe confirmação de entrega ou leitura sem webhook, e o sistema não a promete. Nenhum envio para clientes.

**Testado apenas com mocks e banco local.** Pendente configurar conta Meta, número, template aprovado, tokens, opt-in e agendador seguro, e então autorizar um teste real. Nenhuma mensagem foi enviada.

## Fase 6 — preparação para produção

Arquivos: `README.md`, `.gitignore`, `.env.example`, `package.json`, `scripts/{check,package}.mjs`, testes e este relatório.

Instruções de execução, configuração de projeto isolado, implantação das funções, publicação estática, manutenção, backup e restauração. `npm.cmd run build` prepara somente arquivos públicos em `dist/`. Sem publicação, alterações remotas ou `git push`.

Antes da ativação: provisionar projeto **novo**, configurar chaves públicas e secrets, autorizar conta administrativa, revisar horários reais, definir contato e retenção de dados, validar reserva compartilhada e autenticação reais. Testar presencialmente Safari iOS, Chrome Android e o teclado em celulares. A emulação Chromium não substitui esses dispositivos.

## Verificações

- `npm.cmd run check`: sintaxe JavaScript, existência de caminhos locais, IDs HTML sem duplicação.
- `npm.cmd test`: preservação de imagens por SHA-256 e três testes de WhatsApp com mocks (template, fuso/valor, timeout, rejeições e ausência de falsa confirmação).
- `python tests/database.py`: catálogo e centavos; validação de formulário; datas passadas, limite e folgas; RLS; privacidade anônima; autorização; persistência; idempotência; intervalos adjacentes; sobreposição; duas conexões concorrentes; exclusão GiST direta; alteração de catálogo; snapshots; preço alterado durante reserva; cancelamento; remarcação; turnos; bloqueios; auditoria; fila e resultados do provedor.
- `node tests/browser.mjs`: backend simulado; configuração ausente; fluxo completo; máscara; resumo; envio duplo; galeria; login/logout administrativo; indicadores; abas e larguras 320, 375, 393, 430, 768 e 1440. Sem rolagem horizontal ou exceções JavaScript no cenário validado.
- `node --check` nas funções TypeScript: sintaxe aprovada. Não comprova execução Deno, conectividade, secrets ou integração remota.

As verificações locais não constituem certificação de acessibilidade nem medição de Lighthouse em dispositivo físico. A auditoria cobriu semântica existente, rótulos, foco, teclado, áreas de toque, tamanho de campos e movimento reduzido; faltam leitor de tela e análise completa de contraste. A melhoria de tamanho do HTML foi medida; não há resultado inventado de performance de rede móvel ou Safari.
