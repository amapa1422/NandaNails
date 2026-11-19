# Estado atual — NandaNails

## Correção do gráfico mensal — 19/11/2026

Aplicada localmente a referência `REFERENCIAS/NandaNails_DASHBOARD_COMPLETO_grafico_mensal_ajustado (1).html` (nome recebido com sufixo). Somente o gráfico de barras em Mês ganha rolagem interna, colunas de 52 px (49 px até 650 px), barras de 30/26 px e legenda dia da semana/data em duas linhas. Os 28–31 dias, zeros, cancelamentos, proporções e conversão America/Sao_Paulo continuam vindo do renderizador oficial. Semana/Geral e cálculos/consultas não foram alterados.

Contêiner focável e nomeado quando há overflow, colunas mensais como lista acessível com valor anunciado, foco visível e orientação condicionada ao overflow real. Um ResizeObserver acompanha largura/menu/tela; nenhum listener de scroll ou biblioteca. Na saída de Mês, classes, posição e orientação são limpas. Hover, opacidade e movimento reduzido preservados. Diferença pontual da prévia: valores mensais no fluxo e pequeno padding interno evitam recorte de valor/foco/zoom; a área do gráfico fica ligeiramente mais alta. A referência sozinha exibia a orientação mesmo sem overflow.

Produção: `admin.html`, `css/admin-dashboard.css`, `js/admin-ui.js`. Testes: `tests/admin-dashboard.mjs` ampliado; os comparativos Dashboard e Central apontam à referência atual porque as antigas foram removidas pelo usuário. Controles e `docs/DASHBOARD_CALENDARIO.md` atualizados; `dist/` regenerado localmente.

Validação: check, 41 testes Node, build e quatro suítes browser (Dashboard, Central, público, PWA/Push), com rede externa bloqueada e dados sintéticos. Dashboard cobre 28/29/30/31 dias, zeros/múltiplos/cancelados, ordem, fronteira UTC/Brasília, 320/375/390/430/768/1024/1440 px sem overflow da página, rolagem por teclado/foco até o último dia, orientação ausente quando há espaço, hover mensal, alternância e vazio semanal; regressões de indicadores/rosca/calendário e 10 mil registros aprovadas. Capturas mensais em `.local/dashboard/month-*-390.png`, com inspeção visual em 390 px. Ajustes durante validação: largura do cenário sem overflow e sincronização de animações no harness; orientação passou a ser retirada imediatamente ao sair de Mês. Somente resultados finais são considerados aprovados.

Limites: Edge/Chromium local com viewport móvel; sem Safari/iPhone físico, gesto real de toque, trackpad físico, fontes externas ou produção online. Nenhuma operação remota Supabase, SQL, mudança de migrations/secrets, deploy, publicação ou push. Recuperação: `backup-nandanails-antes-grafico-mensal-20261119` → `f61b90b042da9f5660e7bdcadd13ad76afb60fce`, preservando as remoções/inclusão de referências sobre `831a9a0a72f3967c2e74ed2a5e100e4d4dd1953f`. Implementação permanece sem commit.

## Auditoria final de performance sem alterações visuais — 19/11/2026

Otimização local limitada a `js/admin.js` e `js/admin-ui.js`: resumo semanal em uma passagem, reutilização dos grupos filtrados para o total, normalização textual da busca sob demanda por evento corrente, agrupamento diário por horário, agregados do Dashboard em uma passagem e menos conversões Date/hoje. Sem novo cache de respostas, persistência, dependências, mudança de rede/contratos ou de animações. HTML/CSS/assets, público, Central, PWA/Push e Supabase preservados por comparação Git.

Laboratório Edge, CPU 4×, 10 mil registros sintéticos, duas rodadas por lado: processamento síncrono Dashboard + resumo com mediana 1882→962 ms em 390 px e 1320→1033 ms em 1440; sequência de busca 723→20 ms e 452→24 ms. Calendários tiveram melhora agregada, com poucas amostras e variação relevante; não implica INP ou tempo de pintura. Busca inicial ainda custa normalização; cache textual adicionou cerca de 778 KB para 10 mil registros após GC, liberados no logout no ensaio controlado. Não foi comprovada redução geral de memória nem ganho de carregamento público, cujo código ficou intacto.

HTML renderizado e pixels idênticos em 12 estados nos dois comparativos finais contra a primeira baseline. Outra baseline teve ruído de pintura de 1/255 em 76 pixels, também entre baselines; par estrito correspondente foi rejeitado, sem afrouxar o teste. Passaram check, 41 testes Node, build e quatro suítes browser, estresse de rede/CPU e ensaio de memória/GC. Público em sete larguras, admin/Central/Push nas seis existentes. Sem dispositivos físicos, métricas de campo, INP/FPS válidos, SQL/migrations executados ou Supabase remoto.

