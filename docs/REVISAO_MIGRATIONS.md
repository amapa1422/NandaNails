# Revisão final das migrations — 17/11/2026

Projeto de destino: **nandanails-agendamento**, identificador **fdxocuhgiypynsjxsqtm**. Nenhuma chamada, consulta, migration ou alteração de usuário foi feita nesse projeto. A revisão e todos os testes desta entrega são locais. Sem publicação ou `git push`.

O usuário confirmou que as migrations ainda não foram aplicadas e pediu correções nos arquivos. Por isso, revisamos `001`/`002` diretamente antes da primeira implantação. **Se algum ambiente já tiver aplicado uma versão anterior, não reaplique esses arquivos:** será necessário gerar migrations compensatórias a partir da versão efetivamente instalada.

## 1. Limites e automação

O antigo `p_rate_key` foi **removido** da assinatura de `agenda_book`. A cliente não pode selecionar um identificador de cota. O endpoint rejeita campos inesperados como `p_rate_key`, `rateKey`, `p_subject` ou `ip`, e ignora `X-Forwarded-For`/`CF-Connecting-IP` para fins de limite. Não depende de uma suposição não verificada sobre qual proxy sobrescreve esses cabeçalhos.

A Edge Function chama `agenda_rate_limit` em uma requisição RPC independente **antes** do captcha/reserva. O resultado é booleano; uma rejeição não levanta uma exceção que desfaça a contagem. A atualização do contador usa `INSERT ... ON CONFLICT ... UPDATE`, com limite e expiração decididos pelo servidor, de forma atômica. Falha de captcha, conflito e erro de gravação não revertem contadores já confirmados.

| Operação | Cota |
|---|---|
| Catálogo | 300 tentativas/minuto, compartilhadas pelo estúdio |
| Disponibilidade | 300 tentativas/minuto, compartilhadas pelo estúdio |
| Reserva, antes do captcha | 60 tentativas/hora, compartilhadas pelo estúdio |
| Reserva, após captcha válido | 5 tentativas/telefone/hora |
| Reservas efetivamente criadas | Continua o limite de 5 por telefone/24 horas |

A cota por telefone usa HMAC-SHA256 calculado exclusivamente no backend com o telefone normalizado e `RATE_LIMIT_SALT` aleatório de **pelo menos 32 caracteres**. Não armazena o telefone no contador. O formulário ainda coleta o telefone necessário ao atendimento. Alterar o telefone pode alterar a cota individual, mas não contorna a cota global, que independe de corpo, IP, UUID ou cabeçalho escolhido pela cliente.

Turnstile continua obrigatório para reservar. O backend exige sucesso do Siteverify, hostname permitido, ação **`booking`** e timestamp recente (até cinco minutos, com tolerância limitada para diferença de relógio). Depois da validação do provedor, `agenda_consume_challenge` grava atomicamente o SHA-256 do token na tabela privada `used_challenges`. Somente uma requisição pode consumi-lo, inclusive em corrida concorrente; o token bruto não é armazenado. O registro expira e é limpo pelo próprio serviço. Em nova tentativa legítima, o widget fornece novo token e o UUID da reserva mantém a idempotência.

Erros na proteção retornam falha e impedem a reserva. Campos e datas são validados, corpo é limitado a 4096 bytes durante a leitura e origens inesperadas são recusadas. CORS não é tratado como autenticação de scripts externos. Os limites internos não impedem o custo inicial de invocar uma função nem todo ataque distribuído. As cotas globais podem causar indisponibilidade compartilhada quando esgotadas; proteção WAF/gateway anterior à função continua sendo uma camada operacional a configurar conforme necessidade. Captcha também não comprova posse do telefone.

Referência primária: [validação Turnstile no servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). A proteção local contra replay não depende apenas do tempo de convergência do provedor.

## 2. Caminho seguro das requisições

