# Auditoria final de performance — 19/11/2026

Otimização exclusivamente local. Branch `main`; base anterior `e05c3a3`. Todas as pendências revisadas do refinamento visual foram preservadas no commit `a0c6a4b451da58cef2f4acafc68a6a74bcbb7a58`, tag inédita `backup-nandanails-antes-performance-final-20261119`. A implementação desta auditoria permanece sem commit. Sem operações remotas, migrations executadas, deploy, publicação, push, reservas ou mensagens reais.

## Resultado e escopo

Somente `js/admin.js` e `js/admin-ui.js` receberam alterações de produção. HTML, CSS, fotos, fontes, ícones, animações, calendário público, contratos RPC, autenticação, Central, PWA/Push e backend foram preservados por comparação Git com a base.

| Arquivo | Trabalho eliminado | Implementação |
|---|---|---|
| `js/admin.js` | Várias filtragens e conversões da mesma data para seis indicadores semanais | Uma passagem, uma conversão por registro, limites semanais e instante de referência calculados uma vez |
| `js/admin-ui.js` | Repetição da busca textual para contar o total após agrupar o calendário | Total calculado com os grupos já filtrados, mantendo os mesmos limites de período |
| `js/admin-ui.js` | Normalização de nome/serviço a cada tecla | Texto normalizado criado somente na primeira busca por registro e reutilizado; recriado ao receber dados e liberado no reset/logout |
| `js/admin-ui.js` | Lista diária percorrida novamente para cada horário | Um Map temporário de horário para registros; ordem, cartões, vazios e lotes de 100 preservados |
| `js/admin-ui.js` | Passagens separadas para status, receita e ranking de serviços | Uma passagem para esses agregados, com mesma ordem e critérios |
| `js/admin-ui.js` | Dois objetos Date para o mesmo timestamp; cálculo de hoje para cada célula | Um Date por registro; hoje calculado uma vez por construção mensal/semanal |

Não foi introduzido cache de respostas, debounce, atraso de digitação, framework, dependência ou armazenamento persistente. A busca continua síncrona. Somente a representação textual de cada evento corrente é guardada na memória da sessão, sob o mesmo ciclo dos dados já autorizados. Atualizar, mudar os dados e logout continuam descartando a representação anterior. Escritas, consultas, polling, deduplicação e invalidação existentes não mudaram.

O diff integral de produção está no artefato local `.local/performance-final/implementation.diff`; também pode ser consultado com `git diff -- js/admin.js js/admin-ui.js`.

Arquivos desta entrega:

- Produção modificada: `js/admin.js`, `js/admin-ui.js`.
- Testes criados: `tests/performance-final.mjs`, `tests/compare-performance-final.mjs`, `tests/performance-stress.mjs`, `tests/performance-memory.mjs`.
- Relatório criado: `docs/PERFORMANCE_FINAL.md`.
- Controles atualizados: `_CONTROLE_PROJETO/ESTADO_ATUAL.md`, `_CONTROLE_PROJETO/HISTORICO_ALTERACOES.md`, `_CONTROLE_PROJETO/RECUPERACAO.md`.
- Artefatos ignorados: `dist/` e `.local/performance-final/`; não são código adicional para publicação.

## Auditoria de carregamento e dependências

| Página | CSS carregado | JavaScript carregado, na ordem |
|---|---|---|
| `index.html` | `styles.css` | courses, config, catalog, api, booking, phone, animations, experience |
| `admin.html` | styles, admin-dashboard, admin-push, admin-notifications | config, admin-ui, admin-push, admin-notifications, admin |
| `privacidade.html` | `styles.css` | Nenhum |

Todos os scripts acima usam defer. `api` publica NN/Lumiere para booking/experience; catalog fornece os padrões. Admin-ui fornece a apresentação usada por admin; admin conecta Central/Push somente após Auth e is_admin. Admin-push resolve `admin-sw.js` relativamente ao próprio script e só registra o worker no fluxo autorizado existente. `admin.webmanifest` e ícones são dependências indiretas essenciais; não são arquivos descartáveis. Não há novo registro de worker, cache de sessão, token ou dado pessoal.

O build existente copia somente páginas, CSS, JS, assets, worker e manifesto para `dist/`; não publica e não inclui testes, referências, documentos, banco ou arquivos locais. Foi preservado. Referências aprovadas, migrations, rollbacks e scripts operacionais não são recursos carregados pelo navegador, mas continuam necessários para auditoria, recuperação e operação.