Relatório completo, auditoria de dependências, métricas/limites, reprodução, diff e candidatos à limpeza: [docs/PERFORMANCE_FINAL.md](../docs/PERFORMANCE_FINAL.md). Quatro novos scripts de diagnóstico em tests; brutos/PNG/diff em `.local/performance-final/`; `dist/` regenerado. Nenhum arquivo excluído. Recuperação: `backup-nandanails-antes-performance-final-20261119` → `a0c6a4b451da58cef2f4acafc68a6a74bcbb7a58`, preservando em commit as pendências do refinamento visual anterior. Implementação atual sem commit, deploy, publicação ou push; sem reservas/envios reais ou alterações de secrets/VAPID/Cron/Vault.

## Refinamento visual final do site público — 19/11/2026

Implementado localmente a partir de `REFERENCIAS/NandaNails_SITE_COMPLETO_menu_ordenado_cursos.html`: menu Sobre/Cursos/Serviços/Galeria e Reservar separado; dois Ver detalhes com o mesmo gradiente rosa; entrada CSS escalonada do hero (foto 1150 ms, zoom leve); modais com entrada de 360 ms e saída de 230 ms. A ordem aprovada das seções já existia e foi preservada. Textos, preços, foto e demais funcionalidades oficiais mantidos, sem scripts demonstrativos da referência.

`js/courses.js` aguarda as animações reais de saída antes de ocultar o modal, liberar inert/rolagem e devolver foco. Cliques repetidos são ignorados; redução de movimento fecha imediatamente, inclusive ao mudar durante a saída. Escape fica restrito ao modal ativo para evitar desbloqueio prematuro pelo listener da galeria. `js/animations.js` recebeu somente a exclusão do hero da revelação por scroll, necessária para não conflitar com a entrada única em CSS. Âncoras e safe areas do modal ajustadas em CSS. Menu móvel existente preservado (links ocultos até 650 px, Reservar visível).

Passaram check, 41 testes Node, build e quatro suítes browser (público, Dashboard, Central, PWA/Push). Público validado em 320/375/390/430/768/1024/1440 px, sem overflow ou exceções JS; testes ampliados em `tests/browser.mjs`. Verificação complementar em `.local/refinement-check.mjs`: animações reais, fechamento antecipado, troca de reduced-motion durante saída, foco e hero visível/foto carregada com scripts desativados. Capturas em `.local/home-order/` e `.local/courses/`, inspecionadas em 1440/390 px. `dist/` regenerado localmente. Sem medição nova de LCP/CLS, Safari/iPhone físico ou comprovação online; rede externa bloqueada e backend/Auth/Push simulados nos browsers.

Recuperação: `backup-nandanails-antes-refinamento-final-20261119` → `e05c3a3632e18add8469ba6aceea163ef1573af6`, preservando todas as pendências anteriores revisadas, inclusive a nova referência. Refinamento sem commit de implementação, push, deploy ou publicação. Supabase remoto não acessado; imagens, config, administração, migrations, Edge Functions, Cron/Vault e VAPID intactos.

## Página inicial: apresentação antes do agendamento — 19/11/2026

Reorganização local conforme a referência aprovada: Hero “Suas unhas, seu momento.” → faixa decorativa → agendamento → cursos → serviços → galeria → encerramento. Somente os blocos existentes de `index.html` foram movidos, sem editar seu conteúdo. Comparação automatizada com a tag anterior confirma igualdade integral após a permutação. CSS, scripts de produção, imagens, painel, Central, PWA/Push, configurações e Supabase intactos. Foto principal mantém prioridade alta e secundárias mantêm lazy loading. O título do agendamento mantém a visibilidade móvel anterior, conforme CSS oficial e referência.

`tests/browser.mjs` ganhou verificações de ordem DOM/visual, ausência de duplicação, foto prioritária, composição desktop/mobile e destinos dos botões/âncoras. Passaram check, 41 testes Node, build e as quatro suítes de navegador (público, Dashboard/calendário, Central e PWA/Push), em 320/375/390/430/768/1440 px, sem overflow. Capturas locais em `.local/home-order/`; pacote local em `dist/`. Backend/Auth/Push simulados e rede externa bloqueada nos testes; sem dispositivos físicos ou repetição SQL nesta tarefa.

Recuperação: `backup-nandanails-antes-hero-primeiro-20261119` → `fbd10caacf6be439f27af2b5480cdef8092417ec`, preservando em commit somente a referência recebida sobre `7e1ec5e`. Implementação sem commit, deploy, publicação ou push. Nenhuma operação Supabase remota, reserva ou envio real.

