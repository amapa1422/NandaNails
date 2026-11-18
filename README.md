# NandaNails — agenda online

Evolução do HTML original, mantendo logo, fotografias, tema dark, vinho, rosa, dourado, galeria, navegação e animações. Frontend estático para GitHub Pages; PostgreSQL, Supabase Auth e Edge Functions para operações seguras. Nenhuma publicação foi realizada.

Projeto Supabase de destino: `nandanails-agendamento` / `fdxocuhgiypynsjxsqtm`. A URL pública está em `js/config.js`; a Publishable key permanece sob configuração local do usuário. Nenhuma operação remota foi executada pelo Codex nesta entrega.

**Estado atual informado pelo usuário:** migrations `001`/`002`/`003` já executadas e CLI vinculada. **Esta versão não usa CAPTCHA.** Não editar/reaplicar migrations nem executar deploy automaticamente. Siga o [roteiro atual sem CAPTCHA](_CONTROLE_PROJETO/SEM_CAPTCHA.md). Os documentos de primeira entrega/revisão de migrations são históricos.

## Executar localmente

Requer Python 3 e, para verificações, Node 22 ou superior. Não há dependências de build.

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Abra `http://127.0.0.1:4173` e `http://127.0.0.1:4173/admin.html`.
Sem configuração, a galeria e o catálogo original funcionam; a agenda informa que está em configuração e não cria reservas locais. Não use `file://`.

## Configuração do projeto online

1. Use exclusivamente o projeto novo e separado informado pelo usuário: `nandanails-agendamento`, identificador `fdxocuhgiypynsjxsqtm`. Não utilize o projeto Livre Escolha. Nenhum projeto remoto foi acessado ou modificado neste trabalho.
2. Instale a CLI Supabase e autentique-se na sua máquina. Confira manualmente o identificador do novo projeto antes de executar comandos remotos.
3. Para o projeto atual, as migrations já estão aplicadas segundo o usuário: **não reaplicar SQL ou executar `db push` para remover CAPTCHA**. Nenhuma alteração de banco é necessária. Os arquivos de instalação permanecem somente como histórico e referência para outros ambientes vazios.
4. Crie a conta da Nanda pelo painel Supabase Authentication, desabilite cadastro público e insira o UUID autorizado:

```sql
insert into public.admin_users(user_id) values ('UUID_DA_CONTA_DA_NANDA');
```

5. Configure `js/config.js` somente com a URL do projeto e a chave **publishable/anon pública**. A chave `service_role` nunca entra no frontend. Não existe chave de CAPTCHA nesta versão.
6. Configure os secrets necessários do backend a partir de `.env.example` (o arquivo `.env` é ignorado pelo Git). `RATE_LIMIT_SALT` deve ser aleatório e ter pelo menos 32 caracteres; preserve um valor existente adequado. `ALLOWED_ORIGINS` contém origens completas, sem barra final. Não são necessários secrets Turnstile. WhatsApp continua sendo uma configuração independente, pendente de autorização.
7. Para publicar somente a função atualizada, depois de conferir o vínculo da CLI e os secrets necessários, execute manualmente:

```powershell
supabase functions deploy booking --no-verify-jwt
```

Confira que a CLI está vinculada ao projeto correto antes de executar o comando manualmente. O ambiente Supabase mantém `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` exclusivamente no backend. A função `booking` não usa CAPTCHA; exige validações e cotas antes de gravar. O catálogo e a disponibilidade não expõem dados pessoais. `verify_jwt=false` permite clientes sem conta; não remove RLS nem autorização do painel. A sessão administrativa fica em memória e exige novo login ao recarregar. Não publicar `notify` para esta alteração.

## Regras da agenda

