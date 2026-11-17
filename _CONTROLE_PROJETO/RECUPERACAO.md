# Recuperação segura com Git

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