Inventário completo de recursos e tamanhos em `.local/performance-final/inventory.json`. CSS: styles **53.163 B**, Dashboard **28.876 B**, Central **10.533 B**, Push **757 B**. Os oito scripts públicos somam **32.636 B**. Nos dois scripts alterados, o conteúdo servido no comparativo passou de **32.762 para 33.110 B**; o ganho é de processamento, não de bytes. A exportação da base normaliza finais de linha e não acrescenta newline final. As estimativas gzip no inventário são locais, não prova de compressão da hospedagem.

As camadas CSS repetidas definem tema, responsividade, acessibilidade e estados interativos. Não houve evidência que justificasse consolidá-las com risco de mudar a cascata. Efeitos de sombras, blur, hover, foco, gráficos e safe areas mantidos. Nenhum will-change ou camada GPU permanente adicionado. RAFs, easing, duração e intensidade de animações não mudaram: entrada da foto 1150 ms; modal 360/230 ms; contadores 540 ms; barras e demais transições oficiais preservadas.

Fotos mantidas byte a byte, confirmadas pelo teste de assets. Foto principal continua fetchpriority high, sem lazy; secundárias continuam lazy/async. Caixas já dimensionadas pelo CSS. Fontes Google mantêm famílias/pesos, preconnect e display=swap. Não se adotou preload especulativo, recodificação de imagens, fontes substitutas ou carga condicional que pudesse mudar aparência/ordem. O laboratório bloqueia fontes externas e compara o mesmo fallback nos dois lados.

## Método de medição

Edge/Chromium headless em localhost, CPU 4×, cache HTTP desabilitado, viewports 390×852 e 1440×852, Auth/catálogo/slots/reservas sintéticos, fontes e rede externa bloqueadas. Nenhuma credencial real é utilizada. Animações permanecem habilitadas durante o benchmark; as esperas das capturas permitem sua conclusão.

`tests/performance-final.mjs` intercepta **somente** admin/admin-ui para servir a base exportada ou os scripts atuais, mantendo a mesma página, CSS, backend simulado e transporte de leitura nos dois lados. Baseline `before-a` foi coletada antes de editar código; depois foram executadas as rodadas `after-b`, `before-b`, `after-c`. `after-a` foi exploratória, anterior à última otimização da busca, e não integra os resultados finais.

Cada rodada usa 10 mil atendimentos no mesmo dia, distribuídos em dez horários e três status. Trata-se de estresse deliberado, não de carga real do estúdio. Cinco atualizações do Dashboard por largura e quatro entradas de busca (`load-1`, `load-12`, `load-123`, vazio). Os tempos administrativos vão da entrada em ui.render à conclusão síncrona do resumo semanal; não incluem rede, pintura ou espera de animações. Busca mede a execução síncrona do handler. Não são INP nem tempo até o próximo paint.

No JSON bruto, o bloco Dia contém a entrada inicial na agenda semanal e depois a seleção Dia; a tabela usa somente o último valor, correspondente a Dia. Semana/Mês têm uma seleção por rodada. Agregado: dez amostras por lado/largura no Dashboard; duas por lado/largura para cada visão; oito na sequência de busca. A amostra de calendários é pequena e a variação do host é relevante.

## Resultados antes/depois

Medianas em ms; bases `before-a/b`, finais `after-b/c`. Brutos, mínimos, máximos e quantidades em `.local/performance-final/summary.json`.

| Processamento, 10 mil registros, CPU 4× | 390 px antes → depois | 1440 px antes → depois |
|---|---:|---:|
| Dashboard + resumo semanal | 1882,4 → 962,4 (−48,9%) | 1319,9 → 1033,0 (−21,7%) |
| Seleção Dia + resumo | 2142,3 → 1566,4 (−26,9%) | 1773,1 → 1393,8 (−21,4%) |
| Seleção Semana + resumo | 1267,1 → 1078,5 (−14,9%) | 1680,1 → 1144,7 (−31,9%) |
| Seleção Mês + resumo | 1815,0 → 1151,6 (−36,6%) | 1134,6 → 775,4 (−31,7%) |
| Sequência de busca | 723,2 → 20,4 (−97,2%) | 452,0 → 24,0 (−94,7%) |

A primeira busca ainda paga a normalização: **200,5–390,4 ms** nos ensaios finais. As seguintes reutilizam as strings. Não se promete esse percentual para toda consulta nem a meta INP ≤200 ms. Mesmo depois da otimização, renderizar 10 mil registros sob CPU 4× continua gerando trabalho longo; não se afirma ausência de travamentos nesse estresse.

Na primeira comparação final, Dia/Semana em 390 px tiveram valores piores que uma baseline isolada. A repetição em ordem inversa mostrou grande variação e as medianas agregadas acima melhoraram. Não há garantia por operação individual: os intervalos de Dia móvel foram 1572–2712 ms antes e 1068–2065 ms depois. Código mantido pelo ganho agregado, redução concreta de trabalho e equivalência dos resultados, sem encurtar animações. As seleções de calendário têm evidência mais limitada que o Dashboard e a sequência de busca.

