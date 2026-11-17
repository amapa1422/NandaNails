# Supabase — primeira entrega para revisão

Data: 17/11/2026. Escopo concluído: auditoria local, preparação do SQL e roteiro de ativação. **Nenhuma conexão, consulta, migration, alteração de usuário ou mensagem foi executada no projeto remoto.** A primeira operação no Supabase aguarda autorização expressa.

Revisão posterior solicitada pelo usuário: consulte `REVISAO_MIGRATIONS.md`. Como os SQLs ainda não foram aplicados, as versões `001`/`002` receberam correções de segurança antes da primeira implantação. Use os arquivos atuais e a Edge Function atualizada.

## Projeto de destino

- Nome informado pelo usuário: `nandanails-agendamento`.
- Identificador: `fdxocuhgiypynsjxsqtm`.
- URL pública: `https://fdxocuhgiypynsjxsqtm.supabase.co`.
- Região informada: East US (Ohio). Fuso comercial: `America/Sao_Paulo`, independente do fuso/região do servidor.
- Publishable key: será preenchida localmente pelo usuário em `js/config.js`. Não solicitada nem incluída nesta entrega. Nenhuma Secret key deve entrar nesse arquivo.

A URL foi colocada na configuração pública local. A disponibilidade online continua desabilitada até completar as dependências e validar a integração real. A saúde e o conteúdo do projeto remoto não foram verificados por nós.

## A — diagnóstico do estado atual

O projeto já contém o fluxo de reserva, calendário, máscara WhatsApp, galeria original, painel administrativo, backend e duas migrations. Não foi recriado. Layout, CSS, imagens, animações, serviços, preços e estrutura de reservas permanecem preservados.

Arquivos inspecionados: páginas públicas e administrativa; todos os módulos JavaScript; configuração pública; migrations `001`/`002`; funções `booking` e `notify` e seus módulos compartilhados; configuração Supabase; testes; scripts; README e documentos de controle.

O erro tem duas condições reais:

1. `js/api.js` calcula `configured` a partir de **URL + Publishable key + chave pública Turnstile**. Antes desta entrega, os três estavam vazios. Agora somente a URL está preenchida. Nenhuma requisição de agenda é iniciada enquanto faltar a configuração completa.
2. `js/booking.js` chama `L.loadCatalog()` ao iniciar. Esse método envia `POST /functions/v1/booking`, corpo `{"action":"catalog"}`, usando a Publishable key no cabeçalho `apikey`. A Edge Function consulta `agenda_catalog()`, e o PostgreSQL devolve `today = (now() at time zone 'America/Sao_Paulo')::date`. **Somente após essa resposta o frontend preenche `window.Lumiere.serverToday`.** A seleção exige `configured` e `serverToday`; essa proteção foi mantida.

Portanto, preencher apenas a URL não ativa a agenda; aplicar SQL também não implanta a Edge Function. Mesmo com SQL e chave pública, faltando a função, CORS ou Turnstile, o estado de erro é esperado. O calendário consulta horários do servidor e a criação só mostra sucesso após receber o ID persistido. Não existe fallback de confirmação local. O sistema não lê nem apaga as chaves antigas de demonstração do `localStorage`.

Supabase utiliza URL e Publishable key no frontend. O Turnstile é uma dependência separada de antiabuso que já existia; sua chave pública não é uma credencial Supabase. O backend usa credenciais privilegiadas somente no ambiente da função, nunca no HTML.

## B — SQL completo e versionamento

O arquivo pronto para copiar integralmente no SQL Editor é:

**[`supabase/sql-editor/001_instalacao_nandanails.sql`](../supabase/sql-editor/001_instalacao_nandanails.sql)**

Ele contém o SQL completo, sem placeholders de código nem dependências de `\i`, em **uma transação**. É a instalação inicial consolidada das migrations:

1. `202611170001_agenda.sql`: estrutura, seed histórico, constraints, índices, RLS, funções e grants.
2. `202611170002_horarios_padrao.sql`: disponibilidade atual e validação de inícios permitidos nas consultas/reservas/remarcações.
3. **Nova** `202611170003_servicos_iniciais.sql`: inserção repetível dos cinco serviços com `ON CONFLICT(id) DO NOTHING`, preservando dados já cadastrados, preços personalizados e serviços inativos.

As migrations `001`/`002` foram revisadas antes da primeira aplicação, com autorização expressa do usuário para corrigir os arquivos locais. A `003` foi validada sem alterar os cinco serviços ou valores. O consolidado é gerado por `node scripts/prepare-supabase.mjs` e inclui os hashes SHA-256 das fontes. Não é uma migration adicional para executar depois delas; é uma **alternativa de instalação inicial pelo SQL Editor**. Escolha o consolidado **ou** a sequência de migrations, nunca ambos no mesmo banco.

A instalação completa é deliberadamente de execução única: se detectar tabelas NandaNails existentes, aborta antes de modificá-las. Não tenta transformar uma estrutura desconhecida em estrutura compatível por meio de `IF NOT EXISTS`. O seed `003` é idempotente e pode ser repetido após revisão; a instalação inteira não deve ser reaplicada. Em banco parcial ou existente, revisar os objetos e executar somente migrations pendentes, com autorização.

### Estrutura mantida

| Conceito solicitado | Tabela existente |
|---|---|
| serviços | `public.services` |
| clientes | `public.clients` |
| agendamentos | `public.appointments` |
| horários de funcionamento | `public.availability` |
| bloqueios | `public.schedule_blocks` |
| administradores | `public.admin_users` |
| histórico | `public.audit_log` |
| notificações | `public.notification_outbox` |

O schema `private` contém limites de abuso, inícios permitidos e controle da atualização padrão. Não o inclua nos schemas expostos pela Data API. Não foram criadas tabelas paralelas em português, evitando duplicar dados ou quebrar o painel existente.

### Regras de reserva e horários

O PostgreSQL verifica serviço ativo, parâmetros, data/fuso, antecedência de 30 minutos, horizonte de 90 dias, expediente, duração, bloqueios e conflitos. Usa preço e duração do banco; se mudarem desde o resumo da cliente, exige nova confirmação. Copia nome do serviço, nome da cliente, preço em centavos e duração para a reserva.

Uma constraint de exclusão GiST impede sobreposição de intervalos ativos `[início,fim)` mesmo sem confiar no navegador. O lock transacional compartilhado pelas operações serializa validações entre reservas e bloqueios. UUID idempotente impede duplicações em repetição de requisição. A entrada na fila de notificações ocorre na mesma transação da reserva.

- Segunda a sexta: somente inícios **15h e 16h**. Limite técnico herdado **18h**, para acomodar o serviço de 120 minutos iniciado às 16h; não libera inícios adicionais.
- Sábado: abertura **08h**, encerramento **16h**, grade a cada 30 minutos filtrada pela duração. Últimos inícios: 14h para 120 min; 14h30 para 90 min; 15h para 60 min; 15h30 para 30 min.
- Domingo: fechado. Reservas e bloqueios retiram horários da consulta pública.

A migration `002` reconhece o padrão original e preserva horários personalizados ou origem incerta. Uma instalação nova termina com os horários solicitados; em instalações existentes é necessário conferir `private.schedule_default_updates` antes de afirmar que o padrão foi aplicado. Nenhuma migration limpa reservas.

### Segurança

