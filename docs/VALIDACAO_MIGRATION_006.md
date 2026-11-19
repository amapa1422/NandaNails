# Validação da migration 006 revisada — 19/11/2026

Resultado: aprovada nos testes locais executados. Não foi necessário alterar a migration nem o código da aplicação. Nenhuma operação no Supabase remoto, deploy, publicação, envio real de mensagens ou git push.

Arquivo testado: `supabase/migrations/202611190006_admin_notification_center.sql`.

SHA-256 antes e depois dos testes:

```text
73ba3b064b8e203d1fd6310c27fa337104ad2807863d04a47ba2a6d698b26c17
```

## Falha no gatilho principal

Além da suíte existente, um ensaio local injeta uma exceção SQLSTATE `23514` antes da inclusão em `private.admin_notifications`. Ele executa a suíte completa da Central com esse cenário adicional inserido em memória, sem editar o arquivo de teste versionável.

Resultados verificados:

- A chamada de reserva retorna sucesso com ID, e a reserva permanece no banco.
- O backend emite o warning `ADMIN_NOTIFICATION_RECORD_FAILED SQLSTATE 23514`.
- O evento que falhou não aparece na Central.
- A fila WhatsApp mantém exatamente uma entrada para essa reserva.
- As seis inscrições de teste recebem exatamente seis entregas Push e seis registros sanitizados de estado.
- Repetir o mesmo pedido retorna a mesma reserva, sem duplicar entregas.
- `claim_push` e `finish_push` processam uma entrega dessa reserva como `accepted`; o estado também aparece no histórico auxiliar.
- Uma transação explicitamente revertida não deixa a reserva gravada, mesmo com a falha no gatilho.
- Removida a falha simulada, uma nova reserva volta a gerar seu evento e suas seis entregas Push.
- O evento anteriormente perdido não é reconstruído automaticamente.

Esse último comportamento é uma consequência da correção: a Central deixa de ser uma condição obrigatória para confirmar a reserva. Os warnings exigem investigação e eventual reconciliação autorizada. Não reaplicar a 006 inteira para preencher pendências.

## Regressões executadas

| Comando/suíte | Resultado |
|---|---|
| `python -u .local/validation-006/primary-trigger-regression.py` | Aprovado: suíte SQL completa da Central mais falha do gatilho principal e recuperação |
| `python -u tests/database.py` | Aprovado: reservas, validações, conflitos, concorrência, snapshots, remarcação, cancelamento, bloqueios e fila WhatsApp |
| `python -u tests/schedule.py` | Aprovado: horários, serviços, duração, preservação de reservas e personalizações |
| `python -u tests/admin_action.py` | Aprovado: autorização e operações administrativas |
| `python -u tests/push.py` | Aprovado com a 006 instalada: inscrições, deduplicação, claim concorrente, estados, testes, revogação, falhas e rollback Push |
| `python -u tests/security.py` | Aprovado com a 006 instalada: RLS, grants, cotas, autorização e integridade |
| `npm.cmd run check` | Aprovado: sintaxe, links locais e IDs HTML |
| `npm.cmd test` | 41 testes aprovados, nenhum reprovado |
| `node tests/admin-notifications.mjs` | Aprovado: Central, filtros, leitura, duas páginas simulando dispositivos, paginação, erro/logout, responsividade e referência visual |
| `node tests/admin-dashboard.mjs` | Aprovado: Dashboard, gráficos, agenda Dia/Semana/Mês, ações, responsividade e referência visual |
| `node tests/browser.mjs` | Aprovado: fluxo público e painel com backend simulado |
| `node tests/push-browser.mjs` | Aprovado: PWA/Service Worker local, ativação, teste, desativação e autenticação com mocks |

A suíte SQL da Central percorreu 10.002 eventos sem duplicações/omissões, com paginação limitada, leitura por conta, lote concorrente e corte temporal. Também verificou falha isolada no histórico auxiliar Push, revogação administrativa e rollback exclusivo da Central preservando reservas e os objetos Push.

As suítes `database.py`, `schedule.py` e `admin_action.py` preservam seus cenários históricos próprios. A comprovação conjunta com a cadeia 001–006 vem das suítes Central, Push e segurança, que instalam a migration revisada nos bancos descartáveis.

## Reprodução e evidências

Os testes SQL usam exclusivamente bancos descartáveis em `127.0.0.1:55432`, com identidades fictícias e shim de Auth. Os testes de navegador usam servidor local na porta 4173 e navegador descartável CDP na 9223, bloqueando rede externa e simulando Auth/provedores.

Logs, manifesto de hashes anterior aos testes e ensaio adicional ficam em `.local/validation-006/`, ignorado pelo Git. O resultado SQL final está em `notification-sql-final.log`; os demais logs são identificados pela suíte. As capturas/comparações visuais ficam nas pastas locais já usadas pelos testes.

A primeira rodada do ensaio adicional parou por um erro no próprio teste: tentou selecionar um ID de tabela privada sob `service_role`, sem grant direto. O ensaio foi corrigido para preparar o ID como fixture e usar somente as RPCs autorizadas no papel do worker. A execução completa seguinte passou; não foram ampliados grants nem alterado código da aplicação para permitir o teste.

## Limites e preservação

A verificação por hashes confirmou que nenhum arquivo de código, migration ou configuração foi alterado durante os testes. Somente a documentação foi atualizada ao concluir.

Não houve teste do Supabase hospedado, de entrega real a provedores Push ou de iPhone físico. Os resultados demonstram preservação dos contratos e do comportamento nos ambientes locais testados; não certificam o ambiente de produção. Não houve build, alteração de secrets, Cron/Vault, inscrição real, deploy ou push nesta revalidação.
