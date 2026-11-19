# Web Push administrativo — preparação local de 19/11/2026

## Entrega e estado

Implementado localmente para **GitHub Pages**, em `https://amapa1422.github.io/NandaNails/`, sem Vercel ou aplicativo nativo. Nada foi aplicado no Supabase, nenhum secret real foi criado, nenhum Push foi enviado e nenhum arquivo foi publicado. Para receber avisos reais, o responsável ainda precisa autorizar e executar a ativação descrita abaixo e testar num iPhone físico.

O painel recebe o cartão **Notificações de agendamentos**, com ativar, desativar, verificar status e enviar teste. O site das clientes não carrega o novo módulo/manifesto; seu HTML, CSS, scripts de agendamento, cursos, imagens e preços foram preservados. O painel mantém suas operações e recebe apenas o cartão e a integração de sessão/abertura da agenda.

## Arquitetura

```text
Reserva pública → booking/agenda_book existentes → INSERT confirmado em appointments
                                                   │ mesma transação
                                                   ▼
                             trigger → private.push_deliveries, por dispositivo
                                                   │ após commit
Supabase Cron (1/min) → push-worker → claim_push (SKIP LOCKED)
                                      → Web Push criptografado com VAPID
                                      → Apple/FCM/Mozilla → Service Worker → aviso genérico

Admin Auth + is_admin → push-admin → admin_push → inscrição própria / teste
                                                       └ teste despachado imediatamente
```

Foi escolhida uma **fila transacional separada**, em vez de acoplar HTTP à função `booking` ou depender de webhook sem controle de repetição. Não altera `booking`, `agenda_book`, a fila WhatsApp nem suas Edge Functions. O trigger roda apenas em INSERT com status confirmado; retries idempotentes que retornam a mesma reserva e atualizações de status/remarcações não inserem outro aviso. Sem inscrição prévia não existe destinatário; habilitar um novo dispositivo não envia o histórico.

O trigger insere registros na mesma transação: rollback da reserva desfaz a fila. Erro de fila é capturado e registra somente um aviso com SQLSTATE, deixando a reserva prosseguir. Essa escolha prioriza a agenda e pode perder o aviso se houver falha na fila; monitorar os warnings `PUSH_QUEUE_FAILED`.

O Cron do Supabase invoca o worker independentemente de abas abertas. Não há polling, realtime ou timer permanente novo no frontend. O worker processa até 5 entregas por chamada e cada envio tem timeout de 10 s. A frequência de 1 minuto e a capacidade são iniciais; vários dispositivos podem consumir mais de uma rodada. Não há promessa de entrega instantânea.

## Segurança e dados