## Revalidação da 006 revisada — 19/11/2026

Migration atualizada pelo usuário com captura de exceções no gatilho principal da Central. Aprovada sem alterações no SQL/código: suíte SQL completa da Central mais falha forçada SQLSTATE 23514 demonstram reserva, fila WhatsApp e seis entregas Push preservadas; claim/finalização aceitos, replay sem duplicação, rollback atômico e recuperação de gravações futuras. O evento perdido na falha exige reconciliação: não é reconstruído automaticamente. Documentação anterior sobre evento obrigatório foi corrigida.

Também passaram SQL de reservas/horários/admin_action/Push/segurança, check, 41 testes Node e as quatro suítes browser (Central, Dashboard/calendário, público e PWA/Push). Código/migration/configurações preservados por hashes. Somente documentação e artefatos locais de teste atualizados. Sem consulta remota, SQL remoto, build, deploy, envio real, publicação ou push. Resultados, hash exato, reprodução e limites: [docs/VALIDACAO_MIGRATION_006.md](../docs/VALIDACAO_MIGRATION_006.md).

## Central de Notificações — 19/11/2026

Implementação local no painel oficial a partir da referência aprovada: sininho/popover, navegação, resumo no Dashboard, indicadores por filtro/período, histórico paginado de 20 eventos, leitura individual/por filtro, detalhes oficiais da reserva e sincronização entre dispositivos por conta. Nenhum exemplo em produção. Visual da Central copiado da prévia; Dashboard/calendário e Push preservados. Comparação de estilos passou em 390/1440 px, com seis larguras sem overflow.

Nova migration **006**, não aplicada remotamente: evento transacional único por reserva, backfill do histórico existente sem enviar Push, leitura persistente por conta administrativa e histórico mínimo sanitizado de estados por dispositivo. RPC exige Auth/is_admin; tabelas privadas com RLS e sem acesso direto. Multidispositivo mostra aceitos e problemas simultaneamente; ausência de registro não inventa status. Retorno de foco e consulta a cada 30 s na aba ativa sincronizam leitura; logout limpa dados/timers e descarta respostas antigas.

**O usuário informou nesta solicitação que o Push está ativo e foi testado em iPhone real.** As seções anteriores sobre preparação ainda não ativa são históricas. Codex não verificou o ambiente remoto. Migrations 001–005, Service Worker, manifesto, funções Push, inscrições, secrets, Cron e Vault permanecem intactos nesta implementação.

Ponto anterior: `backup-nandanails-antes-central-notificacoes-20261119` → `56a9e67`, preservando a referência recebida e edição local prévia no SQL do Cron. Implementação permanece sem commit/push/publicação. Guia completo, arquivos, testes, limites, aplicação manual exclusiva da 006 e publicação posterior: [docs/CENTRAL_NOTIFICACOES.md](../docs/CENTRAL_NOTIFICACOES.md).

Validações locais: check, 41 testes Node, PostgreSQL da Central (10.002 eventos, autorização, persistência, estados, paginação/lote concorrente, falha do ledger e reversão exclusiva), browser da Central com duas páginas simulando dispositivos e 10 mil registros, Dashboard/calendário, site público, PWA/Push, PostgreSQL Push e segurança. Build público em dist, links de documentação, diff check e preservação dos arquivos protegidos aprovados. Sem Supabase/Auth/Push hospedados, dados de produção ou iPhone físico nesta execução. A disponibilidade real da Central depende da aplicação manual autorizada da 006 e publicação do frontend.

## Web Push administrativo para iPhone — 19/11/2026

Implementação somente local, agora com hospedagem futura mantida no **GitHub Pages** (`https://amapa1422.github.io/NandaNails/`), sem Vercel. O guia anterior de Vercel permanece histórico. PWA administrativo inicia em `/NandaNails/admin.html`, com manifesto próprio, ícones NandaNails existentes e Service Worker sem fetch/cache/dados sensíveis. Novo cartão no Dashboard permite ativar/desativar, verificar status e enviar Push de teste; iPhone recebe instruções para Tela de Início. Sessão autorizada integra token em memória e abertura da agenda no clique, preservando Auth/is_admin e funções existentes.

Nova migration incremental **005**, ainda não aplicada remotamente, adiciona inscrições privadas por administradora e fila transacional por dispositivo/reserva. Trigger após INSERT confirmado, isolado de falhas, sem alterar booking/agenda_book ou WhatsApp; worker servidor acionado por Cron, sem polling no frontend. Gestão via `push-admin` (getUser + is_admin + RPC com guarda); despacho por `push-worker` com secret dedicado. Claim concorrente, deduplicação, cota de testes, remoção 404/410 e resultado incerto sem reenvio automático. O aviso é genérico e abre a agenda protegida, sem dados da cliente.

