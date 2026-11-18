# Correção pontual de admin_action — 18/11/2026

Arquivo completo para o SQL Editor: [202611180004_admin_action_alias.sql](../supabase/migrations/202611180004_admin_action_alias.sql).

O arquivo está preparado localmente; não foi executado no Supabase. Base Git limpa: `5cb39200968ce6770667e87a354acd6277fe84d3`. Recuperação local: `backup-nandanails-antes-admin-42702`.

## Causa e escopo

A última definição versionada de `public.admin_action(text,jsonb)` está em `202611170002_horarios_padrao.sql`. Ela declara a variável composta `s public.services` e usa `s` também como alias de tabela na consulta da ação `list`. Com resolução de conflito PL/pgSQL em `error`, `jsonb_agg(s)` gera SQLSTATE `42702`.

A única alteração no corpo completo da função é:

```sql
-- Antes
'services',(select jsonb_agg(s) from public.services s),
-- Depois
'services',(select jsonb_agg(svc) from public.services as svc),
```

Revisados os identificadores declarados `a`, `s`, `start_time`, `end_time`, `rid` e `result`, as referências a campos e os aliases de todas as ações. Não foi encontrada outra colisão nessa função. A variável `s` foi mantida inclusive no `SELECT INTO` de remarcação para preservar exatamente o restante do corpo. Não se mudou `plpgsql.variable_conflict` como solução.

O teste estático compara a função inteira com a definição da `002`, permitindo somente a troca acima. Todas as ações foram exercitadas também no PostgreSQL local.

## Segurança e preservação

O SQL usa transação e `CREATE OR REPLACE FUNCTION` com a assinatura e o argumento padrão existentes. Mantém `SECURITY DEFINER`, `search_path=''`, a guarda `public.is_admin()` antes de qualquer ação, lock, validações, consultas e auditoria. Não contém `ALTER OWNER`, `GRANT` ou `REVOKE`: o proprietário e a ACL existentes são preservados pela substituição e foram comparados antes/depois no teste real.

Uma guarda anterior recusa a execução se a função não existir. Isso impede a criação acidental de uma nova função com permissão padrão de execução para PUBLIC em uma instalação incompatível. No schema versionado, EXECUTE continua concedido a `authenticated`; usuários sem UUID administrativo são recusados com `FORBIDDEN`/`42501`. `anon` não pode executar. Não se concedeu acesso administrativo novo a qualquer papel.

Definir a função não executa seus ramos de atualização/exclusão. A migration não chama `admin_action` nem altera linhas de agendamentos, serviços, preços, expediente, usuários, bloqueios ou auditoria. As migrations `001`, `002`, `003` e os SQLs históricos do SQL Editor permanecem intactos.

## Aplicação manual no Supabase

1. Selecione o projeto `nandanails-agendamento` (`fdxocuhgiypynsjxsqtm`) no Dashboard e abra o SQL Editor.
2. Abra o arquivo incremental vinculado acima e copie **todo o conteúdo**, de comentários/`begin;` até `commit;`.
3. Execute somente esse arquivo, com a conta proprietária ou autorizada a substituir a função existente. Não executar o instalador completo, `001`/`002`/`003` ou `db push`.
4. Aguarde a conclusão sem erros. Não há deploy de Edge Function, mudança de secrets, frontend, domínio ou CORS nesta correção.

O arquivo incremental é a entrega SQL completa; não é necessário montar trechos de outras migrations. O consolidado histórico continua limitado a `001`/`002`/`003`. Em uma instalação futura vazia, aplicar também a `004` depois do instalador histórico; isso foi incluído no teste de equivalência. Não usar o instalador em produção já existente.

Executar manualmente no SQL Editor não registra por si só o arquivo no histórico da CLI; mantenha esse registro operacional para reconciliar o histórico em uma futura manutenção autorizada. Não é motivo para reaplicar migrations antigas.

## Confirmar que o painel voltou a carregar

1. Abra `admin.html`, entre normalmente com a conta da Nanda e clique em Atualizar.
2. Em DevTools → Network, filtre por `admin_action` e confira a chamada POST com `p_action: "list"`.
3. Ela deve retornar HTTP **200**, sem `42702`, com as chaves `appointments`, `services`, `availability` e `blocks`. Arrays de agendamentos/bloqueios podem estar vazios legitimamente.
4. Confirme carregamento da agenda, dos cinco serviços, turnos, bloqueios e indicadores; alterne data/período. Conferir visualmente não exige criar, remarcar ou cancelar uma reserva real.
5. Se houver uma conta de teste já existente sem autorização administrativa, ela deve continuar sem acesso; não criar/autorizar usuários para testar esta correção.

Uma chamada direta a `admin_action` no SQL Editor sem contexto JWT de administradora pode retornar `FORBIDDEN` corretamente. A confirmação funcional acima usa a sessão real do painel; não remova a guarda para fazer um teste passar.

## Testes locais

Somente PostgreSQL em `127.0.0.1:55432`, bancos descartáveis com nomes de teste e shim de Auth. As migrations antigas foram usadas exclusivamente para montar esses bancos novos; não foram reaplicadas em produção nem executadas sobre dados reais.

- `python -u tests/admin_action.py`: reproduz exatamente `42702` antes da correção com administradora autorizada e `plpgsql.variable_conflict=error`; aplica somente a nova migration ao banco local montado; verifica retorno completo de list, dados/IDs/preços intactos, repetição segura, OID/proprietário/ACL/argumento padrão/SECURITY DEFINER/search_path preservados, PUBLIC/anon sem EXECUTE e usuários não autorizados ou sem identidade bloqueados. Exercita também slots, remarcação, status, bloqueio/desbloqueio, serviço, turnos e auditoria com fixtures locais.
- `npm.cmd test`: 23 testes, incluindo comparação integral da função que só admite a troca de alias, além das regressões existentes de frontend, imagens, handler e notificações.
- `tests/installation.py` recebeu ajuste de três linhas: após o instalador histórico, aplica a `004` no banco novo para comparar com a cadeia completa de migrations. Não regenera ou modifica o instalador histórico.

Resultados finais das demais suítes e verificações estão em [_CONTROLE_PROJETO/HISTORICO_ALTERACOES.md](../_CONTROLE_PROJETO/HISTORICO_ALTERACOES.md). Teste local não comprova aplicação remota: a correção só estará ativa no Supabase depois da execução manual. Não houve push, consulta ou mudança remota pelo Codex.