- `push-admin` valida o Bearer com `auth.getUser` e `is_admin` antes de gerenciar qualquer inscrição. `admin_push` também verifica `public.is_admin()` no banco e usa `auth.uid()`; não recebe um user_id escolhido pelo navegador. Uma administradora não consulta/exclui inscrições de outra. Um endpoint já pertencente a outra conta não pode ser apropriado por conflito de cadastro.
- Inscrições e fila ficam em tabelas **private**, com RLS habilitada, nenhum grant/policy de acesso direto para anon/authenticated e acesso apenas pelas funções restritas. Não foram alteradas políticas existentes.
- Máximo de 20 dispositivos por conta e um teste/minuto/dispositivo no banco. Endpoint único evita duplicar inscrições; reservas têm unicidade por dispositivo/reserva. Teste é uma entrega sem appointment_id e não cria reserva.
- Worker exige `PUSH_WORKER_SECRET` com pelo menos 32 caracteres, comparado por hashes com laço de tamanho fixo. Anon key e JWT de usuário não permitem drenar a fila. RPCs de claim/finalização são exclusivas de `service_role`. A chave privilegiada nunca vai para o navegador.
- CORS usa `ALLOWED_ORIGINS` existente com origens exatas, sem wildcard. Não alteramos esse secret. Endpoints aceitos por defesa contra SSRF: Apple `*.push.apple.com` de um nível, FCM e Mozilla, somente HTTPS e sem credenciais, query ou fragmento. Outros provedores, como WNS, não estão habilitados nesta primeira versão; a inscrição é recusada com mensagem de incompatibilidade. Novos hosts exigem revisão explícita.
- Payload/aviso não contém nome, telefone, serviço, horário, token ou ID da reserva. Usa apenas texto genérico, tipo e ID aleatório da entrega. O clique abre a agenda geral e exige login/autorização, sem expor uma reserva pela URL. Não foi criado acesso público a dados administrativos.
- Service Worker não tem handler de fetch, Cache API, armazenamento de clientes ou tokens. Não há modo offline administrativo. Seu scope técnico `/NandaNails/` é necessário para o painel na raiz; ele não intercepta nem armazena solicitações do agendamento público. Somente o admin registra esse worker.
- Fazer logout remove o token e invalida respostas locais; **não cancela a inscrição Push**. Assim os avisos continuam com o aplicativo fechado e sem sessão aberta. Em aparelho compartilhado, desativar antes de sair. Revogar a administradora em `admin_users` impede novas inclusões na fila e o worker remove suas inscrições antes de novos claims. Um aviso já entregue ao provedor antes da revogação não pode ser retirado.

## Duplicações, falhas e limites de entrega

`pending → sending` é gravado atomicamente antes de enviar. Workers concorrentes não pegam a mesma entrega. Resposta aceita fica `accepted`, **não delivered**. Só 429 explícito volta para a fila (intervalo de 5 minutos, máximo 3 tentativas); 404/410 excluem a inscrição inválida e suas entregas. Outros 4xx ficam failed. Timeout, falha de rede e 5xx ficam unknown, sem retry automático; um processo interrompido em sending vira unknown após 5 minutos.

Isso evita reenvio cego de um envio cujo resultado não é conhecido. Também significa que um processo que parar entre o claim e o despacho pode perder um aviso. Não existe garantia de exatamente uma entrega na tela do iPhone ou de que o sistema operacional exibiu o aviso. O tag estável e renotify=false reduzem repetição visível. Pendências de mais de 24h expiram; entregas de mais de 7 dias são removidas pelo worker. As inscrições permanecem até cancelamento, revogação administrativa ou resposta 404/410.

TTL no provedor: uma hora. Rede indisponível, Foco, permissões, políticas do sistema e expiração podem impedir ou atrasar a exibição. Se o iOS remover/rotacionar a inscrição, abrir o painel e usar Verificar status/Ativar novamente. Renovação silenciosa sem sessão administrativa não foi implementada.

## Arquivos

| Finalidade | Arquivos |
|---|---|
| PWA | `admin.webmanifest`, `admin-sw.js`; ícones NandaNails existentes de 192/512 e Apple 180 preservados |
| Interface | `css/admin-push.css`, `js/admin-push.js`; integração mínima em `admin.html` e `js/admin.js` |
| Banco incremental | `supabase/migrations/202611190005_admin_web_push.sql` |
| Reversão manual | `supabase/rollback/202611190005_admin_web_push.sql` |
| Gestão autenticada | `supabase/functions/push-admin/index.ts` |
| Despacho | `supabase/functions/push-worker/index.ts`, `_shared/push-handler.mjs`, `_shared/push-runtime.ts` |
| Configuração local | `supabase/config.toml`, `deno.lock` com integridade das dependências |
| Agendamento servidor | `supabase/ops/enable-web-push-cron.sql` |
| Chaves e pacote | `scripts/generate-push-secrets.mjs`, `scripts/package.mjs`, `package.json` |
| Testes | `tests/push.test.mjs`, `tests/push.py`, `tests/push-browser.mjs`, `tests/push-crypto.mjs` |