Guia completo de arquivos, arquitetura/limites, secrets, SQL, deploy manual, Cron/Vault, GitHub Pages, instalação iPhone e recuperação: [docs/WEB_PUSH_IPHONE.md](../docs/WEB_PUSH_IPHONE.md). Rollback preparado fora de migrations. Base inicial limpa `039362c0d992d7f1a3030be2a5bae7fd09d0e4e4`; tag inédita `backup-nandanails-antes-web-push-20261119`. Trabalho fica local, sem commit de implementação/push.

Validações locais: 41 testes Node; PostgreSQL Push (6 grupos) e segurança (5); browser público/Dashboard e nova suíte Push em seis larguras; Service Worker real no caminho `/NandaNails/` em localhost, com permissão/Push/Auth simulados; Deno check das duas funções e criptografia/decriptação VAPID/AES128GCM real sem rede; check/build/diff check. Site público, estilos/módulos Dashboard/calendário, assets, config pública, funções booking/notify e migrations 001–004 sem diff. `dist/` regenerado com PWA e somente arquivos públicos.

**Ainda não ativo online.** Nenhuma consulta/alteração no projeto Supabase, migration remota, secret real, cron, deploy, envio Push/WhatsApp, publicação ou push executado. Runtime e dependências públicas foram baixados para validação local. Instalação/recebimento em iPhone físico, app fechado no iOS, Auth/worker/Cron hospedados e entrega aos provedores não testados. Ativação real exige execução manual autorizada da 005, secrets, duas funções, Cron/Vault, frontend Pages e homologação física. Aceitação pelo provedor não comprova recebimento; resultados ambíguos podem perder avisos em favor de evitar reenvio cego.

## Separação do site público e painel — 19/11/2026

Removido somente o link Área da Nanda do rodapé de `index.html`, sem mudar CSS ou outros elementos. Não havia outros links administrativos nas páginas públicas ativas. Painel continua em `/admin.html`; Dashboard/calendário e todos os arquivos administrativos, públicos de funcionamento e Supabase preservados. Base inicial limpa `6937fea4864847beac583b44af32749162697078`; tag inédita `backup-nandanails-antes-separacao-publico-admin-20261119`.

Aprovados: check, 23 testes Node, browser público com rodapé/links em seis larguras, suíte Dashboard, build, testes PostgreSQL locais `admin_action.py` (5 grupos) e `security.py` (5 grupos). RLS, is_admin e admin_action bloqueiam não autorizados nos bancos descartáveis. Corrigida somente fixture de atendimento concluído na suíte Dashboard para permitir execução pela manhã; nenhum código do painel mudou. Comparação HTML com a base, normalizando finais de linha do Git, confirma só a remoção do link. `dist/` local regenerado.

Guia da separação, segurança, limites e configuração futura: [docs/SEPARACAO_PUBLICO_ADMIN_VERCEL.md](../docs/SEPARACAO_PUBLICO_ADMIN_VERCEL.md). Sem impedimento estrutural identificado para Vercel; domínio definitivo, CORS/ALLOWED_ORIGINS e URLs Auth exigem conferência manual futura autorizada. Login/reservas reais e estado remoto não foram testados. Sem consulta ao Supabase remoto, SQL remoto, alteração de secrets, push ou publicação. Migrations intactas, sem backend novo ou CAPTCHA.

## Dashboard e calendário aprovados — 18/11/2026

Implementados localmente no admin oficial: sidebar Dashboard/Minha agenda, menu recolhível, KPIs e contadores, barras e rosca de paths independentes, serviços mais procurados/últimos agendamentos, resumo semanal, Dia/Semana/Mês, busca/status, WhatsApp real normalizado e detalhes laterais com ações existentes. Base visual preservada em `REFERENCIAS/NandaNails_dashboard_graficos_hover_completo.html`; dados vêm exclusivamente de admin_action após Auth/is_admin. Sem números demonstrativos em produção. Faturamento é estimativa dos concluídos, sem afirmar pagamento recebido.

Criados `css/admin-dashboard.css`, `js/admin-ui.js`, `tests/admin-dashboard.mjs` e `docs/DASHBOARD_CALENDARIO.md`; modificados admin.html, js/admin.js, teste browser e package.json. CSS público, index/cursos, imagens/favicon/config, migrations/Edge Functions/RLS intactos. Cache limitado à sessão/intervalos, respostas obsoletas descartadas; logout limpa dados. Geral consulta o histórico integral via contrato existente; calendários limitam o DOM e permitem carregar mais.

