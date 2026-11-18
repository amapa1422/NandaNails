# Auditoria de performance — 18/11/2026

Implementação local, sem publicação. Base: `7b3b5e78a7cb53f7b8866d1fa27a614ed8401d2e`, árvore limpa antes das edições. Tag inédita: `backup-nandanails-antes-performance`. O usuário informou que `booking` foi publicada e CORS corrigido; esse estado remoto não foi consultado nesta auditoria.

## Diagnóstico e alterações

| Arquivo | Problema observado no código | Alteração |
|---|---|---|
| `js/api.js` | Cada título de dia criava um formatador Intl; chamadas simultâneas idênticas geravam requisições separadas | Reutilização de formatadores de datas/moeda e Map de consultas públicas apenas enquanto pendentes |
| `js/booking.js` | Cada dia pesquisava novamente a lista de slots; inserções individuais no DOM | Set com datas abertas e DocumentFragment para serviços, calendário e horários |
| `js/booking.js` | Expandir a galeria destruía e recriava as oito fotos já presentes | Acrescenta somente as duas fotos restantes, preservando nós, imagens e listeners existentes |
| `js/animations.js` | Alternância entre escrita de classes/estilos e leitura de bounds; preparação repetida de elementos já observados | Todas as leituras antes das escritas; apenas novos elementos preparados; um agendamento de preparação por frame |
| `js/animations.js` | Scroll solicitava atualização da classe do header em cada evento | Atualiza a classe somente ao cruzar o limiar original de 24 px; listener continua passivo |
| `js/experience.js` | `offsetWidth` forçava layout para reiniciar fade do calendário e transição das fotos | Web Animations com os mesmos keyframes, durações e easing; cancela a anterior; respeita movimento reduzido |
| `js/admin.js` | Construção de Intl em listas; consulta semanal repetida quando já carregada; respostas antigas de slots/indicadores/status | Formatadores reutilizados, indicadores reutilizam a resposta corrente somente se o intervalo for exatamente igual, guardas de versão/sessão |
| `js/api.js`, `js/admin.js` | Dependência de `AbortSignal.timeout` | AbortController com timer de 20 segundos, limpo em `finally`, inclusive em erro de rede/JSON |

Não existe cache persistente de disponibilidade. Ao resolver ou falhar, a consulta sai do Map. Nova consulta ao escolher o dia ou retornar à agenda busca o servidor. Reserva limpa as consultas compartilhadas antes e depois da tentativa. Escritas nunca são agrupadas ou respondidas por cache. Mantidas idempotência, resposta com ID obrigatório, tratamento de conflito e validação definitiva no servidor. Guardas de versão do calendário/horários foram preservadas.

Os listeners de navegação de mês em booking/experience cumprem funções diferentes (consultar e animar). Os listeners de teclado da galeria também cumprem papéis diferentes (fechar e navegar). Não foram removidos como se fossem duplicações. Não foram introduzidos polling, retries, armazenamento sensível ou bibliotecas.

## CSS, fontes e carregamento

CSS auditado e preservado integralmente (40.533 bytes). Há camadas históricas com seletores repetidos: a cascata define o tema dark e as microinterações finais. Não se demonstrou benefício de reescrevê-la frente ao risco de alterar o resultado. Sombras, blur do header, clip-path da foto e indicador de progresso foram mantidos; não há `will-change` indiscriminado. As transições de etapas já usam transform/opacity; o ganho aplicado foi retirar reinícios por leitura forçada de layout no JS. Não há promessa de eliminar todo layout/repaint.

Os scripts ficam no final do body e são pequenos; não há framework ou dependência de build no cliente. A fonte externa permanece bloqueante por stylesheet, com duas famílias e os pesos aprovados: DM Sans 400/500/600/700 e Playfair Display 500/600/700. Já existem preconnect para Google Fonts/gstatic e `display=swap`. Não se alteraram família, pesos ou estratégia sem medição real da fonte. O teste isolado bloqueia fontes externas, portanto não mede seu custo real nem valida a aparência dessas fontes carregadas.

Campos públicos e administrativos já usam 16 px e controles de toque adequados; não se alteraram layout, zoom, espaçamentos ou textos. O Web Animations usado tem fallback sem a microanimação nos navegadores que não oferecem `Element.animate`; Safari real não foi executado.

## Fotografias

Todos os 12 arquivos originais preservados byte a byte; total **1.187.480 bytes**, maior arquivo **207.163 bytes**. Dimensões lidas dos cabeçalhos JPEG, sem decodificar/regravar as fotos:

