# Regras permanentes

1. Ler `ESTADO_ATUAL.md` antes de modificar o projeto.
2. Consultar `HISTORICO_ALTERACOES.md` quando necessário.
3. Preservar funcionalidades existentes.
4. Não modificar arquivos fora do escopo solicitado.
5. Realizar alterações pequenas e verificáveis.
6. Executar os testes disponíveis, registrando o que de fato foi executado e suas limitações. Nunca afirmar aprovação de um teste não executado.
7. Atualizar a documentação ao finalizar.
8. Não publicar automaticamente.
9. Não executar `git push` sem autorização.
10. Não modificar credenciais, banco de dados ou informações reais sem autorização. Testes de banco devem usar somente ambiente local descartável, sem dados reais.

Antes de alterar código, identificar o commit atual e preservar alterações não commitadas em um commit local ou branch própria, com escopo revisado e sem secrets. Criar uma tag de recuperação inédita; nunca substituir tags existentes. Não usar `git reset --hard`, `git clean -fd` ou comandos destrutivos de recuperação.

O controle documenta o estado; o Git recupera o código. Não duplicar imagens nesta pasta.

Migrations aplicadas não devem ser reescritas. A revisão direta de `001`/`002` em 17/11/2026 foi autorizada pelo usuário antes de qualquer aplicação; não generalizar essa exceção para bancos existentes. Mantenha a entrada Edge e os grants da revisão compatíveis, sem aceitar cotas escolhidas pelo cliente ou expor `service_role`.