- Fuso da profissional: `America/Sao_Paulo`; banco armazena `timestamptz`. A interface administrativa envia datas locais com `-03:00`, adequado ao fuso atual do estúdio; revisar se a legislação de horário de verão mudar.
- Catálogo inicial: 120 min / 9000 centavos, 60 / 7000, 60 / 6000, 90 / 6500, 30 / 1500. Interface converte apenas para exibição.
- Disponibilidade padrão atual: segunda a sexta somente inícios às **15h e 16h**; sábado das **08h às 16h**, com término obrigatório até 16h; domingo fechado. Nos dias úteis, o limite técnico herdado de 18h permite que o serviço de 120 minutos iniciado às 16h termine às 18h, sem liberar novos inícios.
- Sábado mantém a grade existente de 30 minutos a partir da abertura, filtrada pela duração. Antecedência mínima de 30 minutos e horizonte de 90 dias continuam validados no servidor.
- A migration `202611170002_horarios_padrao.sql` é idempotente e preserva reservas. Atualiza apenas os seis turnos que correspondem integralmente ao padrão original e não têm edição administrativa de horários registrada. Qualquer divergência é preservada; o resultado fica em `private.schedule_default_updates` (`applied` e `reason`). Configurações manuais indistinguíveis do seed e sem auditoria não podem ter sua origem comprovada além desse fingerprint; revise o estado real antes da aplicação.
- Nos bancos atualizados do padrão, `private.allowed_weekday_starts` mantém as restrições de início inclusive após salvar turnos pelo painel. A geração dos inícios explícitos não depende da grade da abertura: um turno 15h15–18h permite 16h para 120 minutos. Cada turno ativo em dia restrito deve conter ao menos 15h ou 16h; turnos incompatíveis ou dados incompletos são rejeitados sem apagar os anteriores. Liberar outros inícios exigiria alterar a política com autorização. Configurações personalizadas ignoradas pela migration não recebem essa restrição.
- Vários turnos por dia representam pausas. Nenhum turno representa folga semanal; bloqueios representam folgas específicas ou intervalos extraordinários. Reservas existentes são mantidas se o funcionamento mudar; cabe à administradora remarcar quando necessário.
- Preço, duração, nome do serviço e nome da cliente são copiados para a reserva. Alterar o catálogo não modifica o contrato anterior. Remarcação preserva os valores e a duração da reserva.
- Exclusão GiST de intervalos `[início,fim)` garante que reservas ativas não se sobreponham. Um lock transacional comum serializa reservas, bloqueios e alterações administrativas, incluindo verificações entre tabelas. Horários adjacentes são permitidos.
- A confirmação aparece somente após resposta com ID persistido, verificado no backend e no frontend. Um UUID de requisição permite repetir uma tentativa de rede sem duplicar a reserva. Em caso de timeout, mantenha os mesmos dados e tente de novo; a resposta pode devolver a mesma reserva, respeitando as cotas.
- Antiabuso sem CAPTCHA: a Edge Function conta tentativas em RPC independente antes da reserva. Cotas globais: 300 consultas de catálogo/minuto, 300 de disponibilidade/minuto e 60 tentativas de reserva/hora; até 5 tentativas/telefone/hora usando HMAC calculado no backend com secret de no mínimo 32 caracteres. O banco mantém também 5 reservas/telefone/24h. Falhas e conflitos não desfazem os contadores. JSON obrigatório, limite de 4096 bytes, campos permitidos e validações estritas recusam entradas inválidas. Não usamos cabeçalhos de IP, request ID ou chaves enviadas pela cliente para escolher limites; cotas continuam exclusivas de `service_role`.
- As cotas globais são compartilhadas pelo estúdio: podem causar indisponibilidade temporária sob abuso. Não substituem proteção WAF/gateway anterior à execução da função nem verificam a posse do número de telefone. Não há garantia de bloqueio de toda automação que resolva desafios válidos.
- `clients`, reservas, bloqueios, auditoria e fila possuem RLS; visitantes não têm acesso direto. Usuária autenticada sem autorização não consegue ler dados nem administrar. Escritas ocorrem por funções com grants explícitos e `search_path` vazio.

## WhatsApp oficial

O adaptador usa a Cloud API da Meta, exclusivamente no backend. Para ativar, configure:

- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, versão suportada em `WHATSAPP_GRAPH_VERSION` (ex.: a versão habilitada no aplicativo Meta).
- `WHATSAPP_RECIPIENT`: número da **Nanda**, com código do país, apenas dígitos.
- `WHATSAPP_TEMPLATE`: nome do template aprovado em `pt_BR` com seis parâmetros de corpo, nesta ordem: cliente, serviço, data, horário, duração, valor.
- `WHATSAPP_RECIPIENT_OPT_IN=true` apenas após obter e registrar o consentimento da Nanda para receber esses avisos. Configure a conta Business, o número remetente e o template conforme os requisitos Meta.

Exemplo de corpo a submeter para aprovação: “Novo agendamento — NandaNails. Cliente: {{1}}. Serviço: {{2}}. Data: {{3}}. Horário: {{4}}. Duração: {{5}} minutos. Valor: {{6}}. Acesse o painel para visualizar os detalhes.”