O frontend mantém o acesso a `POST /functions/v1/booking`, ações `catalog`, `availability` e `book`, com a Publishable key pública no cabeçalho `apikey`. Ele não chama diretamente as RPCs privilegiadas. A Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` **somente no ambiente do servidor**, para executar operações explícitas e retornar dados mínimos.

`agenda_catalog`, `agenda_availability`, `agenda_book`, `agenda_rate_limit`, `agenda_consume_challenge` e as funções de notificações não são executáveis por `anon` ou `authenticated`. Administração permanece em `admin_action`, com JWT e UID autorizado verificados pelo PostgreSQL em toda chamada. `is_admin()` usa a tabela protegida `admin_users`, não metadados editáveis do usuário.

`supabase/config.toml` mantém `verify_jwt=false` para o endpoint público; visitantes não precisam de conta. Essa opção não libera tabelas ou funções PostgreSQL. Não é correto enviar a chave `service_role` ao navegador para contornar privilégios. O handler aplica validação e proteção antes de executar a função privilegiada. `notify` segue sem ativação nesta etapa e exige secret próprio.

O handler foi isolado em `_shared/booking-handler.mjs` para permitir execução local dos mesmos caminhos de código com dependências simuladas. A entrada Deno `booking/index.ts` injeta ambiente e cliente Supabase. O frontend só recebeu a ação lógica `booking` no widget; nenhum elemento visual foi alterado.

## 3. Horários e painel

A sequência **001 → 002 → 003** em banco novo termina com:

- Segunda a sexta: inícios às **15h e 16h**. Encerramento técnico herdado às **18h**, compatível com o serviço de 120 minutos iniciado às 16h.
- Sábado: **08h–16h**, grade de 30 minutos, procedimento terminando até 16h. Últimos inícios: 14h para 120 min, 14h30 para 90 min, 15h para 60 min, 15h30 para 30 min.
- Domingo fechado. Fuso comercial `America/Sao_Paulo`, instante do servidor como referência, antecedência e horizonte existentes mantidos.

Corrigida a inconsistência entre turnos e inícios explícitos: os candidatos 15h/16h são gerados diretamente da regra privada, independentemente da grade iniciada pela abertura. Um turno **15h15–18h permite 16h**, tanto na consulta quanto na remarcação; não permite 15h ou 15h45. O término sempre deve caber inteiro em um turno. Pausas, bloqueios e reservas continuam sendo respeitados.

Ao salvar expediente pelo painel:

- Cada turno ativo em um dia restrito precisa conter pelo menos um dos inícios permitidos; 08h–12h em dia útil restrito é recusado com mensagem clara, preservando os turnos anteriores.
- Dados `hours` ausentes, nulos ou de tipo inválido são recusados antes de substituir a tabela.
- `hours: []` significa fechamento intencional. Dias sem turno ativo ficam indisponíveis; a política privada de inícios permanece para uma futura reabertura.
- Turnos sobrepostos são recusados. Reservas anteriores continuam salvas mesmo se ficarem fora do novo expediente; cabe à Nanda remarcar quando necessário.
- Configurações antigas personalizadas que a migration `002` identificar como não pertencentes ao padrão continuam preservadas, sem receber restrição automática de inícios.

Não foi criado um editor novo para as regras privadas. Alterar os inícios 15h/16h exige mudança autorizada dessa política. O painel atual edita os turnos de trabalho dentro da regra existente; não libera horários adicionais silenciosamente.

## 4. RLS, privilégios e integridade

As oito tabelas públicas têm RLS. Foram reforçadas revogações explícitas para **`PUBLIC`, `anon` e `authenticated`**, incluindo a sequência de auditoria e tabelas privadas. Isso evita manter permissões por herança, sobretudo operações como `TRUNCATE`, que não são protegidas por RLS da mesma maneira que leitura de linhas. Visitantes não podem listar nomes, telefones, reservas, auditoria, notificações ou administradores; usuárias autenticadas não autorizadas também não leem essas linhas nem escrevem diretamente.

Os testes usaram permissões iniciais amplas de tabelas/sequências para `PUBLIC`, dados de teste efetivamente presentes e dois UIDs (autorizado e não autorizado), evitando considerar uma tabela vazia como prova de privacidade. Também verificaram funções privadas, privilégios das RPCs e tentativa de autopromoção.

As funções privilegiadas mantêm `search_path=''` e referências qualificadas. Chaves estrangeiras impedem administradora sem usuário Auth, reserva com cliente inexistente ou serviço inexistente. Valores monetários permanecem em centavos inteiros. Snapshots mantêm preço/duração contratados após edição ou remarcação.

Reservas ativas têm constraint de exclusão GiST sobre intervalos `[início,fim)` e operações de reserva/bloqueio usam o lock transacional comum. Testes com duas conexões concorrentes confirmaram somente uma reserva no intervalo. As notificações são enfileiradas na mesma transação, sem disparos reais. Erros do banco são tratados sem retornar detalhes internos ou sucesso falso ao frontend.

Referência: [segurança e privilégios de funções Supabase](https://supabase.com/docs/guides/database/functions).

## 5. Idempotência

`001` é instalação inicial, executada uma vez. Inclui seed com `ON CONFLICT DO NOTHING`, mas a criação completa do schema não deve ser repetida. `002` e `003` podem ser repetidas sem duplicar registros ou substituir personalizações identificadas. O consolidado recusa tabelas preexistentes antes de alterar o banco.

A `003` foi revisada e não precisou mudar: os cinco IDs, nomes, durações e valores estão corretos e preservados. O seed não reativa nem sobrescreve um serviço personalizado existente. Não há clientes, reservas ou contas fictícias na instalação de produção. Dados de teste ficam somente em bancos descartáveis locais.

## 6. Execução no SQL Editor — ordem solicitada

Esta é uma instrução para aplicação posterior autorizada; não foi executada remotamente nesta entrega.

1. Abra o projeto **nandanails-agendamento**, confirme o identificador **fdxocuhgiypynsjxsqtm** e a URL `https://fdxocuhgiypynsjxsqtm.supabase.co`. Não use Livre Escolha.
2. No **SQL Editor → New query**, após autorização, execute `supabase/sql-editor/000_verificar_estrutura.sql`, somente leitura. Se houver qualquer objeto da agenda, pare e revise as versões realmente instaladas; não apague objetos para poder continuar.
3. Em projeto sem esses objetos, copie **todo** `supabase/migrations/202611170001_agenda.sql` para uma nova query e execute com o papel proprietário (`postgres`). Inclua `begin;` e `commit;`. Aguarde sucesso.
4. Execute todo `supabase/migrations/202611170002_horarios_padrao.sql` em nova query. Aguarde sucesso.
5. Execute todo `supabase/migrations/202611170003_servicos_iniciais.sql` em nova query. Aguarde sucesso.
6. Execute `supabase/sql-editor/002_conferir_instalacao.sql`. Confira os cinco serviços/valores, turnos, regras 15h/16h, `applied=true`, oito tabelas com RLS, data do servidor e todos os indicadores de privilégio indevido como `false`.
7. Se qualquer query falhar, não continue com a próxima e não execute trechos isolados. Confira o erro; se a sessão estiver com transação abortada, use `rollback;` para encerrá-la. Não reaplique `001` quando ela já tiver terminado com sucesso.

