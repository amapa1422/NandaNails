# Recuperação segura com Git

## Ponto anterior à correção admin_action / 42702

- Tag inédita: `backup-nandanails-antes-admin-42702`.
- Commit: `5cb39200968ce6770667e87a354acd6277fe84d3`, árvore limpa em 18/11/2026; inclui o trabalho de performance já commitado pelo usuário antes desta etapa.
- Consulta: `git show --stat backup-nandanails-antes-admin-42702`.
- Antes de recuperar, preservar alterações locais em commit revisado. Depois, usar branch nova: `git switch -c recuperacao-nandanails-antes-admin-42702 backup-nandanails-antes-admin-42702`, com nome inédito.
- A migration `004` foi preparada e testada apenas localmente, sem execução remota pelo Codex. Recuperar Git não desfaz SQL aplicado manualmente depois; não voltar à função ambígua em produção nem reaplicar `001`/`002`/`003`. Se houver necessidade de compensação futura, criar outra migration revisada e autorizada.
- Guia: [docs/CORRECAO_ADMIN_42702.md](../docs/CORRECAO_ADMIN_42702.md).

## Ponto anterior à otimização de performance

- Tag inédita: `backup-nandanails-antes-performance`.
- Commit: `7b3b5e78a7cb53f7b8866d1fa27a614ed8401d2e`.
- Criada em 18/11/2026 após conferir árvore limpa, antes de editar código. Nenhuma referência foi substituída.
- Consulta: `git show --stat backup-nandanails-antes-performance`.
- As alterações de performance ficam locais para revisão. Antes de recuperar, preservar os arquivos pendentes em commit local com escopo revisado, sem secrets, conforme o procedimento abaixo. Depois: `git switch -c recuperacao-nandanails-antes-performance backup-nandanails-antes-performance`, usando nome novo se necessário.
- A otimização muda somente frontend/testes/documentação; recuperar não exige SQL ou deploy de Edge Function. Não restaurar banco, reaplicar migrations ou mudar CORS. Não houve publicação/push pelo Codex.
- Relatório: [docs/PERFORMANCE.md](../docs/PERFORMANCE.md). Artefatos de diagnóstico em `.local/performance/` não são backups de código; o ponto de recuperação é a tag Git.

## Ponto anterior à versão sem CAPTCHA

- Tag: `backup-nandanails-antes-sem-captcha`.
- Commit: `3cb92400de026920e84973c5542af1c13a022813`.
- Criada após conferir a árvore limpa, sem sobrescrever tags ou alterações locais.
- Consulta: `git show --stat backup-nandanails-antes-sem-captcha`.
- Após preservar trabalho pendente, recuperar em branch nova: `git switch -c recuperacao-nandanails-com-captcha backup-nandanails-antes-sem-captcha` (escolher nome novo se já existir).
- A recuperação conjunta de frontend/backend anterior voltaria a exigir configuração do Turnstile. Não publicar essa reversão sem nova autorização. As migrations `001`/`002`/`003` já foram aplicadas segundo o usuário; não reaplicar nem alterar o histórico. Esta remoção de CAPTCHA não mudou banco, RLS, grants ou constraints, e não precisa de rollback SQL.

## Ponto anterior à revisão final das migrations

- Tag: `backup-nandanails-antes-revisao-migrations`.
- Commit: `c19799aa6dda48e73983ed31728d843b770a88bd`.
- Árvore conferida limpa antes das mudanças; tag inédita, sem sobrescrever referências.
- Consulta: `git show --stat backup-nandanails-antes-revisao-migrations`.
- Recuperação, após preservar trabalho pendente: `git switch -c recuperacao-nandanails-pre-revisao backup-nandanails-antes-revisao-migrations` (escolha nome novo se já existir).
- A revisão atual alterou assinatura de `agenda_book` e handler: recupere uma versão coerente de backend, SQL e lógica do captcha. Não misture a Edge Function antiga com as migrations revisadas. Nada foi aplicado remotamente. Se algum SQL for aplicado no futuro, retornar o Git não desfaz o banco; criar migration compensatória autorizada em vez de reaplicar schema antigo.