- As oito tabelas de `public` têm RLS habilitada. Visitantes não podem ler clientes, telefones ou reservas, nem escrever diretamente.
- Leitura administrativa exige JWT válido de Supabase Auth e UID presente em `admin_users`. A função `is_admin()` lê essa tabela no servidor; não usa metadados editáveis do usuário. Não há autopromoção por API.
- Escritas são feitas por funções com grants explícitos. `admin_action` exige autorização no banco em cada operação. Criar reserva e consultar disponibilidade pelo caminho público usa a Edge Function; as RPCs correspondentes não são concedidas a `anon`.
- Funções `security definer` usam `search_path=''` e nomes qualificados. O uso privilegiado existe para retornar dados mínimos e executar transações; não concede acesso público às tabelas.
- Criação pública de reservas exige Turnstile verificado no backend com hostname, ação `booking` e validade temporal. Limites globais fixos e por telefone (HMAC derivado no servidor) são contados em RPC independente e persistem diante de falhas. Cabeçalhos de IP e chaves escolhidas pela cliente não definem cotas; `p_rate_key` foi removido de `agenda_book`. As duas funções são restritas a `service_role`. Veja limites e riscos residuais na revisão final.
- `verify_jwt=false` na função pública é intencional para permitir visitantes e Publishable keys; não significa acesso administrativo liberado. Auth do painel continua independente, com JWT e autorização no banco. `notify` exige secret próprio e não será ativada agora.
- Não inserir Secret key, `service_role`, senhas ou tokens WhatsApp no frontend ou no SQL desta instalação.

