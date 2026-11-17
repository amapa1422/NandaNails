# Instruções permanentes — NandaNails

Antes de modificar este projeto, leia:

1. `_CONTROLE_PROJETO/ESTADO_ATUAL.md`
2. `_CONTROLE_PROJETO/REGRAS_CODEX.md`
3. `_CONTROLE_PROJETO/HISTORICO_ALTERACOES.md`

Consulte `_CONTROLE_PROJETO/RECUPERACAO.md` antes de restaurar versões. Preserve o escopo solicitado e atualize os documentos ao concluir. Não publique nem execute `git push` sem autorização.

Qualquer operação remota pelo Codex no projeto Supabase `fdxocuhgiypynsjxsqtm`, inclusive consulta, exige autorização expressa. O usuário informou que migrations `001`/`002`/`003` já foram aplicadas e a CLI está vinculada: não editar nem reaplicar esse histórico. Não confunda vínculo da CLI com autorização para deploy.

Leia `_CONTROLE_PROJETO/SEM_CAPTCHA.md` para a versão atual. Não reintroduzir Turnstile ou outro CAPTCHA sem nova solicitação. `docs/REVISAO_MIGRATIONS.md` documenta a revisão histórica anterior; após aplicação, usar novas migrations se indispensável. O frontend nunca recebe `service_role`; cotas são verificadas no backend. Os objetos antigos de consumo de captcha ficam intactos, sem uso no fluxo atual. Não reintroduza `p_rate_key` no formulário ou em `agenda_book`.