| Arquivo em assets | Dimensões | Bytes |
|---|---:|---:|
| `2f6e8e69b1a5c70f.jpg` | 1054 × 1000 | 54.073 |
| `3d5fd52cda10621c.jpg` | 862 × 1200 | 106.286 |
| `3dd50a15712d7441.jpg` | 675 × 1200 | 126.682 |
| `479393e9cb86bde5.jpg` | 960 × 1200 | 48.754 |
| `55cf3867307e8da8.jpg` | 959 × 1200 | 125.012 |
| `6302e80d435a8012.jpg` | 740 × 1200 | 122.268 |
| `6c4c9fbb901a262f.jpg` | 1081 × 1200 | 129.686 |
| `848a38ffed5390f8.jpg` | 808 × 1200 | 120.752 |
| `8db060d1d75da3c0.jpg` | 959 × 1200 | 110.879 |
| `a94903f69eac00a4.jpg` | 440 × 440 | 24.400 |
| `da2a94cbeb8739b9.jpg` | 240 × 185 | 11.525 |
| `f729aae6daed3b2f.jpg` | 994 × 1200 | 207.163 |

Galeria cria inicialmente oito imagens lazy/async e expande para dez. A caixa já tem proporção definida no CSS; foto principal e logos também têm caixas dimensionadas. Foto principal já usa fetchpriority high; logo do fechamento já é lazy. A captura inicial carregou monograma e foto principal; em uma amostra posterior o lazy loading também antecipou o logo do fechamento. Não há redução comprovada de bytes iniciais. Fotos em miniaturas móveis são candidatas futuras a srcset/WebP, mas não houve recompressão sem comparação de qualidade/enquadramento; não foram geradas fotos por IA.

## Medições reais e seus limites

CDP no Edge headless local, viewport 393 × 852, CPU 4×, cache HTTP desabilitado, nova aba por amostra, localhost, fontes/rede externa bloqueadas e backend simulado. Ambos os lados servem os cinco scripts auditados pela mesma interceptação, com fontes da tag para o antes e arquivos atuais para o depois. Catálogo sintético preserva os cinco serviços locais. Três pares alternados na rodada final. Isto não representa Safari, rede móvel ou dados de campo.

| Medida | Antes | Depois |
|---|---:|---:|
| Consultas públicas simultâneas idênticas (4 consumidores) | 4 requisições | 1 requisição |
| Consultas list no painel ao abrir semana corrente (regressão mock) | Código anterior fazia 2 | 1 observada |
| LCP inicial: três amostras (ms) | 676 / 788 / 752 | 608 / 892 / 1180 |
| Mediana de LCP (ms) | 752 | 892 |
| CLS inicial (todas as amostras) | 0,01637 | 0,01637 |
| Mediana de ScriptDuration no cenário de interação (ms) | 51,71 | 68,58 |
| Mediana de LayoutDuration no cenário (ms) | 133,80 | 159,59 |
| Mediana de TaskDuration no cenário (ms) | 599,24 | 598,01 |

Não se comprovou melhora geral de carregamento ou tempo total de interação. LCP, script e layout tiveram medianas piores nessa rodada; o tempo total ficou praticamente igual. A variação é grande, e esses resultados não permitem prometer melhora perceptível global ou atribuir uma regressão a um trecho específico. TaskDuration não é latência do clique nem INP. INP, FPS, consumo real de memória e Lighthouse não foram medidos. As metas LCP 2,5 s / INP 200 ms / CLS 0,1 não são declaradas como atingidas em produção.

Microbenchmark isolado de formatação: 310 chamadas a `NN.displayDate`, cinco rodadas em cada implementação no mesmo Node, sem rede. Antes: 76,78 / 33,51 / 54,19 / 41,60 / 39,00 ms; depois: 3,10 / 1,62 / 1,39 / 1,38 / 1,39 ms. Medianas **41,60 → 1,39 ms**. Isso comprova o ganho desse trabalho repetido, não uma aceleração equivalente da página ou do iPhone.

Capturas iniciais antes/depois dos três pares são byte a byte idênticas: PNG 393 × 852, SHA-256 começando por `61a9ac2e941313ff`. A equivalência vale para essa área inicial, com fontes externas bloqueadas. Não substitui revisão de todas as telas em Safari físico.

Resultados brutos e capturas locais: `.local/performance/before-{a,b,c}.json/.png`, `after-{a,b,c}.json/.png`, `formatters.json`, `assets.json`. São artefatos ignorados pelo Git e não entram no pacote público. As primeiras rodadas exploratórias foram substituídas pela rodada final comparável. A primeira tentativa de baseline pelo Node falhou com `spawnSync git EPERM`; exportar os arquivos com PowerShell resolveu sem alterar o checkout. O teste antigo de navegador também precisou isolar config local; agora intercepta sempre config e bloqueia rede externa.

