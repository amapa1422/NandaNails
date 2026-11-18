# Dashboard e calendário administrativos — 18/11/2026

Implementação local sobre o painel oficial, com os componentes do HTML aprovado `REFERENCIAS/NandaNails_dashboard_graficos_hover_completo.html`. A referência permanece intacta. Nenhuma operação foi feita no Supabase remoto, nem publicação ou push.

## Arquivos e funcionamento

- `admin.html`: mantém head/favicon, logo, login e formulários oficiais; incorpora menu Dashboard/Minha agenda, gráficos, calendário e detalhes em dialog lateral.
- `css/admin-dashboard.css`: estilos da referência, carregados apenas pelo admin; complementos de integração, teclado, menu recolhível e rolagem. `css/styles.css` permanece intacto, assim como o site público.
- `js/admin-ui.js`: apresentação, agrupamento por data, Dia/Semana/Mês, filtros, gráficos, contadores e normalização de WhatsApp. Não faz requisições nem contém registros demonstrativos.
- `js/admin.js`: mantém Auth, `is_admin`, renovação e ações via `admin_action`; conecta a interface, protege respostas concorrentes e reutiliza intervalos já consultados durante a sessão. Atualizar, mutações e logout invalidam o cache. Dados privados e dialogs são limpos no logout. Formulários administrativos só são reconstruídos quando seus dados mudam, preservando edições ao alternar telas.
- `tests/admin-dashboard.mjs`: suíte CDP com dados sintéticos e rede externa bloqueada; `tests/browser.mjs` preserva regressões públicas/cursos e adapta as verificações do admin. `package.json` adiciona `test:dashboard`.
- Documentos de estado, histórico e recuperação atualizados. `dist/` regenerado e ignorado pelo Git.

## Dados e significado dos números

Somente depois de autenticar e confirmar `is_admin`, o painel chama `admin_action('list', {from,to})`. O contrato existente retorna `appointments` com telefone de `clients`, snapshots de serviço/preço/duração, `services`, `availability` e `blocks`. Nenhuma migration, grant, RLS, Edge Function, chave ou dado real foi alterado.

A consulta cobre o intervalo visível e a semana atual, além do mês atual quando selecionado no Dashboard. Semana começa segunda-feira. Geral solicita `from: '-infinity'` e `to: 'infinity'`, aceitos pelo cast timestamptz do contrato SQL existente: inclui todo o histórico, sem o limite de 70 dias da demonstração. Apenas quatro respostas de intervalos ficam em memória; leituras idênticas pendentes são compartilhadas. Não há cache persistente nem atualização automática: usar Atualizar para alterações feitas em outra sessão.

Os quatro indicadores principais, status, serviços, últimas reservas e gráficos acompanham Semana/Mês/Geral. O resumo complementar Hoje/Na semana/Próximos/Cancelados/Concluídos/Estimativa permanece explicitamente na semana atual, nas duas telas. Hoje/Na semana excluem cancelados; próximos considera confirmados futuros. Total de reservas e barras incluem todos os status; a rosca mostra a distribuição. A estimativa soma apenas `price_cents` dos concluídos, sem deduzir taxas/despesas. Não comprova pagamento recebido; cancelados não entram nesse valor. Os últimos agendamentos são ordenados pela data do atendimento, pois não se inventa um histórico de alterações.

Semana/Mês mostram barras diárias; Geral agrega por mês para representar todo o histórico. Sem dados, contadores ficam em zero e não há segmentos fantasmas. Contagem usa RAF curto, cancelável, formatador reutilizado e movimento reduzido; barras usam uma atualização agrupada. A rosca usa paths SVG individuais, inclusive dois arcos no caso de 100%, com interação apenas no traçado visível.

Calendário usa os mesmos registros consultados, agrupados em Map e ordenados por horário em Brasília. Conversão dos timestamps usa explicitamente America/Sao_Paulo, independente do fuso do dispositivo. A consulta mensal inclui os dias adjacentes da grade. Mês mostra até três reservas por célula e +mais abre o dia; Dia/Semana carregam inicialmente até 100 cartões por grupo de horário/coluna e oferecem Mostrar mais. Horários vazios da visão diária vêm do expediente; atendimentos fora do expediente atual continuam visíveis. Disponibilidade real continua na consulta `slots` existente, sem inferir vaga pelas linhas vazias.

Detalhes preservam `status` e `reschedule`, com a decisão final no backend. Concluir fica indisponível antes do término; cancelados não são reativados. Valor/duração contratados continuam preservados pela regra existente. Serviços, funcionamento e bloqueios mantêm formulários e payloads originais. WhatsApp mostra número brasileiro normalizado ou Contato indisponível; link só existe para formato válido. A mensagem é editável no painel e no WhatsApp, sem envio automático nem navegação antes da ação da administradora.

## Fidelidade visual e diferenças necessárias

Foram reutilizados CSS, estrutura e renderizadores da referência para sidebar, quatro KPIs, cartões, barras, rosca, serviços, últimas reservas, Dia/Semana/Mês e detalhes. Oito seletores × sete propriedades de estilo foram comparados em 390 e 1440 px, com igualdade após as transições. Capturas e relatório JSON em `.local/dashboard/`; inspeção das capturas desktop e mobile realizada. As fontes externas foram bloqueadas nos testes: a comparação não certifica pixels nem fontes carregadas em produção.