Check, 23 testes Node, suíte browser pública/administrativa, suíte específica e build aprovados. Rede externa bloqueada nos browsers; seis larguras 320–1440, 10 mil registros sintéticos, hover real, dados vazios/status únicos, concorrência, teclado, datas em Brasília e comparação de 8 seletores × 7 propriedades em 390/1440 px. Sem certificação pixel a pixel, Safari físico, Supabase/Auth/WhatsApp reais ou carga backend. Detalhes, diferenças necessárias, limites e comandos: [docs/DASHBOARD_CALENDARIO.md](../docs/DASHBOARD_CALENDARIO.md). `dist/` regenerado localmente. Sem acesso ao Supabase remoto, SQL, push ou publicação.

Ponto de recuperação: `backup-nandanails-antes-dashboard-calendario` → `9f8ee9410bd3d3cdddbd15c9c01558b0373fc5e0`, preservando todas as pendências iniciais. Implementação atual permanece para revisão local.

Última atualização: 18/11/2026. Versão atual sem Turnstile ou qualquer CAPTCHA, conforme solicitação expressa do usuário. Ele informou migrations `001`/`002`/`003` já aplicadas e CLI vinculada. Nenhuma operação remota foi realizada pelo Codex nesta otimização; deploy/publicação continuam manuais e não autorizados para execução automática.

## Cursos aprovados — 18/11/2026

Implementação local fiel aos componentes de `REFERENCIAS/nandanails_cursos_botoes_rosa (1).html`, preservando o index oficial: dois cursos independentes da agenda, seção/cards, detalhes em modal, dois botões rosa na primeira linha do hero e Conhecer os trabalhos abaixo. Completo: 3 dias, R$ 300,00, até 2× R$ 150,00 sem juros; tradicional: 2 dias, R$ 200,00 à vista ou até 2× com juros sem taxa inventada. WhatsApp `554491712430`, mensagens individuais e envio dependente da visitante; confirmar número antes de publicar.

Arquivos: `index.html`, estilos limitados em `css/styles.css`, novo `js/courses.js`, teste browser e documentação. Scripts anteriores, painel/login, fotografias, logo/favicon, serviços, Auth, Edge Functions e migrations intactos. Cursos não entram em `public.services`, não consultam backend nem reservam horários. `dist/` regenerado; sem push ou publicação.

Check, 23 testes Node, build e navegador com mocks em 320/375/390/430/768/1440 px aprovados. Inclui calendário/painel/galeria, mensagens, teclado, foco, modal e ausência de overflow. Propriedades coletadas dos cards iguais à referência em 390/1440 px; sem garantia pixel a pixel ou Safari físico. Suítes bloquearam rede externa; recarregamento exploratório fora da interceptação pode ter solicitado catálogo público com configuração local. Nenhuma escrita remota ou alteração do Supabase. Detalhes e limites: [docs/CURSOS.md](../docs/CURSOS.md).

Recuperação: `backup-nandanails-antes-cursos` → `c8cda5cb709711abc29e337e00623de0c3170bfc`, preservando a prévia antes de editar; implementação pendente para revisão local.

## Favicon oficial — 18/11/2026

Ícones criados exclusivamente a partir de `assets/nandanails-logo-original.jpg` (240 × 185), preservada byte a byte. Diretório versionado `assets/icons/n-v1/` contém ICO (16/32/48), PNGs 16/32/180/192/512 e manifest apenas com icons. `index.html` e `admin.html` receberam somente links no head, relativos e compatíveis com `/NandaNails/`. Desenho completo centralizado proporcionalmente em fundo compatível, sem recortar N/adornos ou modificar a logo do cabeçalho. Manifest não altera modo de abertura, navegação ou instalação. Gerador determinístico: `scripts/generate-favicons.ps1`; instruções e testes em [docs/FAVICONS.md](../docs/FAVICONS.md).

Check, build, 23 testes Node, dimensões PNG, estrutura ICO, referências no subdiretório e pacote dist aprovados. Sem teste em iPhone físico. CSS, JavaScript de funcionamento, login, galeria e Supabase intactos. Antes desta etapa, alterações pendentes da correção anterior e a logo foram preservadas no commit local `e16d5c14d7545abb536aa2231f9b12297c568ac4`; tag inédita `backup-nandanails-antes-favicon`. Alteração de favicon pronta para novo commit, sem push ou publicação.

## Correção pontual do painel — SQLSTATE 42702 — 18/11/2026

