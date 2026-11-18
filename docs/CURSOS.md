# Cursos aprovados — implementação local

Data: 18/11/2026.

## Entrega

A base oficial `index.html` foi mantida. Referência lida integralmente: `REFERENCIAS/nandanails_cursos_botoes_rosa (1).html` (nome real recebido, com sufixo). Nenhuma substituição integral do site.

- Dois cursos na escolha inicial, em contêiner independente de `bookingServices`: completo, 3 dias, R$ 300,00; tradicional, 2 dias, R$ 200,00.
- Seção `#cursos` entre a faixa de introdução e os procedimentos, com cards, textos, conteúdos e pagamentos da prévia.
- Modal com detalhes, fechar, Voltar, clique no fundo, Escape, contenção do foco e devolução ao botão de origem. Fundo inerte e rolagem bloqueada somente durante a abertura.
- Primeira linha do hero com dois botões rosa; segunda linha com Conhecer os trabalhos. Âncora `#cursos` usa a rolagem suave existente e respeita movimento reduzido.
- WhatsApp aberto somente no clique em Tenho interesse, com `encodeURIComponent`, mensagem do curso escolhido, nova aba e `noopener,noreferrer`. Não envia mensagens automaticamente.
- Telefone preservado exatamente como informado: `554491712430`, sem nono dígito adicional. Confirmar com a profissional antes da publicação definitiva; não foi testada a titularidade ou disponibilidade do número.

## Arquivos

- `index.html`: novos componentes e inclusão de script, mantendo seções e recursos anteriores.
- `css/styles.css`: estilos da prévia acrescentados ao final e limitados aos cursos e às ações do hero.
- `js/courses.js`: módulo autônomo sem API, Supabase, serviços em minutos, reservas ou funções globais compartilhadas.
- `tests/browser.mjs`: cobertura de cursos e regressão existente, com rede externa bloqueada e backend simulado.
- Este relatório e documentos de estado, histórico e recuperação.
- `dist/` regenerado localmente, ignorado pelo Git. A referência foi preservada em commit separado antes de editar.

## Diferenças necessárias em relação à prévia

O restante do site oficial, incluindo seus cinco procedimentos, painel, fotos e layout, foi preservado em vez de adotar as versões demonstrativas da referência. Não foram renumeradas seções existentes nem adicionada navegação ao cabeçalho.

Nos componentes novos, setas, estrela, fechar e marcadores usam SVG conforme solicitado. A nota demonstrativa sobre integração Supabase virou orientação para consultar turmas pelo WhatsApp, sem expor detalhes técnicos na interface. O modal recebeu área de fechar de pelo menos 44 px, contenção de foco, fundo inerte, retorno do foco e limite de altura dinâmica. Em telas estreitas, os botões do hero têm espaçamento, fonte e padding menores e altura igual, mantendo a primeira linha lado a lado conforme o pedido; a referência permite quebra de linha por flex-wrap.

Cards mantêm cores, gradientes, fontes, bordas, espaçamentos e conteúdo aprovados. Comparação automatizada em 390 e 1440 px encontrou igualdade das propriedades coletadas em sete seletores: card, título, descrição, lista, preço, pagamento e grid (largura, cor, background, font, padding, radius e gap). Isso não é uma prova de igualdade pixel a pixel. Capturas inspecionadas do curso em mobile; artefatos locais em `.local/courses/`, incluindo as duas versões e `comparison.json`.

## Verificações

- `npm.cmd run check`: sintaxe, referências locais e IDs aprovados.
- `npm.cmd test`: 23 testes Node aprovados, incluindo bytes das imagens e integridade histórica do backend/SQL.
- `node tests/browser.mjs`: cursos nos estados sem configuração e com mocks; títulos, preços, dias, listas, pagamentos, mensagens exatas dos dois cursos, destino WhatsApp sem dígito extra, nova aba, nenhuma reserva ao abrir cursos, fechar/Voltar/fundo/Escape, teclado e foco aprovados.
- Browser: 320, 375, 390, 430, 768 e 1440 px; botões lado a lado e galeria abaixo no hero, modais dentro da tela e sem overflow horizontal aprovados. Verificações geométricas usam movimento reduzido para evitar medir durante transições.
- Regressão Chromium/Edge: cinco serviços com valores/durações, calendário, horários, máscara, falhas de disponibilidade/confirmação, envio duplicado, galeria com dez fotos decodificadas, lightbox, login/logout e abas do painel com backend simulado aprovados. Zero exceções JavaScript registradas pela suíte.
- `npm.cmd run build`: pacote local preparado, sem publicar. `git diff --check`: aprovado.
- Durante a preparação, ajustada a altura desigual dos botões em 390 px. O teste de carregamento de todas as fotos passou a aguardar decodificação após ativar carregamento eager apenas dentro do teste, porque fotos fora da tela usam lazy loading. A inicialização do navegador precisou de permissão do ambiente; as falhas iniciais não contam como aprovação.

Limitações: sem Safari/iPhone físico, fontes externas durante QA, autenticação ou reservas reais, validação do telefone ou envio de WhatsApp. As suítes usam interceptação de configuração, backend simulado e bloqueio de rede externa. Um recarregamento exploratório após encerrar a interceptação pode ter solicitado o catálogo público com a configuração local; não há confirmação desse acesso e nenhuma consulta remota adicional foi feita para investigá-lo. Não se afirma ausência absoluta de consulta remota. Nenhuma ação remota de escrita, migration, deploy ou publicação foi executada. Não houve alteração de Supabase, Auth, Edge Functions, migrations, serviços ou banco, nem envio de mensagens.

## Recuperação

Commit inicial encontrado: `d2e8fc350f967d3caead9cb6fc67f2698b57a609`. A única pendência inicial era a referência não versionada. Preservada no commit local `c8cda5cb709711abc29e337e00623de0c3170bfc`; tag inédita `backup-nandanails-antes-cursos`. A gravação Git precisou da aprovação do ambiente. Nenhuma referência substituída. Implementação deixada local para revisão; sem push.

## Teste local e publicação manual

Na raiz do projeto:

```powershell
npm.cmd start
```

Abrir `http://127.0.0.1:4173/`. Os cursos funcionam sem configuração da agenda. Abrir ambos pela escolha inicial e pelos cards, testar fechar/Voltar/Escape e mensagens. Para verificar a mensagem sem enviar, basta abri-la no WhatsApp. Não realizar reserva real ou login remoto sem autorização. O teste automatizado de navegador exige servidor local na porta 4173 e Edge/Chromium descartável com depuração na 9223; a própria suíte intercepta todas as solicitações.

Após revisar a entrega e confirmar o telefone, comandos para publicação pelo usuário no GitHub (não executados pelo Codex):

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
git diff --check
git add -- index.html css/styles.css js/courses.js tests/browser.mjs docs/CURSOS.md _CONTROLE_PROJETO/ESTADO_ATUAL.md _CONTROLE_PROJETO/HISTORICO_ALTERACOES.md _CONTROLE_PROJETO/RECUPERACAO.md
git commit -m "Incorpora cursos conforme previa aprovada"
git push origin main
```

O remoto existente é `https://github.com/amapa1422/NandaNails.git`. O push usa a publicação GitHub Pages já configurada no repositório, se ativa; nenhum ajuste da hospedagem foi realizado. Não executar Supabase CLI para esta entrega. `dist/` é somente o pacote gerado localmente, não precisa ser adicionado ao Git.