Diferenças funcionais deliberadas: login/logo/favicon oficiais; remoção dos avisos e registros fictícios; faturamento rotulado estimado; resumo semanal também ao final do Dashboard; recolhimento do menu no desktop; rolagem e carregamento progressivo; controles originais de disponibilidade abaixo do calendário, sem duplicar o seletor visual Dia/Semana/Mês; ações reais e mensagem editável nos detalhes. Status de carregamento/erro fica acima do workspace. O dialog nativo oferece modalidade, Escape e contenção de foco.

O teste de hover real identificou uma especificidade conflitante no CSS da própria referência: a regra-base de dois IDs impedia o aumento da espessura do arco. O complemento mantém a aparência e corrige a prioridade, verificando espessura 22px somente no segmento apontado, redução da opacidade dos outros e interação por legenda/teclado. Não há círculos transparentes cobrindo os segmentos.

## Testes executados

- `npm.cmd run check`, `npm.cmd test`: sintaxe/links/IDs e 23 testes Node aprovados, incluindo integridade das migrations, imagens originais e regras existentes do handler.
- `node tests/browser.mjs`: aprovado — site público, cursos, galeria, reservas simuladas, erros, máscara, Auth administrativo simulado, disponibilidade concorrente e todas as abas em seis larguras.
- `node tests/admin-dashboard.mjs`: aprovado — nenhuma leitura administrativa antes de autorização; não administradora; vazio/um status/três status; contagem e estimativa; hit testing em três pontos de cada arco; hover real de arcos e barras, legenda e foco; detalhes/Escape/WhatsApp editável/inválido; Dia/Semana/Mês, busca/status, datas, +mais; respostas de meses fora de ordem; payloads de remarcar/cancelar/confirmar/concluir/serviço/expediente/bloqueio; seis larguras 320/375/390/430/768/1440 sem overflow da página; menu; movimento reduzido; UTC perto da meia-noite; carga sintética de 10 mil registros; limite do DOM; erro de list e logout com resposta atrasada; comparação de estilos com a referência.
- `npm.cmd run build` e `git diff --check`: aprovados; nenhum pacote publicado.

A medição dos 10 mil registros é de localhost/Edge com RPC simulado e inclui renderização, não latência ou capacidade do Supabase. Houve rodadas exploratórias com falhas de sincronização da animação/teste, alvo de seleção e regra de hover; os resultados acima correspondem às rodadas finais corrigidas. Sem teste real de Auth, consulta ou escrita no Supabase, envio de WhatsApp, Safari/iPhone físico, carga backend ou garantia de FPS/INP. Não foram necessárias novas rodadas SQL, pois nenhum SQL mudou.

Geral usa o JSON integral do RPC existente e pode demandar memória/tempo em históricos muito maiores. A renderização progressiva e o agrupamento limitam o DOM inicial, mas não paginam a resposta do servidor. Paginação/agregação backend exigiria uma evolução separada do contrato, revisada e autorizada. A migration 004 anteriormente preparada continua com estado remoto não verificado: se o ambiente ainda apresentar SQLSTATE 42702, seguir `docs/CORRECAO_ADMIN_42702.md`; este trabalho não a aplicou.

## Reproduzir localmente

Na raiz, em terminais separados:

```powershell
npm.cmd start
```

```powershell
Start-Process -FilePath 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -WindowStyle Hidden -ArgumentList '--headless=new --disable-gpu --no-first-run --no-default-browser-check --remote-debugging-port=9223 --user-data-dir="C:\Users\felipe.lobato\Desktop\NANDA NAILS\.local\dashboard\edge-profile" about:blank'
npm.cmd run check
npm.cmd test
npm.cmd run test:browser
npm.cmd run test:dashboard
npm.cmd run build
```

As duas suítes de navegador são sequenciais e interceptam configuração/rede antes de abrir páginas locais. Usam credenciais falsas e backend simulado; não inserir credenciais reais nelas. Apenas servir/abrir admin.html manualmente usa a configuração real existente quando você fizer login. Abrir `http://127.0.0.1:4173/admin.html` permite revisão manual; teste real precisa de autorização específica para execução pelo Codex.

## Recuperação e publicação manual

Base preservada em `9f8ee9410bd3d3cdddbd15c9c01558b0373fc5e0`, tag inédita `backup-nandanails-antes-dashboard-calendario`. O commit preserva as pendências anteriores: documentação/testes de cursos, exclusão da referência anterior e inclusão da nova referência. Recuperar somente após preservar o trabalho atual, em branch nova, conforme `_CONTROLE_PROJETO/RECUPERACAO.md`. Não recuperar o banco nem reaplicar migrations.

Depois de revisar o diff e autorizar a publicação, o responsável pode executar manualmente:

```powershell
git status --short
git diff --check
git add -- admin.html css/admin-dashboard.css js/admin.js js/admin-ui.js tests/browser.mjs tests/admin-dashboard.mjs package.json docs/DASHBOARD_CALENDARIO.md README.md _CONTROLE_PROJETO/ESTADO_ATUAL.md _CONTROLE_PROJETO/HISTORICO_ALTERACOES.md _CONTROLE_PROJETO/RECUPERACAO.md
git commit -m "Integra dashboard e calendario administrativo aprovados"
git push origin main
```

Conferir antes o remoto/branch e a configuração de GitHub Pages. Enviar código ao GitHub só publica o site se a hospedagem já estiver configurada para esse fluxo. Se a hospedagem recebe pacote estático, publicar somente o conteúdo público de `dist/` pelo procedimento existente. Os novos arquivos CSS/JS precisam acompanhar `admin.html`. Não copiar `.local/`, testes ou documentos privados para a hospedagem. Esta entrega não exige deploy de funções, alteração de secrets ou SQL. Nenhum desses comandos de publicação foi executado pelo Codex.