Preparada `supabase/migrations/202611180004_admin_action_alias.sql`, completa para execução manual no SQL Editor. Ainda não aplicada remotamente. Corrige somente o alias da consulta de serviços em `admin_action('list')`: `jsonb_agg(s)`/`services s` passa a `jsonb_agg(svc)`/`services as svc`. Corpo restante idêntico à última definição da `002`; nenhuma outra colisão encontrada nessa função. Preservados assinatura/default, SECURITY DEFINER, search_path vazio, proprietário, ACL, autenticação/autorização, consultas e operações. A guarda recusa banco sem a função existente. Migrations `001`/`002`/`003` intactas, sem reaplicação remota.

Regressão em PostgreSQL local reproduziu `42702` antes e retornou list corretamente depois; verificou dados, proprietário/permissões e bloqueio de não autorizados, além das demais ações. Novo teste `tests/admin_action.py` e teste estático `tests/admin-action.test.mjs`. O teste de instalação aplica a incremental após o consolidado histórico em bancos locais novos. Guia e confirmação no painel: [docs/CORRECAO_ADMIN_42702.md](../docs/CORRECAO_ADMIN_42702.md). Esta entrega não exige publicar frontend ou Edge Functions. Base limpa `5cb39200968ce6770667e87a354acd6277fe84d3`, tag `backup-nandanails-antes-admin-42702`. Sem push ou operações no Supabase remoto.

## Otimização local de performance — 18/11/2026

Frontend otimizado em `js/api.js`, `booking.js`, `animations.js`, `experience.js` e `admin.js`. Reutiliza formatadores Intl, agrupa apenas consultas públicas simultâneas (sem cache de respostas concluídas), usa Set/DocumentFragment no calendário e preserva fotos existentes ao expandir a galeria. Preparação de revelações separa leituras/escritas; transições do calendário/fotos dispensam offsetWidth. Painel evita consulta semanal repetida quando já tem o mesmo intervalo e ignora respostas antigas. Timeout de 20 s usa AbortController com limpeza de timer, sem depender de AbortSignal.timeout.

Preservados integralmente HTML, CSS, fotografias/logo, fontes, textos, serviços/preços/durações, configuração local, máscara e todo Supabase. Nenhuma alteração de CORS, migrations, Edge Functions, cotas, idempotência ou confirmação por ID. O usuário informou agora `booking` publicada e `ALLOWED_ORIGINS` corrigida, incluindo GitHub Pages; não consultar/refazer essa integração. As pendências antigas abaixo são registro da entrega anterior, não pedido para novo deploy.

Validação atual: 22 testes Node, navegador Chromium/Edge com mocks em seis larguras, check e build aprovados. Capturas iniciais antes/depois idênticas por SHA-256 em 393 × 852 com fontes externas bloqueadas. Quatro leituras concorrentes idênticas: 4 → 1 requisição. Microbenchmark de 310 datas: mediana 41,60 → 1,39 ms. Rodada CDP de três pares: LCP mediano 752 → 892 ms e CLS 0,01637 inalterado; não houve melhora geral demonstrada de carregamento/tempo de interação. Não há medição de INP, Lighthouse ou Safari/iPhone físico. Detalhes, métricas desfavoráveis, arquivos, limitações e publicação manual em [docs/PERFORMANCE.md](../docs/PERFORMANCE.md).

Base limpa: `7b3b5e78a7cb53f7b8866d1fa27a614ed8401d2e`; tag inédita `backup-nandanails-antes-performance`. Alterações atuais ficam locais para revisão; `dist/` regenerado, sem commit de implementação, push ou publicação pelo Codex.

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
- RLS, funções com grants restritos, limites de criação, exclusão de sobreposição e lock transacional, preservados sem alterar o banco.
- Limites globais independentes de IP e HMAC de telefone no backend, contagem persistente em RPC separada antes da gravação. A assinatura de `agenda_book` não recebe `p_rate_key`. Não existe dependência de CAPTCHA no fluxo atual; objetos antigos de consumo de desafios permanecem sem uso, com privilégios restritos.
- Fila de notificações com adaptador oficial WhatsApp Cloud API; envio isolado da reserva.
- Instruções de execução/deploy/backup e pacote estático por `npm.cmd run build`.

## Integrações e pendências

O usuário informou o projeto separado `nandanails-agendamento`, URL `https://fdxocuhgiypynsjxsqtm.supabase.co`, região East US (Ohio), migrations aplicadas e CLI vinculada. A URL está em `js/config.js`; a Publishable key continua sob configuração local do usuário. A chave pública Turnstile foi removida; somente URL e Publishable key definem `configured`. Supabase/Auth e WhatsApp não foram validados em produção pelo Codex. Secrets ficam fora do frontend; não existe integração com Livre Escolha. Não consultamos nem alteramos o estado remoto.