## Validação final

- `npm.cmd test`: **22 testes aprovados**, incluindo cinco novos testes do frontend para agrupamento de consultas, renovação após resposta, recuperação de erro, invalidação em reserva, timeout sem AbortSignal.timeout e formatação; testes existentes de integridade de imagens, handler e notificações continuam aprovados.
- `node tests/browser.mjs`: aprovado com mocks; cinco serviços/preços/durações, seis larguras (320/375/393/430/768/1440), calendário/domingo, horários 15h/16h, navegação entre etapas, falha de consulta e recuperação, máscara, envio duplo, recusa de respostas sem ID, galeria com preservação dos nós, teclado, movimento reduzido, login/logout, abas, indicadores, consulta semanal única e resposta antiga de slots ignorada. Sem exceções JS e sem overflow horizontal nas verificações.
- `node tests/performance.mjs before-a` e equivalentes dos três pares: executados; incluem corrida entre meses com dezembro atrasado, assegurando que janeiro permanece selecionado.
- `npm.cmd run check`, `npm.cmd run build`: aprovados; `dist/` atualizado apenas localmente.
- Imagens originais verificadas por SHA-256 no teste existente. HTML, CSS, config, catálogo, máscara, backend e migrations continuam sem diff. Nenhum teste SQL foi repetido nesta etapa: o backend não foi alterado.

Uma falha nova de teste encontrou animação anterior ainda rodando após ativar movimento reduzido; o cancelamento passou a acontecer antes da guarda e a repetição final passou. O teste não equivale a um iPhone SE/13/15/16, Safari iOS, Chrome Android físico, Auth ou Supabase reais. Não foram criadas reservas reais nem feitas operações remotas no Supabase.

## Reproduzir diagnóstico local

Inicie o servidor com `npm.cmd start`. Inicie um Edge/Chromium descartável, oculto/headless, com porta CDP 9223 e perfil dentro de `.local/`. Bloqueie resolução externa se possível. Os testes bloqueiam solicitações externas e substituem config, independentemente das credenciais locais. Nunca exponha a porta CDP na rede.

Antes da comparação, exporte somente os scripts públicos da tag, sem restaurar o checkout:

```powershell
New-Item -ItemType Directory -Force .local/performance/baseline | Out-Null
foreach ($scriptName in @('api','booking','animations','experience','admin')) {
  $baselineText = git show "backup-nandanails-antes-performance:js/$scriptName.js"
  [System.IO.File]::WriteAllText((Join-Path $PWD ".local/performance/baseline/$scriptName.js"), ($baselineText -join "`n"), [System.Text.UTF8Encoding]::new($false))
}
node tests/performance.mjs before-a
node tests/performance.mjs after-a
```

Repita alternadamente com sufixos `b` e `c`. Não execute os testes CDP em paralelo sobre a mesma aba. O benchmark de Intl pode ser reproduzido carregando cada api.js em VM com NN_CONFIG vazio e LUMIERE_DEFAULTS vazio, executando 310 chamadas em cinco rodadas; os valores acima são os medidos nesta sessão, não critérios de aprovação.

## Publicação manual

Esta mudança só precisa atualizar o frontend. Não fazer deploy de Edge Functions, SQL, migrations ou secrets. Não alterar ALLOWED_ORIGINS ou domínios.

Na branch atual `main`, revise primeiro `git diff` e `git status`. Os arquivos de implementação são `js/api.js`, `booking.js`, `animations.js`, `experience.js`, `admin.js`; também entram os três arquivos de teste e a documentação desta entrega. Faça stage apenas dos arquivos revisados, crie um commit local e, quando decidir publicar, execute manualmente `git push origin main`. Confira antes o remoto configurado para `amapa1422/NandaNails`.

Se Pages publica a raiz da branch, o push é suficiente para acionar a configuração existente. Se publica outro diretório/artefato, siga a configuração existente e use o resultado de `npm.cmd run build` em `dist/`. Não mudar essa configuração durante a otimização. Nunca publicar `.local/`, referências, testes, secrets ou dumps. Após publicar, conferir recarga sem scripts antigos, cinco serviços, calendário, consulta de horários, galeria e login. Reserva real exige autorização separada.

Próximos pontos: medição em iPhone físico com Safari e fontes carregadas; Lighthouse/trace no site publicado quando autorizado; variantes responsivas das fotos com comparação visual; investigação do custo de renderização/long tasks com essa rede real. Não remover efeitos aprovados com base apenas no resultado sintético.
