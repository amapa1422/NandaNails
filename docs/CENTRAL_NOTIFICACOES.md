# Central de Notificações — 19/11/2026

Implementação local no painel oficial, baseada em `REFERENCIAS/NandaNails_central_notificacoes_previa.html`. Não houve consulta ao Supabase remoto, execução remota de SQL, deploy, alteração de secrets, envio real de mensagens, publicação ou push.

O usuário informou que o Push já está ativo e testado em iPhone real. Esse relato atualiza o estado operacional descrito na documentação anterior de preparação; não foi verificado remotamente pelo Codex. A entrega preserva o mecanismo existente e prepara somente a nova Central.

## Arquivos

Criados:

- `css/admin-notifications.css`: regras da Central copiadas da referência, com ajustes de integração, toque e acessibilidade.
- `js/admin-notifications.js`: sininho, popover, contadores, histórico, filtros, paginação, leitura e sincronização.
- `supabase/migrations/202611190006_admin_notification_center.sql`: somente os objetos novos da Central.
- `supabase/rollback/202611190006_admin_notification_center.sql`: reversão manual específica, não é migration de instalação.
- `tests/notification-center.py`, `tests/admin-notifications.mjs` e este guia.

Modificados: `admin.html`, `js/admin.js`, `js/admin-ui.js`, `package.json`, os três documentos de controle e uma nota de estado em `docs/WEB_PUSH_IPHONE.md`.

Ponto anterior: tag `backup-nandanails-antes-central-notificacoes-20261119`, commit `56a9e67`. Preserva a referência nova e a edição local prévia em `supabase/ops/enable-web-push-cron.sql`, que não foi corrigida nem executada nesta entrega. As alterações da implementação ficam locais para revisão.

## Interface e comparação visual

O painel existente continua sendo a base funcional. Foram adicionados o sininho do cabeçalho, uma entrada na navegação lateral, o resumo de novidades no Dashboard e a seção Central. Serviços, funcionamento e bloqueios continuam nas abas existentes da agenda. Não há nova página nem recarga na navegação.

A Central reproduz o título, quatro cards, proporções da grade, histórico, painel de saúde, popover, cores, tipografia, bordas e hover da referência. Mini zoom e redução da opacidade dos demais cards usam CSS em mouse/trackpad; toque e `prefers-reduced-motion` não recebem zoom. Os contadores usam `requestAnimationFrame` por até 540 ms, somente quando o valor muda. Não há animações permanentes. Os estilos e animações originais de gráficos/Dashboard/calendário não foram editados.

Diferenças funcionais necessárias em relação à demonstração:

- Dados exclusivamente do backend; sem clientes, números ou estados demonstrativos em produção.
- Quantidade de visualizadas no primeiro card; métricas da Central usam o filtro e período atuais. Sininho, menu e resumo do Dashboard mostram o total global não visualizado da conta.
- Leitura em lote cobre **todo o filtro**, inclusive outras páginas, até o instante da consulta exibida; novas reservas posteriores ficam não lidas.
- Paginação de 20 registros com anterior/próxima, em lugar de anexar cards sem limite.
- Todos os estados Push e suas quantidades por dispositivo aparecem separadamente, inclusive estados mistos.
- Datas reais em Brasília; períodos Hoje/Semana/Mês/Geral são calculados no banco pelo momento de criação da reserva.
- Alvos de toque mínimos de 44 px nos botões da Central. Cabeçalho pode ocupar duas linhas em telas muito estreitas; menu recolhido conserva indicador e nome acessível.
- Abrir uma reserva reutiliza o drawer oficial com WhatsApp, status e remarcação. A reserva é consultada por ID no backend, mesmo fora do intervalo carregado do calendário; depois de aberta, o aviso é marcado como lido.

Comparação automatizada: 10 seletores × 7 propriedades de estilo em 390 e 1440 px coincidem com a referência, com estados equivalentes. Capturas e JSON em `.local/notifications/`. Não é certificação pixel a pixel. Fontes externas foram bloqueadas nas duas versões, usando o mesmo fallback. O Dashboard original também conserva a comparação anterior de 8 seletores × 7 propriedades. Telas 320, 375, 390, 430, 768 e 1440 px foram verificadas sem transbordamento horizontal.