Pendente: publicação manual da função `booking` sem CAPTCHA, atualização autorizada do frontend hospedado e teste real de ponta a ponta. Conferir Publishable key, `ALLOWED_ORIGINS` e `RATE_LIMIT_SALT` de pelo menos 32 caracteres, sem pedir ou expor credenciais no chat. Não há SQL novo ou migration a executar para esta alteração. WhatsApp permanece para etapa futura, sem ativar `notify` ou agendador. Persistência compartilhada e Auth reais exigem validação autorizada. Não houve publicação ou `git push`.

Diagnóstico atual: removida a exigência de chave CAPTCHA em `configured`; continuam obrigatórias URL e Publishable key. `serverToday` só vem de `booking/catalog`, derivado da data PostgreSQL no fuso comercial. Essa guarda e a exigência de ID persistido para confirmar não foram removidas. Publicar a Edge Function não atualiza sozinho o frontend estático.

Preparação histórica anterior à aplicação: `docs/SUPABASE_PRIMEIRA_ENTREGA.md`; migration `202611170003_servicos_iniciais.sql` (seed idempotente que preserva serviços existentes); três SQLs em `supabase/sql-editor/`. O SQL completo inicial consolida `001`/`002`/`003` em uma transação e rejeita tabelas existentes. É alternativa à cadeia de migrations, não uma migration adicional. Não reaplicar em banco existente. O gerador local `scripts/prepare-supabase.mjs` inclui hashes das fontes, sem conexão de rede.

Revisão histórica anterior à aplicação: `docs/REVISAO_MIGRATIONS.md`. Naquela etapa, antes da aplicação informada agora pelo usuário, `001`/`002` foram corrigidas diretamente e o consolidado foi regenerado. A `003` foi validada sem mudar dados. Novo handler `_shared/booking-handler.mjs` compartilha o código efetivo do endpoint com os testes locais. Implante o backend e SQL da mesma revisão: a assinatura antiga de reserva não é compatível.

Proteção atual sem CAPTCHA: chamadas de `agenda_rate_limit` antes de `agenda_book`, exclusivamente com credencial de backend. Cotas globais: catálogo/disponibilidade 300/minuto cada, reservas 60/hora; por telefone, 5 tentativas/hora via HMAC e salt mínimo de 32 caracteres; permanece o limite de 5 reservas/telefone/24h no banco. Sem confiança em cabeçalhos de IP ou cotas fornecidas pela cliente. JSON obrigatório, corpo até 4096 bytes, campos permitidos e validação estrita de nome, telefone, datas, UUID e limites numéricos. Falha na proteção ou ausência de ID na resposta do banco impede sucesso. A RPC antiga `agenda_consume_challenge` permanece restrita, mas não é chamada.

Documento operacional atual: `_CONTROLE_PROJETO/SEM_CAPTCHA.md`, com riscos residuais, configuração e comando manual. `docs/SUPABASE_PRIMEIRA_ENTREGA.md` e `docs/REVISAO_MIGRATIONS.md` são históricos da versão com CAPTCHA; não reaplicar o SQL neles indicado no projeto atual. Nenhuma migration ou objeto do banco foi alterado nesta entrega.

## Regras invariáveis

Preservar layout, tema, logo, fotografias, paleta, fontes, animações, serviços, preços, formulário, máscara, painel, login e integrações. Sem barra inferior móvel. Não misturar com Livre Escolha. Não incluir secrets em arquivos públicos, expor dados pessoais ou afirmar integração real sem comprovação. Não apagar reservas ao atualizar horários. Alterações em produção exigem autorização.

## Disponibilidade

A disponibilidade padrão agora permite segunda a sexta somente inícios às 15h e 16h; sábado das 08h às 16h, com término do procedimento até 16h; domingo fechado. Nos dias úteis, o limite técnico herdado de 18h acomoda o serviço atual mais longo iniciado às 16h e não libera inícios adicionais. Sábado mantém a grade de 30 minutos filtrada pela duração.

`202611170002_horarios_padrao.sql` atualiza o padrão original apenas quando os seis turnos têm exatamente os valores históricos e não existe edição de horários na auditoria. Caso contrário, preserva a configuração e registra `applied=false` em `private.schedule_default_updates`. É idempotente e não altera reservas, clientes, preços ou durações. A política privada `allowed_weekday_starts` também é validada nas remarcações e persiste ao salvar turnos pelo painel. Turnos continuam limitando o término; liberar outros inícios exigiria revisão explícita da política. Não há mudança de interface.

Inícios explícitos agora independem da grade da abertura: turno 15h15–18h permite 16h para 120 minutos. Expedientes ativos sem nenhum início permitido são recusados e a alteração inteira é revertida; dados `hours` inválidos não fecham a agenda por acidente. `hours: []` continua sendo fechamento intencional. Revogações de privilégios incluem `PUBLIC`, evitando permissões herdadas, e abrangem sequência de auditoria/tabelas privadas.

