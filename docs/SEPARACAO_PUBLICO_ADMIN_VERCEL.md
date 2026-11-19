# Separação pública e administrativa — 19/11/2026

## Alteração e preservação

Removido somente o elemento `Área da Nanda` do rodapé de `index.html`. Não havia outros links administrativos nas páginas públicas ativas ou nos scripts públicos carregados por elas. O rodapé mantém marca e textos, usando o flex/grid já existente, sem placeholder ou alteração de CSS. Classes CSS históricas com nome `admin` não são links nem mecanismos de autorização e foram preservadas para evitar alterações visuais.

`admin.html` continua acessível diretamente em `/admin.html`. HTML/CSS/JS do painel, Dashboard, calendário, menu, gráficos, WhatsApp, serviços, funcionamento, bloqueios, login e logout não foram alterados. Cursos, preços, horários, fotografias, agendamento e configuração Supabase também não mudaram. Referências históricas fora do pacote público foram preservadas. `scripts/package.mjs` publica somente as três páginas, CSS, JS e assets em `dist/`.

## Segurança verificada no código

- A página administrativa contém a estrutura da interface e o formulário de login; os dados das clientes não estão embutidos no HTML. `workspace` inicia oculto. Abrir sua URL não inicia consulta administrativa.
- `js/admin.js` autentica por senha no Supabase Auth, mantém tokens em memória, renova a sessão e limpa caches/DOM no logout. Cada RPC usa o Bearer da sessão; respostas 401 acionam logout. Recarregar exige novo login.
- Antes de carregar dados, o navegador chama `public.is_admin()`. Uma conta comum é recusada. Essa checagem visual complementa a proteção do banco.
- `public.is_admin()` verifica `auth.uid()` em `public.admin_users`. As tabelas têm RLS com leitura condicionada a essa função; privilégios de escrita direta são revogados. A função `admin_action`, inclusive na incremental 004 existente, verifica `is_admin()` e recusa com SQLSTATE 42501 antes de qualquer ação. Não basta contornar o JavaScript.
- O endpoint público aceita apenas catálogo, disponibilidade e reserva, sem listar clientes ou permitir ações administrativas. Credenciais privilegiadas pertencem somente ao backend. Nenhuma credencial foi adicionada ou modificada nesta entrega.

Revisão e testes locais não certificam o estado remoto: nenhuma consulta ao projeto Supabase foi feita. A aplicação remota da migration 004 existente continua não verificada; eventual SQLSTATE 42702 deve seguir `CORRECAO_ADMIN_42702.md`, em etapa autorizada separada. Não aplicar SQL para remover um link.

## Preparação para Vercel, sem publicação

Não foi encontrado impedimento estrutural no frontend estático. Não é necessário novo backend, função Vercel, roteador SPA ou rewrite para servir `index.html` e `admin.html`. Os recursos usam caminhos relativos; o favicon e seu manifest já estão em `assets/icons/n-v1/`. Galeria e scripts acompanham o pacote. Manter `/admin.html` e links `.html`, sem ativar transformações de URL sem revisar os caminhos.

Configuração futura no projeto Vercel, apenas após autorização para publicar:

| Campo | Valor |
|---|---|
| Framework Preset | Other |
| Root Directory | Diretório deste projeto, contendo `package.json` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | Sem dependências a instalar; pode usar override vazio |

Publicar apenas `dist/`, nunca a raiz integral com `.local/`, referências, documentos, SQL ou testes. O build não lê automaticamente variáveis da Vercel para `js/config.js`: conferir nesse arquivo a URL e a chave pública já usadas pelo projeto. Não configurar Secret key ou `service_role` no frontend. A configuração existente foi preservada, sem exibir seu valor neste relatório.

Antes do teste real no novo domínio:

1. Definir a origem HTTPS definitiva e variantes efetivamente usadas (por exemplo, domínio próprio e `www`, se ambos servirem a página). Sem domínio definitivo não é possível verificar a origem real.
2. Em uma etapa remota expressamente autorizada, incluir as origens exatas em `ALLOWED_ORIGINS`, separadas por vírgula, sem caminho nem barra final, preservando as origens ainda necessárias. Não foi alterado esse secret. O handler existente verifica igualdade exata: uma origem nova ausente será recusada com 403. Cabeçalhos na Vercel não substituem o CORS emitido pelo Supabase. Preflight deve permitir POST/OPTIONS e authorization/apikey/content-type; a resposta varia por Origin e não é armazenada em cache.
3. Não liberar todos os previews por wildcard: o código atual exige origens exatas. Se necessário, autorizar um preview específico para homologação, sem incluir cookies, tokens ou credenciais reais nos testes automatizados.
4. Revisar manualmente Auth > URL Configuration no Supabase: Site URL de produção e Redirect URLs exatas para os fluxos de email/OAuth realmente utilizados. O login atual usa senha e refresh via REST e não utiliza `redirectTo` nem callback; cadastrar uma URL não implementa recuperação de senha ou OAuth. Não há URL de hospedagem antiga fixa nos scripts para esse login. Essas configurações não foram consultadas nem alteradas.
5. Após autorização, testar pelo domínio definitivo: catálogo/agenda/reserva controlada, login real da Nanda, conta comum, painel/calendários e logout. A eventual reserva de teste precisa ser combinada para não interferir na agenda.

Esta separação exige somente futura atualização do frontend. Não exige deploy de Edge Functions nem migration. A configuração CORS e o estado remoto continuam dependências da futura publicação; nada foi publicado agora.

Referências oficiais consultadas: [build/output na Vercel](https://vercel.com/docs/builds/configure-a-build), [URLs de redirecionamento Supabase](https://supabase.com/docs/guides/auth/redirect-urls), [CORS em Edge Functions](https://supabase.com/docs/guides/functions/cors).

## Validações desta entrega

`npm.cmd run check`, 23 testes Node, `node tests/browser.mjs`, `node tests/admin-dashboard.mjs`, build e diff check aprovados. Navegador com rede externa bloqueada e backend simulado: acesso direto ao login sem leitura administrativa, conta comum recusada, login autorizado/logout, Dashboard, Dia/Semana/Mês, ações existentes, cursos, galeria e agendamento. Rodapé com dois elementos alinhados e sem links administrativos em 320/375/390/430/768/1440 px. Comparação com a base Git, normalizando finais de linha, confirma que o único conteúdo removido é o link. CSS e todos os arquivos funcionais permaneceram sem diff; pacote local conferido com fontes.

`python -u tests/admin_action.py` e `python -u tests/security.py` aprovados: cinco grupos cada, usando PostgreSQL descartável em 127.0.0.1:55432, nunca Supabase. Confirmados RLS/leitura restrita, ausência de privilégios administrativos para visitantes/contas comuns, guarda de RPC, preservação de dados/ACL e ações administrativas locais. O teste de replay na suíte de segurança refere-se ao objeto histórico preservado, sem reintroduzir CAPTCHA.

A primeira rodada Dashboard encontrou uma fixture concluída com horário futuro às 16h. Corrigido somente o horário fictício para meia-noite; rodada completa aprovada pela manhã sem mudar a regra real de conclusão. Não há teste real de login da Nanda, reserva remota, domínio Vercel, dispositivos físicos ou garantia pixel a pixel. Nenhuma requisição ao projeto remoto foi feita.

## Ponto de recuperação

Base limpa: `6937fea4864847beac583b44af32749162697078`, já contendo o Dashboard e calendário. Tag local inédita `backup-nandanails-antes-separacao-publico-admin-20261119`, criada antes da edição; nenhuma pendência inicial para preservar. Para recuperar, preservar primeiro o trabalho atual e criar uma branch inédita a partir dessa tag, conforme `_CONTROLE_PROJETO/RECUPERACAO.md`. Não restaurar o banco nem reaplicar migrations. Nenhum push ou deploy realizado.