## Dados e segurança

`private.admin_notifications` contém um evento lógico por `appointment_id`, com PK e FK para a reserva e data original de criação. Um trigger de INSERT persiste o evento na mesma transação da reserva, independentemente de inscrições Push. Rollback desfaz ambos; replay da mesma reserva não gera novo evento. Remarcação, cancelamento e mudanças de status não criam outro evento.

A migration faz backfill de **todas as reservas existentes**, incluindo as atualmente canceladas/concluídas: elas representam eventos históricos de criação, não novas reservas nem novos envios. Começam não visualizadas para cada conta. Nenhum Push histórico é enfileirado. Os nomes/serviços/horários são consultados da reserva, refletindo remarcações; `created_at` permanece o instante original.

`private.admin_notification_reads` usa PK `(user_id, appointment_id)`, com data de leitura. Dispositivos da mesma conta compartilham a leitura; contas administrativas diferentes têm leituras independentes. A entrada pode ser removida para marcar como não lida. Novas contas autorizadas podem consultar o histórico do estúdio, com leitura própria. Não há dados pessoais ou token em localStorage.

`private.admin_notification_push` guarda somente ID de entrega, ID da reserva, conta destinatária e estado. Não guarda endpoint, chave de inscrição, token, payload ou novo snapshot de cliente. O histórico permanece enquanto a reserva/conta existir; não acompanha a limpeza de sete dias da fila Push. A necessidade futura de retenção/purga deve ser revisada separadamente.

Todas as tabelas novas usam RLS sem policies/grants diretos para navegador. Somente `public.admin_notifications(text,jsonb)` recebe EXECUTE para `authenticated`; cada ação verifica `public.is_admin()` e deriva a conta de `auth.uid()`. Não aceita ID de administradora escolhido pelo cliente. Helpers privados têm EXECUTE revogado. A RPC tem `security definer` com `search_path=''` e nomes qualificados. `anon`, conta comum e administradora revogada são recusados pelo backend.

As ações da RPC são `list`, `read`, `read_filter` e `detail`. `list` agrega indicadores no servidor e devolve no máximo 20 itens + 4 recentes, com cursor `(created_at,id)` para desempate. `read_filter` marca atomicamente os eventos não visualizados que pertencem ao filtro/período e existiam até `until`, limitado pelo relógio do servidor. Escritas concorrentes usam a PK para evitar duplicação. `detail` fornece a reserva existente apenas depois da guarda administrativa.

O frontend renderiza valores de clientes com `textContent`; não interpreta nomes/serviços como HTML. Usa o transporte Auth existente, com JWT somente em memória, timeout e limpeza/invalidação no logout. Não expõe tabelas de inscrições/entregas nem credenciais privilegiadas.

## Integração com o Push existente

Migrations 001–005, `admin-sw.js`, manifesto, `js/admin-push.js`, CSS Push, ambas as Edge Functions e módulos compartilhados, Cron, Vault e chaves permanecem intactos em relação ao ponto anterior. Não é necessário redeploy de função, reinstalar PWA, cancelar inscrição ou gerar chaves para instalar a Central.

A 006 acrescenta um trigger diagnóstico em `private.push_deliveries`, acompanhando INSERT/UPDATE/DELETE. A fila e o worker mantêm o contrato original. Falha desse registro auxiliar é isolada com warning `ADMIN_NOTIFICATION_PUSH_LOG_FAILED`, sem interromper reservas ou o envio Push. Esse warning requer investigação administrativa; um resultado que falhou ao ser registrado pode ficar incompleto/desatualizado.

Na revisão posterior da 006 fornecida pelo usuário, o gatilho principal `private.record_admin_notification()` também captura exceções: emite `ADMIN_NOTIFICATION_RECORD_FAILED SQLSTATE ...` e permite que a reserva prossiga. Em funcionamento normal, reserva e evento participam da mesma transação. Se a gravação do evento falhar, a reserva e as filas podem ser confirmadas **sem o evento na Central**. A recuperação de gravações futuras não preenche esse evento perdido automaticamente, e replay da reserva não executa novamente o trigger de INSERT. Investigar o warning e reconciliar os eventos ausentes em intervenção separada autorizada; não reaplicar a migration 006 inteira. A criação da Central deixa de ser requisito para confirmar a reserva.