## Ponto anterior à preparação Supabase

- Tag: `backup-nandanails-antes-supabase-real`.
- Commit: `a6360e1810a0c715d482bcf93c86706b285401d2`.
- Criada em 17/11/2026, após conferir árvore limpa; nenhuma alteração local foi apagada e nenhuma tag anterior foi substituída.
- Para consultar: `git show --stat backup-nandanails-antes-supabase-real`.
- Para recuperar após preservar trabalho pendente: `git switch -c recuperacao-nandanails-antes-supabase backup-nandanails-antes-supabase-real` (use nome novo se a branch existir).
- Nesta entrega não houve operação remota; recuperar o código não requer desfazer banco remoto. Se SQL for aplicado no futuro, a recuperação do Git não desfaz a migration: exige revisão específica, autorização e preservação dos dados.

## Ponto anterior à alteração de horários

- Tag: `backup-nandanails-antes-horarios`.
- Commit: `4d81ead2b8572d4de023f332986ad847ad4199d2`.
- Data: 17/11/2026.
- Escopo: todos os 44 arquivos existentes do projeto, incluindo imagens originais, testes e documentos. `.local/` e `dist/` são artefatos ignorados e não fazem parte da versão.
- A pasta não tinha um repositório próprio. Foi inicializado um Git local exclusivo; o repositório da pasta pessoal não recebeu commits ou alterações.

Antes de mudar o código, todos os arquivos existentes foram preservados no commit acima. Nenhuma alteração anterior foi descartada. Esta pasta não contém cópias adicionais de imagens.

## Consultar sem modificar arquivos

A versão nova validada localmente está identificada pela tag `nandanails-horarios-2026-11-17`. Consulte o histórico para o commit da implementação; o commit apontado pela tag também inclui o registro final da documentação.

Execute na raiz NANDA NAILS:

```powershell
git status --short
git show --stat backup-nandanails-antes-horarios
git log --oneline --decorate
git diff backup-nandanails-antes-horarios -- js/catalog.js supabase/migrations
```

## Recuperar em uma nova branch

Primeiro revise `git status`. Havendo alterações não commitadas, preserve apenas os arquivos desejados em um commit local, conferindo que não incluem secrets ou dados reais:

```powershell
git add -- CAMINHO_DOS_ARQUIVOS_REVISADOS
git commit -m "Preserva trabalho antes da recuperacao"
git switch -c recuperacao-nandanails-antes-horarios backup-nandanails-antes-horarios
```

Use um nome novo se a branch já existir. A branch anterior e seus commits continuam disponíveis. Não use `git switch -C` nem force a troca se o Git informar alterações pendentes.

## Restaurar somente um arquivo

Depois de preservar o trabalho pendente:

```powershell
git restore --source=backup-nandanails-antes-horarios -- js/catalog.js
git diff -- js/catalog.js
```

O `restore` substitui o conteúdo local do arquivo indicado, por isso deve ser precedido da preservação do trabalho. Não o execute em lote sem revisar os caminhos.

## Código e banco são recuperações distintas

Trocar uma branch não desfaz uma migration já aplicada. Não reaplique a migration inicial em banco existente nem apague migrations aplicadas para tentar reverter dados. Se a atualização de horários tiver sido aplicada em produção, uma reversão requer migration compensatória, revisão da disponibilidade atual e autorização, preservando reservas. Mantenha os backups e o procedimento de restauração descritos no README. Configurações personalizadas preservadas não devem ser substituídas por padrões históricos.

Não usar `git reset --hard`, `git clean -fd`, exclusões recursivas ou sobrescrita de tags. Não executar `git push` nem publicação durante a recuperação sem autorização.