Agende uma chamada POST a `/functions/v1/notify` a cada minuto, por um agendador seguro, com `Authorization: Bearer NOTIFY_WORKER_SECRET`. Armazene esse secret no cofre do agendador, nunca em SQL ou workflow público. Cada chamada processa até um item. O agendamento da cliente e a entrada na fila são gravados na mesma transação; falhas do WhatsApp não desfazem reservas.

`accepted` significa que o provedor retornou um ID; não significa entrega ou leitura. Não há webhook de entrega implementado. Há no máximo três tentativas, com espera crescente, somente para rejeição explícita HTTP 429. Timeout, resposta ambígua ou worker interrompido passam a `unknown`; confira no provedor antes de reenfileirar manualmente para evitar duplicação. Reservas canceladas antes do processamento são ignoradas. Sem credenciais, os itens aguardam configuração. Não há envio para clientes. Nenhuma mensagem real foi enviada neste trabalho.

## Publicar no GitHub Pages, quando autorizado

Execute `npm.cmd run check`, `npm.cmd test` e os testes locais de banco. Copie apenas `index.html`, `admin.html`, `privacidade.html`, `css/`, `js/` e `assets/` para a pasta a publicar. A pasta `reference/` é uma cópia para auditoria e não precisa ir para o site. Nunca publique `.env`, `.local/`, dumps ou dados de teste. Os caminhos são relativos e funcionam em subdiretórios do GitHub Pages. Configure HTTPS e as origens de CORS. Publique o frontend atualizado separadamente da função quando autorizado; recarregue scripts antigos. Nenhum `git push` ou deploy foi realizado automaticamente.

Antes de habilitar agendamentos reais, execute uma reserva controlada no projeto novo, confira a mesma reserva em outro dispositivo, teste um login não autorizado e verifique o telefone real do estúdio e o canal de contato da página de privacidade. Confirme também a política de retenção com a responsável.

## Testes e manutenção

```powershell
npm.cmd run check
npm.cmd test
python tests/database.py
python tests/schedule.py
python tests/installation.py
python tests/security.py
node tests/browser.mjs
```

`tests/database.py` recria **somente** `nandanails_test` em `127.0.0.1:55432`, com PostgreSQL real, e usa um shim local de `auth.uid()`; não testa o serviço remoto de Supabase Auth. Requer os papéis locais `anon`, `authenticated` e `service_role`. O cluster descartável foi criado em `.local/pgdata`, sem credenciais de produção. Para reproduzir do zero no Windows:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\initdb.exe' -D .local/pgdata -U postgres -A trust --encoding=UTF8 --locale=C
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D .local/pgdata -l .local/postgres.log -o '-p 55432 -h 127.0.0.1 -c autovacuum=off' start
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h 127.0.0.1 -p 55432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f tests/bootstrap.sql
python tests/database.py
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D .local/pgdata -m fast stop
```

O shim usa banco descartável, escuta apenas em loopback e não é configuração de produção. Defina `NN_PSQL` se o executável estiver em outro caminho. O teste de navegador usa um Edge/Chromium descartável aberto com `--headless=new --remote-debugging-port=9223 --user-data-dir=CAMINHO_TEMPORARIO`, além do servidor local na porta 4173. Requests de backend são simulados somente no teste; os arquivos de produção nunca recebem esses mocks. Não reutilize um perfil pessoal.

Veja [relatório por fases e limitações](docs/ENTREGA.md). Fontes técnicas: [funções e grants Supabase](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [WhatsApp oficial](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/).

## Backup e recuperação

Ative backups automáticos do projeto e PITR quando disponível no plano. Antes de migrations futuras, faça backup do banco e mantenha o código versionado; nunca reverta SQL apagando reservas. Faça exportações criptografadas com retenção definida e acesso restrito, fora do repositório. Teste restauração em projeto separado, verificando clientes, reservas, usuários autorizados e contagem de registros. Secrets e configurações de Auth/funções devem ser reconstruídos pelo cofre e pelo procedimento de implantação; um dump do banco não os substitui. Após restaurar, mantenha o worker WhatsApp desativado até revisar a fila para evitar reenvios. Programe limpeza das chaves expiradas de `private.rate_limits` e aplique a política de retenção dos dados pessoais em rotina administrativa auditada.


Dashboard e calendário administrativos aprovados: [implementação, testes e publicação manual](docs/DASHBOARD_CALENDARIO.md).