Estados mostrados: Pendente, Em processamento, Aceito pelo provedor, Falhou, Expirou e Resultado desconhecido. Sem entrega registrada, a tela diz **Sem registro de envio Push**; não infere que um dispositivo existe, que ocorreu falha ou que não houve reserva.

Para vários dispositivos da mesma conta, a Central mostra a contagem de **cada estado**, em vez de escolher um vencedor: aceito em um e falha em outro aparecem juntos. O card Aceitos conta eventos com pelo menos uma aceitação; o card de problemas conta eventos com pelo menos um failed/unknown/expired. O resumo lateral conta envios por estado. Assim, um evento pode aparecer em ambos os indicadores. Estado de leitura independe do Push; marcar como lido nunca envia, cancela ou repete Push.

Limites herdados: a 005 remove inscrições e entregas em 404/410, sem persistir o motivo da exclusão. A 006 não reescreve essa função. Ao excluir entrega ainda pending/sending, conserva o resultado como **desconhecido**, pois não consegue distinguir expiração, cancelamento manual e outras remoções. Expiração explícita gravada pelo worker (pendências >24h) aparece como Expirou. Aceitos/falhos/expirados já persistidos sobrevivem à limpeza. Entregas apagadas **antes** da 006 não podem ser reconstruídas: não se inventa resultado para elas.

## Sincronização e volume

A Central consulta depois do login autorizado, ao entrar na seção, ao abrir o sininho, ao atualizar e depois das ações. Também atualiza ao retornar foco/visibilidade e a cada 30 segundos enquanto a página está visível e autenticada. Não usa Realtime nem modifica publicação do Supabase. O timer é encerrado no logout. Não há acesso remoto novo no site público.

A leitura entre dispositivos é persistente; a propagação visual é eventual, até 30 s na aba ativa ou imediata ao retornar o foco/atualizar. Falhas de rede são mostradas sem criar sucesso fictício. Respostas atrasadas de sessão/filtro anterior são descartadas. Respostas iguais não reconstroem cards nem reiniciam contadores. Paginação limita o DOM mesmo após navegar por muitas páginas; agregações continuam percorrendo o histórico no servidor. Não houve teste de carga em produção nem dimensionamento para milhões de eventos.

## Validação local

- `npm.cmd run check`: sintaxe JavaScript, links locais e IDs HTML sem duplicação.
- `npm.cmd test`: 41 testes existentes de Node, incluindo segurança e contrato Push.
- `python -u tests/notification-center.py`: banco descartável `nandanails_notification_center_test`, host fixo **127.0.0.1:55432**; autorização, RLS/grants, backfill, replay, transação, reserva sem inscrição, leitura/desleitura entre conexões, isolamento entre contas, estados mistos, limpeza de fila, filtros, 10.002 eventos, paginação integral com datas empatadas, lote concorrente e revogação. Falha simulada do ledger preserva a reserva e a finalização Push; o lote não lê reservas posteriores ao corte. Rollback exclusivo da Central preserva reservas e objetos Push.
- `node tests/admin-notifications.mjs`: mocks bloqueiam rede externa; login administrativo/negado, Central vazia/preenchida, contadores, páginas, leitura, lote além da página, duas páginas de navegador simulando dispositivos da mesma conta, atualização por foco, filtros, drawer correto/WhatsApp, popover, Escape/foco, toque/larguras, hover, reduced motion, 10 mil registros simulados, indisponibilidade e logout durante consulta. Comparação de estilos e capturas.
- `node tests/admin-dashboard.mjs`: regressão do Dashboard e agenda Dia/Semana/Mês, gráficos, hover, filtros, ações, remarcação, 10 mil registros e comparação com a referência anterior.
- `node tests/browser.mjs`, `node tests/push-browser.mjs`: regressão pública/administrativa e PWA/Service Worker real local, com Auth/PushManager/provedor simulados.
- `python -u tests/push.py` e `python -u tests/security.py`: regressão de fila, workers, contratos/grants e segurança em bancos locais descartáveis.
- `npm.cmd run build`, `git diff --check` e comparação Git dos arquivos protegidos.