| Página pública, observações de laboratório | Antes, duas rodadas | Depois, duas rodadas |
|---|---|---|
| LCP / FCP | 1304 / 1128 ms | 1064 / 684 ms |
| CLS inicial | 0 / 0 | 0 / 0 |
| TTFB localhost | 23,5 / 57,3 ms | 16,7 / 14,3 ms |
| Long Tasks iniciais | 3 / 3; maior 190 ms | 3 / 4; maior 173 ms |
| Recursos JS | 8 / 8 | 8 / 8 |
| Maior duração individual de recurso JS | 125,7 / 139,7 ms | 111,3 / 112,1 ms |

O código público não foi alterado. Essas diferenças de carregamento não podem ser atribuídas à otimização administrativa; são observações do host/rede local. A soma das durações dos JS paralelos não é tempo total de carregamento. O número de recursos totais variou 14–15 pela antecipação de imagem lazy; não se declara redução de requisições, carga ou melhora de Web Vitals em produção. Não houve medição válida de INP, FPS/estabilidade por frames, Chrome Android ou Safari/iPhone físico.

### Memória e ciclo de sessão

As leituras finais sem coleta controlada variaram **8,1–24,3 MB antes** e **8,4–35,1 MB depois**. A leitura pior isolada foi investigada com `tests/performance-memory.mjs`, forçando GC nos mesmos pontos, com 10 mil registros, calendário mensal e buscas. Resultados JSHeapUsedSize em bytes:

| Estado após GC | Base | Final |
|---|---:|---:|
| Dados carregados | 7.917.744 | 7.817.372 |
| Após sequência de busca | 7.927.512 | 8.595.180 |
| Após logout | 1.090.104 | 995.992 |

O texto normalizado acrescentou aproximadamente **778 KB** entre carregar e buscar na versão final, contra 10 KB na base. É a troca explícita por reduzir CPU nas buscas seguintes. A representação é limitada aos eventos correntes, não acumula históricos de consultas nem sobrevive ao logout. Listeners voltaram de 98 para 61 em ambos os lados após logout. A amostra não demonstra redução geral de memória nem prova ausência de todo vazamento; mostra liberação do conjunto consultado nesse cenário. Brutos em `memory-before-memory.json` e `memory-after-memory.json`.

## Equivalência visual e regressões

Passaram as comparações estritas `before-a` contra **after-b e after-c**: mesmo HTML renderizado e **zero pixels diferentes em 12 capturas** por comparação. Hero e modal completo em 390; Dashboard, detalhes e calendários Dia/Semana/Mês em 390/1440. PNGs também coincidiram byte a byte nesses pares. Inspeção visual de Dashboard 1440 e Dia 390 realizada. Isso não certifica todas as telas/fontes/dispositivos físicos.

A comparação estrita `before-b`/`after-c` rejeitou duas imagens: 68 pixels no Dashboard desktop e 8 no fundo dos detalhes, diferença máxima de **1/255** por canal. A mesma diferença ocorre entre as duas baselines sem mudanças de código. Ambas as versões finais coincidem exatamente com a primeira baseline; HTML coincide também com a segunda. O diagnóstico local em `pixel-diagnostic.mjs` localizou a variação na pintura dos cards. Não foi afrouxado o comparador para declarar aprovação desse par.

Uma comparação exploratória também detectou acento alterado no total do calendário por codificação do script de edição. O texto original foi corrigido antes das rodadas finais, cujos comparadores verificam igualdade integral. Esses ensaios rejeitados não contam como aprovação.

Executados e aprovados:

- `npm.cmd run check`; `npm.cmd test` (**41/41**); `npm.cmd run build`.
- `node tests/browser.mjs`: público, cursos, mensagens WhatsApp simuladas, calendário/slots, falhas, idempotência/envio duplo, confirmação por ID, galeria, teclado, reduced-motion e admin; sete larguras 320/375/390/430/768/1024/1440, sem overflow/exceções nas verificações.
- `node tests/admin-dashboard.mjs`: indicadores, receita, períodos, hover individual de barras/fatias/legendas, teclado, detalhes, ações/status/remarcação, fuso, erros, 10 mil registros, paginação e logout concorrente; seis larguras e equivalência de estilos com a referência.
- `node tests/admin-notifications.mjs`: gate Auth, filtros, paginação, leitura, sincronização entre páginas/dispositivos simulados, status, detalhes, hover, 10 mil registros, erros/logout e referência.
- `node tests/push-browser.mjs`: worker real local no subdiretório, permissão/ativação/teste/desativação/Auth simulados, deep link e logout; sem envio real.
- `node tests/performance-stress.mjs`: CPU 4×, rede emulada 128 KiB/s download/64 KiB/s upload, latência 150 ms e atraso adicional de provedor simulado de 200 ms; busca case-insensitive/com acentos, nomes/serviços atualizados sem resultados antigos, navegação rápida e logout.
- Benchmarks e duas comparações finais estritas descritas acima; ensaio de memória/GC; `git diff --check` e preservação dos arquivos protegidos por Git.