Não foi reescrito o histórico 001/002/003/004. A 005 adiciona somente os objetos Push e o trigger. O estado remoto da correção 004 anterior continua não verificado; eventual erro 42702 do painel segue o guia específico e exige etapa separada autorizada.

## Ativação futura no Supabase — somente após autorização

1. Revisar o diff e preservar o ponto Git indicado abaixo. Conferir manualmente o projeto `fdxocuhgiypynsjxsqtm`. Não usar `db push` para esta ativação: executar **somente a nova 005**, uma vez, no SQL Editor autorizado, sem reaplicar histórico. O arquivo contém begin/commit. Não executar o rollback como migration de instalação.
2. Gerar chaves no computador da responsável, sem enviá-las no chat:

   ```powershell
   node scripts/generate-push-secrets.mjs --write
   ```

   O gerador offline cria `.local/push-secrets.env`, ignorado pelo Git e excluído de `dist`, sem imprimir valores e sem sobrescrever arquivo existente. Adicionar manualmente nesse arquivo `VAPID_SUBJECT=mailto:EMAIL_REAL_DA_RESPONSAVEL`. Guardar o arquivo no cofre e restringir suas permissões locais; a proteção mode 0600 depende do sistema operacional. Não regenerar o par depois da ativação sem planejar nova inscrição dos dispositivos.

3. Criar/conferir os seguintes **Edge Function secrets**, pelo Dashboard ou pelo comando manual abaixo:

   | Secret | Conteúdo / destino |
   |---|---|
   | `VAPID_PUBLIC_KEY` | Chave pública P-256; única parte VAPID que `push-admin` devolve ao navegador |
   | `VAPID_PRIVATE_KEY` | Chave privada do mesmo par; exclusivamente backend |
   | `VAPID_SUBJECT` | `mailto:` de contato real (ou URL HTTPS apropriada), sem localhost |
   | `PUSH_WORKER_SECRET` | Valor aleatório dedicado, 64 caracteres hex no gerador |
   | `ALLOWED_ORIGINS` | Preservar a configuração atual; deve conter exatamente `https://amapa1422.github.io`, sem `/NandaNails/` |

   O ambiente Supabase já fornece `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`; a implementação depende deles, exclusivamente no backend. Não colocar Secret keys em `js/config.js` ou no GitHub Pages. A URL/chave pública existente do frontend não foi modificada.

   ```powershell
   supabase secrets set --env-file .local/push-secrets.env --project-ref fdxocuhgiypynsjxsqtm
   supabase functions deploy push-admin --no-verify-jwt --project-ref fdxocuhgiypynsjxsqtm
   supabase functions deploy push-worker --no-verify-jwt --project-ref fdxocuhgiypynsjxsqtm
   ```

   `verify_jwt=false` mantém validação dentro de cada handler: getUser/is_admin na gestão e secret dedicado no worker. Não é acesso administrativo anônimo. Não publicar `booking` nem `notify` para esta mudança.

4. Habilitar manualmente Cron/pg_cron e pg_net nas integrações/extensões do Supabase, se ainda não estiverem habilitados. No **Vault**, criar pela interface, sem literal secreto em arquivo SQL:

   - `nn_push_worker_url`: `https://fdxocuhgiypynsjxsqtm.supabase.co/functions/v1/push-worker`.
   - `nn_push_worker_secret`: exatamente o mesmo valor do Edge secret `PUSH_WORKER_SECRET`.

5. Revisar e executar manualmente `supabase/ops/enable-web-push-cron.sql`. Ele recusa ausência de secrets ou job duplicado e agenda `nn-web-push` uma vez por minuto. Não é um loop no navegador. Sem esse job (ou invocador servidor equivalente autorizado), o teste imediato funciona, mas novos agendamentos permanecem na fila.
6. Monitorar o histórico de execuções do Cron, respostas HTTP do pg_net e logs das funções. Não imprimir endpoints, chaves ou dados de clientes. Uma consulta de saúde autorizada pode agregar somente estados:

   ```sql
   select state, count(*) from private.push_deliveries group by state;
   ```

