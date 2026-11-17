# Instruções permanentes — NandaNails

Antes de modificar este projeto, leia:

1. `_CONTROLE_PROJETO/ESTADO_ATUAL.md`
2. `_CONTROLE_PROJETO/REGRAS_CODEX.md`
3. `_CONTROLE_PROJETO/HISTORICO_ALTERACOES.md`

Consulte `_CONTROLE_PROJETO/RECUPERACAO.md` antes de restaurar versões. Preserve o escopo solicitado e atualize os documentos ao concluir. Não publique nem execute `git push` sem autorização.

A primeira operação no projeto Supabase `fdxocuhgiypynsjxsqtm`, inclusive consulta, aguarda autorização expressa. Antes dela, leia `docs/SUPABASE_PRIMEIRA_ENTREGA.md`. Não confunda preparar SQL localmente com autorizar sua execução remota.

Leia também `docs/REVISAO_MIGRATIONS.md` antes de alterar backend ou migrations. As versões `001`/`002` foram revisadas somente porque o usuário confirmou que ainda não as aplicou. Após aplicação em qualquer ambiente, use novas migrations para correções. O frontend nunca recebe `service_role`; cotas e consumo de captcha são RPCs exclusivas do backend. Não reintroduza `p_rate_key` no formulário ou em `agenda_book`.