Não foram executados testes SQL/migrations nesta tarefa, em atendimento ao pedido de não executar migrations. Backend, RLS, disponibilidade, cotas, payloads, estados Push, VAPID, Cron/Vault e configurações permanecem intactos. Suítes usam rede externa bloqueada. O Push em iPhone real é estado informado pelo usuário, não homologação física realizada nesta auditoria.

## Banco: oportunidades separadas, não aplicadas

| Oportunidade a investigar futuramente | Ganho estimável agora | Impacto/risco |
|---|---|---|
| Plano e custo de admin_action list em Geral, que devolve todo o histórico | Indeterminado sem EXPLAIN/dados de volume; potencial redução de payload/memória com um contrato paginado futuro | Mudaria contrato e cobertura dos gráficos; precisa desenho, testes e autorização própria |
| Agregações da Central sobre o histórico completo, apesar de DOM paginado em 20 | Indeterminado; depende da seletividade e planos dos índices já existentes na 006 | Índices extras aumentam custo de gravação; não presumir necessidade nem reescrever migrations aplicadas |
| Lock transacional compartilhado na RPC administrativa, inclusive list | Indeterminado sem medição de contenção | Não remover: pode alterar consistência/concorrência; exige análise separada de todas as operações |

Nenhum SQL proposto para aplicação, índice criado ou consulta remota realizada. Sem evidência do ambiente real, números de ganho de banco seriam especulativos.

## Candidatos à limpeza — somente lista

Verificação: não referenciados pelos HTML/JS/CSS/scripts de build/testes/documentos versionados na busca por seus nomes antes deste relatório; ficam fora do pacote de publicação. A ausência de referência versionada não comprova ausência de uso manual.

| Caminho | Bytes | Motivo/evidência | Risco de exclusão |
|---|---:|---|---|
| `.local/reference-readable.html` | 78.139 | Extração de leitura criada na tarefa visual anterior; original aprovado está preservado em REFERENCIAS | Baixo tecnicamente; perde a cópia de diagnóstico |
| `.local/overflow.mjs` | 603 | Ensaio manual de overflow; suítes atuais cobrem overflow | Baixo a médio: confirmar uso manual |
| `.local/debug-courses.mjs` | 742 | Script exploratório; cursos têm regressão na suíte oficial | Baixo a médio: confirmar uso manual |
| `.local/http-performance-error.log` | 36.850 | Log local histórico, sem dependência no build | Médio: perde diagnóstico anterior; confirmar processo/necessidade antes de apagar |
| `.local/notifications-http-error.log` | 77.172 | Log local histórico da Central | Médio: perde histórico de investigação |

**Nenhum arquivo foi excluído.** Backups, referências finais, migrations, rollbacks, fixtures, configuração ignorada, secrets, scripts operacionais e documentação de recuperação não são candidatos desta lista. `dist/` continua artefato local necessário à entrega; foi regenerado, sem publicação.

## Reproduzir e recuperar

Usar servidor estático em 4173 e Edge headless descartável em 9223, conforme o guia do Dashboard, sempre em loopback. Executar as suítes CDP em sequência, nunca sobre a mesma aba simultaneamente. Exportar somente os dois scripts da tag, sem restaurar o checkout:

```powershell
New-Item -ItemType Directory -Force .local/performance-final/baseline | Out-Null
foreach ($scriptName in @('admin','admin-ui')) {
  $baselineText = git show "backup-nandanails-antes-performance-final-20261119:js/$scriptName.js"
  [System.IO.File]::WriteAllText((Join-Path $PWD ".local/performance-final/baseline/$scriptName.js"), ($baselineText -join "`n"), [System.Text.UTF8Encoding]::new($false))
}
node tests/performance-final.mjs before-a
node tests/performance-final.mjs after-b
node tests/compare-performance-final.mjs before-a after-b
node tests/performance-stress.mjs
node tests/performance-memory.mjs before-memory
node tests/performance-memory.mjs after-memory
```

Para recuperação, preservar primeiro as pendências atuais em commit revisado e criar branch inédita a partir da tag. Não resetar, apagar ou reaplicar banco. Retornar à base remove apenas esta otimização e mantém o refinamento visual anterior. Não exige deploy de função, SQL, chaves novas ou alteração de Push. Publicação futura exige autorização separada.