## Publicação posterior no GitHub Pages

Continuar usando GitHub Pages. O guia anterior de Vercel é histórico; não se aplica à hospedagem decidida para esta entrega. Nenhum `vercel.json` foi criado.

Após autorização para publicar, revisar e commitar os arquivos da tabela (incluindo os três documentos de controle e este guia), sem secrets. Comandos de conferência/build:

```powershell
git status --short
git diff --check
npm.cmd run check
npm.cmd test
npm.cmd run build
```

`dist/` recebe apenas páginas, CSS/JS/assets, `admin.webmanifest`, `admin-sw.js` e `.nojekyll`. Conforme o fluxo existente do GitHub Pages, publicar esse pacote estático, ou os arquivos públicos da branch já configurada. Em publicação por branch, depois do commit revisado e conferência do remoto/branch:

```powershell
git push origin main
```

Esse comando é **somente instrução futura**, não foi executado. Push só publica automaticamente se a configuração existente de Pages usar esse fluxo. Confirmar na hospedagem `/NandaNails/admin-sw.js` com MIME JavaScript, manifesto com JSON/manifest, HTTPS, ícones e `/NandaNails/admin.html` acessíveis. Não adicionar headers de cache agressivo ao worker nem divulgar o link administrativo no site público.

## Instalar e ativar no iPhone

1. Usar iPhone com iOS 16.4 ou posterior e abrir no Safari `https://amapa1422.github.io/NandaNails/admin.html`.
2. Compartilhar → **Adicionar à Tela de Início** → confirmar NandaNails. O manifesto abre em modo standalone e inicia em `/NandaNails/admin.html`.
3. Abrir pelo ícone instalado, entrar com a conta administrativa da Nanda. A sessão continua em memória como antes: reabrir/recarregar pode exigir novo login; isso não interrompe o Push inscrito.
4. No Dashboard, tocar em **Ativar notificações** e aceitar o pedido do iOS. Não há pedido automático ao entrar no site ou ao logar. Se estiver na aba do Safari, o cartão mostra instruções para instalar primeiro.
5. Tocar em **Enviar notificação de teste**. A mensagem de sucesso significa que o provedor aceitou o envio; verificar a exibição no aparelho. O botão não cria agendamentos. Pode repetir após um minuto.
6. Fechar o painel e fazer uma reserva real controlada, previamente autorizada. Conferir que o aviso genérico aparece e, ao tocar, abre a agenda ou o login seguido da agenda. O clique não dispensa autenticação e não abre dados da cliente sem autorização.
7. Para parar neste aparelho, entrar e usar **Desativar notificações**. Nos Ajustes do iPhone também é possível negar a permissão; para reativar, liberar a permissão e verificar o status no painel. A desativação não altera os outros dispositivos.

## Testes e limitações