Referências oficiais: [grants e funções Supabase](https://supabase.com/docs/guides/database/functions), [chaves públicas e Edge Functions](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).

## Aplicação pelo SQL Editor — somente após autorização

1. Acesse o painel Supabase e selecione **nandanails-agendamento**, identificador **fdxocuhgiypynsjxsqtm**. Confirme o projeto no painel e em Project Settings/API; o SQL não consegue comprovar sozinho a URL selecionada. Não selecione Livre Escolha.
2. Abra **SQL Editor → New query** e use a função de banco proprietária (`postgres`) no painel. Copie todo `supabase/sql-editor/000_verificar_estrutura.sql`. Ele consulta apenas metadados, sem dados de clientes. Execute somente após autorizar a primeira operação remota.
3. Se as duas consultas retornarem zero objetos da agenda, o projeto é candidato à instalação inicial. Se houver qualquer objeto, **pare e revise**; não execute o consolidado nem remova tabelas para torná-lo aplicável. Mesmo zero resultados não autoriza instalação em projeto diferente.
4. Na mesma instância/projeto, crie uma nova query e copie **todo** `supabase/sql-editor/001_instalacao_nandanails.sql`, incluindo `begin;` e `commit;`. Revise e execute uma única vez. Não selecione apenas um trecho.
5. Se ocorrer erro, não continue executando pedaços nem remova constraints ou RLS. A transação deve ser revertida; confira o estado. Se a sessão ficar com transação abortada, execute `rollback;` para encerrá-la e traga o erro para revisão.
6. Após sucesso, execute `supabase/sql-editor/002_conferir_instalacao.sql`. Esperado: cinco serviços com 9000/7000/6000/6500/1500 centavos; duração 120/60/60/90/30 min; turnos úteis 15–18h, sábado 08–16h e sem domingo; regras úteis `[15h,16h]`; atualização `202611170002` com `applied=true`; oito tabelas com RLS; catálogo com `today` do servidor; todos os indicadores de privilégio indevido retornam `false`.
7. Nenhuma cliente, reserva ou administradora deve ser criada pela instalação. Não use `tests/bootstrap.sql`: é um shim exclusivo dos testes locais, não um script Supabase.

O SQL Editor não atualiza automaticamente o histórico usado pela CLI Supabase. Registre que foram aplicadas as versões `202611170001`, `202611170002` e `202611170003` pelo consolidado. Antes de uma futura utilização de `supabase db push`, faça uma revisão do schema e do histórico. Um eventual `supabase migration repair` deve ser autorizado e só marcar versões **efetivamente aplicadas**; não substitui a execução do SQL. Não há reparo automático nesta entrega. [Documentação oficial de migrations](https://supabase.com/docs/guides/deployment/database-migrations).

## C — próximo passo para ativar o calendário

Depois de autorizar, aplicar e conferir o banco, a próxima etapa será implantar **somente a função `booking`**, configurar as origens CORS, captcha e secrets de antiabuso, e preencher as duas chaves públicas restantes localmente. A função espera as credenciais de backend disponibilizadas no ambiente Supabase; elas nunca devem ser copiadas para `js/config.js`.

Sequência esperada: configuração completa → `booking/catalog` responde → `serverToday` recebe a data do banco → seleção de serviço habilita o calendário → `booking/availability` retorna somente datas/horários → envio com captcha → banco confirma o ID. Não remover a guarda de `configured/serverToday` para contornar implantação incompleta.

SQL aplicado não basta para declarar a agenda ativa. Precisamos testar a função e uma reserva controlada real, após autorização, consultar o mesmo registro em outro dispositivo e verificar conflitos. Não há teste remoto nesta primeira entrega, nem pedido para você enviar a Publishable key pelo chat.

## D — administradora

Login, agenda dia/semana/mês, status, cancelamento, remarcação, bloqueios, folgas e serviços já estão conectados aos endpoints de Auth e às RPCs no código. Não foram reimplementados.

Após autorização específica para gestão de usuários, crie ou selecione a conta da Nanda no painel Authentication. Copie o UUID real dessa conta; então um operador proprietário do banco poderá executar separadamente:

```sql
insert into public.admin_users(user_id)
values ('SUBSTITUA_PELO_UUID_REAL_DA_NANDA'::uuid)
on conflict(user_id) do nothing;
```

Esse trecho é um exemplo documental e não faz parte do SQL de instalação. O placeholder não é executável até ser substituído. A chave estrangeira exige conta existente em `auth.users`; nome, e-mail ou metadados públicos não concedem acesso. Desabilite o cadastro público se ele não for necessário. A associação e a criação de conta não foram executadas.

## E — testes e limites

Consulte o histórico do projeto para os resultados desta execução. `tests/installation.py` usa apenas bancos descartáveis de nomes fixos em `127.0.0.1:55432`. Compara o consolidado com a cadeia de migrations, verifica RLS e grants, testa repetição segura do seed, preservação de personalizações, rejeição da reinstalação e concorrência. `tests/schedule.py` cobre os horários e os testes existentes continuam disponíveis.

O shim local de `auth.uid()` e os papéis PostgreSQL não comprovam o serviço Supabase Auth real. `node --check` não substitui execução Deno. A configuração pública incompleta impede um teste real de ponta a ponta. Testes anteriores de navegador usam mocks; não são evidência de persistência online. Não há certificação de Safari físico ou leitor de tela.

## F — WhatsApp

Fila, adaptador oficial, estados, deduplicação e tentativas limitadas já existem. Os testes usam mocks; sem tokens ou número real. A função `notify` e seu agendador devem permanecer sem ativação nesta etapa. O agendamento pode persistir e aguardar notificação sem afirmar que ela foi enviada. Integração real fica pendente até configurar o provedor e obter autorização própria.

## Arquivos e recuperação

Criados: migration `003`, três SQLs para SQL Editor, gerador local `scripts/prepare-supabase.mjs`, `tests/installation.py`, `tests/installation.test.mjs` e este documento. Atualizados: URL pública em `js/config.js`, README, `AGENTS.md` e documentos de controle. As migrations `001`/`002` e o restante do comportamento de interface foram preservados.

Ponto anterior: tag `backup-nandanails-antes-supabase-real`, commit `a6360e1810a0c715d482bcf93c86706b285401d2`. A árvore estava limpa antes de iniciar. Consulte `_CONTROLE_PROJETO/RECUPERACAO.md`; recuperar arquivos Git não desfaz SQL remoto. Não houve `git push` ou publicação.