Alternativa: o arquivo completo `supabase/sql-editor/001_instalacao_nandanails.sql`, regenerado com os hashes desta revisão, contém as três migrations em uma única transação. Execute **a sequência ou o consolidado**, nunca ambos. O consolidado é útil para atomicidade da instalação inteira. O SQL Editor não sincroniza automaticamente o histórico da CLI; o roteiro da primeira entrega explica a reconciliação autorizada antes de usar `db push`.

**SQL sozinho não ativa o calendário.** Depois de conferir o banco, será preciso implantar a versão atual da função `booking`, preencher Publishable key e chave pública Turnstile, configurar CORS, hostname e secrets (incluindo salt de pelo menos 32 caracteres) e fazer testes reais autorizados. A função antiga não é compatível com a assinatura nova de `agenda_book`. Não implante a função antes de completar as três migrations e não use `tests/bootstrap.sql` no Supabase.

## 7. Testes e limites da conclusão

Resultados executados estão em `_CONTROLE_PROJETO/HISTORICO_ALTERACOES.md`: testes Node do handler com mocks, testes PostgreSQL reais locais de permissões, limites, replay concorrente, schema, seed, horários e reservas concorrentes, além do navegador em seis larguras com backend simulado.

Não foram testados: implantação Deno/SDK no Supabase hospedado, autenticação remota real, secret real, Cloudflare real, carga de rede/DoS, Safari físico, recebimento de WhatsApp ou persistência entre dispositivos pela internet. Nenhuma mensagem foi enviada. A sintaxe TypeScript foi verificada, mas isso não substitui a execução no ambiente real. Os testes locais não autorizam afirmar que a agenda já está online.

Recuperação anterior: `backup-nandanails-antes-revisao-migrations`, commit `c19799aa6dda48e73983ed31728d843b770a88bd`. Nenhum arquivo visual foi alterado; as mudanças em `js/api.js` e `js/admin.js` são exclusivamente comportamento do captcha e mensagens de validação de horários.