- 41 testes Node aprovados: endpoint/SSRF, autenticação, autorização, CORS, tamanho/ações, geração do par VAPID, worker secret, resultado do provedor, fila indisponível, payload sem PII, scope/manifesto e clique seguro do Service Worker sem janela aberta. Respostas de provedor são simuladas.
- `tests/push.py`: 6 grupos em PostgreSQL descartável **127.0.0.1:55432**: RLS/grants/contas comuns e propriedade entre administradores, inscrições idempotentes/múltiplos dispositivos, fila por commit, replay/conflito/rollback sem repetição, workers concorrentes, aceito/desconhecido sem reenvio, teste sem reserva/cota, 404/410 via finalização, cancelamento, falha da fila sem falha de reserva, revogação e rollback preservando agendamentos.
- `tests/security.py`: 5 grupos existentes aprovados com a nova cadeia local. O replay de CAPTCHA nessa suíte é teste do objeto histórico preservado, sem reintroduzir CAPTCHA no fluxo.
- Suítes browser pública e Dashboard aprovadas, incluindo reservas/cursos/galeria e calendário/ações com mocks, seis larguras e comparação com a referência administrativa. `tests/push-browser.mjs` aprovado: **Service Worker real** e manifesto no caminho local `/NandaNails/`; permissão/Auth/PushManager/provedor simulados. Ativar/desativar/testar, conta comum, permissão apenas por clique, negada, instalação iPhone, incompatível, logout/deep link e seis larguras aprovados.
- `deno check` aprovado para as duas novas Edge Functions usando Deno 2.5.6 e dependências npm em cache. `tests/push-crypto.mjs` executou imports reais, assinatura VAPID e criptografia/decriptação AES128GCM com chaves efêmeras, **sem permissão de rede**. Isso não exercita HTTPS real ao provedor nem prova comportamento no runtime hospedado.
- Check, build e diff check aprovados. Arquivos públicos e histórico SQL anteriores comparados com a base Git; preservados. Pacote local inclui os novos arquivos PWA e não contém backend/SQL/secrets.

Falhas exploratórias corrigidas antes das rodadas aprovadas: alias SQL da função nova colidia com variável record; tipagem inferida de id nulo no módulo compartilhado; fixture receptora de decriptação precisava do objeto ECDH, não bytes. Nada disso foi aplicado remotamente.

Não foram testados instalação/entrega real em iPhone físico, Foco, aparelho fechado/bloqueado, rede celular, Push Apple/FCM/Mozilla real, Supabase Auth hospedado, Cron/pg_net/Vault remotos ou publicação GitHub. Emulação e o evento sintético de worker não certificam execução em segundo plano pelo iOS. O objetivo operacional só poderá ser confirmado após ativação autorizada e homologação física.

Comandos de reprodução (servidor/navegador isolado conforme `DASHBOARD_CALENDARIO.md`; suítes CDP sequenciais):

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run test:browser
npm.cmd run test:dashboard
npm.cmd run test:push
npm.cmd run test:push:db
python -u tests/security.py
npm.cmd exec --yes --package=deno@2.5.6 -- deno check --node-modules-dir=none supabase/functions/push-admin/index.ts supabase/functions/push-worker/index.ts
npm.cmd exec --yes --package=deno@2.5.6 -- deno run --node-modules-dir=none --allow-env tests/push-crypto.mjs
npm.cmd run build
```

## Recuperação

Base limpa `039362c0d992d7f1a3030be2a5bae7fd09d0e4e4`, já incluindo a separação pública/administrativa, Dashboard e calendário. Tag inédita `backup-nandanails-antes-web-push-20261119`, criada antes de editar. Preservar o trabalho atual antes de recuperar em branch nova, conforme `_CONTROLE_PROJETO/RECUPERACAO.md`.

Recuperar Git não desfaz banco. Se a ativação remota vier a ser feita, a reversão exige autorização separada: primeiro desativar o job (`select cron.unschedule('nn-web-push');`), suspender as funções Push e então revisar/executar `supabase/rollback/202611190005_admin_web_push.sql`. Ele remove somente objetos Push, apagando inscrições/histórico Push e preservando reservas/clientes. Remover o registro do worker no dispositivo exige abrir o painel e cancelar inscrição/remover PWA ou ação manual específica; não há código de recuperação que apague outros service workers/caches da origem. Não apagar/reaplicar migrations antigas.

Referências oficiais: [Web Push no iOS/WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Supabase Cron com Edge Functions e Vault](https://supabase.com/docs/guides/functions/schedule-functions), [biblioteca Web Push](https://github.com/web-push-libs/web-push), [versão fixa 3.6.7 usada no backend](https://github.com/web-push-libs/web-push/tree/v3.6.7). Nenhuma biblioteca Push foi adicionada ao frontend.
