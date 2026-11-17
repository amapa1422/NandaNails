# NandaNails — agenda online

Evolução do HTML original, mantendo logo, fotografias, tema dark, vinho, rosa, dourado, galeria, navegação e animações. Frontend estático para GitHub Pages; PostgreSQL, Supabase Auth e Edge Functions para operações seguras. Nenhuma publicação foi realizada.

## Executar localmente

Requer Python 3 e, para verificações, Node 22 ou superior. Não há dependências de build.

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Abra `http://127.0.0.1:4173` e `http://127.0.0.1:4173/admin.html`.
Sem configuração, a galeria e o catálogo original funcionam; a agenda informa que está em configuração e não cria reservas locais. Não use `file://`.

## Configuração do projeto online

1. Crie **um projeto novo e separado**, preferencialmente `nandanails-agendamento`. Não utilize o projeto Livre Escolha. Nenhum projeto remoto foi acessado ou modificado neste trabalho.
2. Instale a CLI Supabase e autentique-se na sua máquina. Confira manualmente o identificador do novo projeto antes de executar comandos remotos.
3. Aplique `supabase/migrations/202611170001_agenda.sql` no novo projeto (SQL Editor ou CLI). A migration deve ser executada uma vez, como proprietária do banco.
4. Crie a conta da Nanda pelo painel Supabase Authentication, desabilite cadastro público e insira o UUID autorizado:

```sql
insert into public.admin_users(user_id) values ('UUID_DA_CONTA_DA_NANDA');
```

5. Configure `js/config.js` com a URL do novo projeto, a chave **publishable/anon pública** e a chave pública do widget Cloudflare Turnstile. Esses três valores são públicos. A chave `service_role` nunca entra no frontend.
6. Crie um widget Turnstile com os domínios permitidos. Configure os secrets do backend copiando `.env.example` para `.env` (ignorado pelo Git). Use valores aleatórios longos e independentes para `RATE_LIMIT_SALT` e `NOTIFY_WORKER_SECRET`. Liste os domínios exatos em `TURNSTILE_HOSTNAMES`, sem protocolo; `ALLOWED_ORIGINS` contém origens completas, sem barra final.
7. Após autorizar a implantação no projeto novo, execute:

```powershell
supabase link --project-ref IDENTIFICADOR_DO_PROJETO_NOVO
supabase secrets set --env-file .env
supabase functions deploy booking
supabase functions deploy notify
```

O ambiente Supabase fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` às funções. A função pública `booking` exige Turnstile para criar reservas. O catálogo e a disponibilidade não expõem dados pessoais. `verify_jwt=false` é intencional: clientes não precisam de conta; `notify` exige seu próprio secret. O painel chama RPCs com o JWT de Supabase Auth e o banco verifica a lista de administradoras em cada operação. A sessão fica somente em memória, renova enquanto a página estiver aberta e exige novo login ao recarregar.

## Regras da agenda

- Fuso da profissional: `America/Sao_Paulo`; banco armazena `timestamptz`. A interface administrativa envia datas locais com `-03:00`, adequado ao fuso atual do estúdio; revisar se a legislação de horário de verão mudar.
- Catálogo inicial: 120 min / 9000 centavos, 60 / 7000, 60 / 6000, 90 / 6500, 30 / 1500. Interface converte apenas para exibição.
- Abertura inicial herdada do original: segunda a sexta, 09–18h; sábado, 09–14h. Confirme estes horários com a Nanda antes de ativar produção.
- Grade a cada 30 minutos a partir da abertura de cada turno, antecedência mínima de 30 minutos e horizonte de 90 dias, validados no servidor.
- Vários turnos por dia representam pausas. Nenhum turno representa folga semanal; bloqueios representam folgas específicas ou intervalos extraordinários. Reservas existentes são mantidas se o funcionamento mudar; cabe à administradora remarcar quando necessário.
- Preço, duração, nome do serviço e nome da cliente são copiados para a reserva. Alterar o catálogo não modifica o contrato anterior. Remarcação preserva os valores e a duração da reserva.
- Exclusão GiST de intervalos `[início,fim)` garante que reservas ativas não se sobreponham. Um lock transacional comum serializa reservas, bloqueios e alterações administrativas, incluindo verificações entre tabelas. Horários adjacentes são permitidos.
- A confirmação aparece somente após resposta com ID persistido. Um UUID de requisição permite repetir uma tentativa de rede sem duplicar a reserva. Em caso de timeout, mantenha os mesmos dados e tente de novo após renovar o captcha; a resposta devolve a mesma reserva.
- Antiabuso: captcha obrigatório com hostname verificado, até 8 reservas por chave de IP/hora e 5 por telefone/dia. A chave de IP é hash com salt; não se armazena IP bruto. Confirme que o proxy da hospedagem sobrescreve `x-forwarded-for` antes de usar esse limite como defesa principal.
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

Execute `npm.cmd run check`, `npm.cmd test` e os testes locais de banco. Copie apenas `index.html`, `admin.html`, `privacidade.html`, `css/`, `js/` e `assets/` para a pasta a publicar. A pasta `reference/` é uma cópia para auditoria e não precisa ir para o site. Nunca publique `.env`, `.local/`, dumps ou dados de teste. Os caminhos são relativos e funcionam em subdiretórios do GitHub Pages. Configure HTTPS, as origens de CORS e os hostnames Turnstile definitivos. Nenhum `git push` ou deploy foi realizado automaticamente.

Antes de habilitar agendamentos reais, execute uma reserva controlada no projeto novo, confira a mesma reserva em outro dispositivo, teste um login não autorizado e verifique o telefone real do estúdio e o canal de contato da página de privacidade. Confirme também a política de retenção com a responsável.

## Testes e manutenção

```powershell
npm.cmd run check
npm.cmd test
python tests/database.py
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