Não foram usados login, reservas ou dados de produção. Os testes não comprovam recebimento em iPhone físico, Auth/Supabase hospedados, latência de internet, funcionamento remoto do Cron/Vault ou publicação. O teste de dois dispositivos usa duas páginas isoladas com backend simulado; persistência efetiva é testada por conexões SQL separadas no PostgreSQL local.

## Aplicação segura da 006

Instrução para execução manual futura autorizada; nenhum comando remoto foi executado pelo Codex.

1. Revisar o diff e a migration 006; confirmar manualmente o projeto exclusivo `fdxocuhgiypynsjxsqtm`, backup e existência dos objetos já instalados por 001–005. Se houver divergência, interromper a aplicação e investigar. Não editar/reaplicar o histórico nem executar `supabase db push`.
2. No SQL Editor desse projeto, executar **somente** o conteúdo de `supabase/migrations/202611190006_admin_notification_center.sql`, uma vez. O arquivo possui BEGIN/COMMIT. Falha deve resultar em rollback; não continuar aplicando trechos isolados nem executar o arquivo de rollback como instalação. Registrar a aplicação no processo de controle de migrations existente.
3. Não redeployar `booking`, `notify`, `push-admin` ou `push-worker`; preservar todas as configurações, secrets, Cron e inscrições.
4. Publicar o frontend correspondente somente após revisão/autorização. Antes da 006, a Central exibe indisponibilidade; Dashboard, agenda e Push antigos continuam com seus contratos.
5. Em homologação autorizada, entrar com a conta da Nanda, conferir o backfill não lido, abrir uma reserva conhecida, marcar leitura em dois dispositivos, conferir filtros e verificar que teste/novos avisos Push continuam funcionando. Não criar/cancelar/remarcar reservas reais sem autorização.

## Testar e publicar o frontend

Usar as instruções de servidor e navegador descartável em `docs/DASHBOARD_CALENDARIO.md`; não inserir credenciais reais nas suítes. Com PostgreSQL local de testes na porta 55432 e browser CDP na 9223:

```powershell
npm.cmd start
# Em outro terminal, executar suítes browser sequencialmente:
npm.cmd run test:notifications
npm.cmd run test:notifications:db
npm.cmd run test:dashboard
npm.cmd run test:browser
npm.cmd run test:push
npm.cmd run test:push:db
python -u tests/security.py
npm.cmd run check
npm.cmd test
npm.cmd run build
git diff --check
```

Abrir manualmente `admin.html` com a configuração existente e fazer login usa o backend real; isso é diferente dos testes interceptados. Não usar esse caminho para testes automatizados sem autorização remota.

Após autorização de publicação, revisar `git status`/diff, selecionar somente os arquivos da entrega e commitar. Conferir remoto, branch e configuração atual do GitHub Pages. O build gera `dist/` apenas com conteúdo público. Publicar o pacote pelo processo existente, ou fazer o push da branch configurada **somente quando autorizado**. Confirmar que `admin.html`, `css/admin-notifications.css` e `js/admin-notifications.js` foram publicados juntos em `/NandaNails/`. Recarregar o painel para carregar os scripts novos. Não copiar SQL, testes, documentos internos ou `.local/` para o pacote de hospedagem. Não mudar o registro do Service Worker nem suas chaves.

## Recuperação

Preservar as alterações atuais e criar branch inédita a partir da tag anterior, conforme `_CONTROLE_PROJETO/RECUPERACAO.md`. Recuperar somente frontend não desfaz banco nem exige remover a 006: seus objetos podem permanecer sem uso pelo frontend antigo.

Se for indispensável remover a Central do banco após aplicação, revisar e autorizar separadamente `supabase/rollback/202611190006_admin_notification_center.sql`. Ele apaga o histórico auxiliar e leituras da Central, preservando reservas, clientes, Push, inscrições e fila. Não executar rollback da 005 enquanto a Central estiver instalada; remover primeiro a 006 se uma reversão mais ampla for explicitamente aprovada. Não restaurar dados reais como parte de uma recuperação de código.