As migrations de horários já foram aplicadas pelo usuário. A validação pelo Codex usa apenas PostgreSQL local descartável. Não reaplicar migrations no projeto existente. Alterações diretas de SQL sem auditoria que reconstituam exatamente o seed não podem ter origem distinguida automaticamente; revisar a configuração real antes da execução remota.

## Versão estável e problemas conhecidos

Referência anterior às alterações: tag `backup-nandanails-antes-horarios`, commit `4d81ead2b8572d4de023f332986ad847ad4199d2`. Repositório local próprio inicializado nesta pasta; o Git encontrado acima pertence à pasta do usuário e não foi alterado.

Versão histórica de horários validada localmente: `nandanails-horarios-2026-11-17` (tag local; consultar o histórico para o commit). Essa referência não significa versão publicada nem integração online comprovada.

Recuperação anterior à preparação Supabase: tag `backup-nandanails-antes-supabase-real`, commit `a6360e1810a0c715d482bcf93c86706b285401d2`. Continua sendo a referência estável anterior; a preparação nova não significa ativação online.

Preparação Supabase documentada: `nandanails-supabase-preparado-2026-11-17`; commit principal `f030f570ae1c8ef5fbd24d0bda491a06ad5e8fc9`. A tag inclui o registro final da documentação, sem operações remotas.

Revisão final preparada: `nandanails-migrations-revisadas-2026-11-17`, commit principal `675c3da75fea36bdf68eb3eac0186aad1a19a909`. A tag inclui o registro final. Recuperação anterior: `backup-nandanails-antes-revisao-migrations` → `c19799aa6dda48e73983ed31728d843b770a88bd`. Nenhuma dessas referências significa versão aplicada no Supabase.

A configuração padrão antiga era 09–18h nos dias úteis e 09–14h no sábado. A migration inicial foi revisada na entrega anterior a pedido expresso do usuário, antes da primeira aplicação. Após aplicação em qualquer ambiente, não editar seu histórico: criar nova migration. Novas instalações usam os arquivos atuais em ordem `001 → 002 → 003`, ou o consolidado atual, nunca ambos. Configurações personalizadas não podem ser substituídas automaticamente.

Limitações herdadas: sem validação em Safari/iPhone físico, leitor de tela, Lighthouse móvel ou backend remoto; testes Chromium usam mocks. `docs/ENTREGA.md` relata a primeira entrega e não substitui este estado atual. Campos de configuração de horário no catálogo são referência; a disponibilidade real vem do servidor.

Validação da atualização anterior de horários: verificações estáticas, quatro testes Node, dez grupos de regressão PostgreSQL, oito grupos específicos da migration e teste Chromium em seis larguras. O teste do calendário inclui domingo fechado e somente 15h/16h em dia útil, com respostas simuladas. Os resultados e comandos estão no histórico.

Validação adicional da primeira entrega Supabase: cinco testes Node; dez grupos de regressão PostgreSQL; oito grupos de horários; seis grupos da instalação completa. Incluem equivalência entre consolidado e migrations, RLS/grants sob permissões iniciais amplas, seed repetido/customizado, rejeição de reinstalação, data de referência e concorrência. Apenas bancos locais descartáveis. Navegador, Auth remoto, Edge Functions reais e mensagens reais não foram executados nesta etapa.

Revisão final: 15 testes Node; testes SQL de segurança (privilégios reais com fixtures e permissões iniciais amplas para PUBLIC, rate limiting, replay concorrente, horários alterados e FKs); repetidas as suítes de instalação, horários e regressão; navegador Chromium em seis larguras com backend simulado. Sem alteração dos arquivos HTML/CSS, logo, fotos ou animações. Somente `js/api.js` (ação do captcha) e `js/admin.js` (mensagens) mudaram fora do backend/testes/documentação.

Limites operacionais: sem CAPTCHA, bots podem alternar telefones, consumir a cota global ou ocupar horários válidos. Cotas compartilhadas podem bloquear clientes legítimas; não são WAF nem verificação de posse do telefone. Execução Deno hospedada, Supabase/Auth remoto, carga real e Safari físico continuam sem teste. Não afirmar ativação online nem garantia contra automação.

Validação atual sem CAPTCHA: 17 testes Node, 29 grupos SQL e navegador Chromium em seis larguras aprovados. Histórico aplicado e arquivos visuais preservados; detalhes em `HISTORICO_ALTERACOES.md`.

Versão atual sem CAPTCHA: commit principal `d9cd450bcf0ab5cd295f8406ae6cb37fa977557b`; tag local `nandanails-sem-captcha-2026-11-17` inclui o registro final. Não publicada.
