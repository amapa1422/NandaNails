# Favicon NandaNails — 18/11/2026

Fonte fornecida e encontrada: `assets/nandanails-logo-original.jpg` (240 × 185 px). Original preservado byte a byte, SHA-256 `4f85e548f98f9ef0d6f1f54e2495f990f5aca6afba3910ecffe4fc0bc501d905`.

## Arquivos

Gerados em `assets/icons/n-v1/`:

- `favicon.ico`: entradas PNG de 16, 32 e 48 px.
- `favicon-16x16.png`: 16 × 16.
- `favicon-32x32.png`: 32 × 32.
- `apple-touch-icon.png`: 180 × 180.
- `icon-192.png`: 192 × 192.
- `icon-512.png`: 512 × 512.
- `manifest.webmanifest`: somente as declarações dos ícones 192/512, com caminhos relativos ao próprio manifest. Não define display, start_url, scope, cores ou comportamento de instalação; não há service worker novo.

`index.html` e `admin.html` receberam somente cinco links no head: ICO, PNG 32, PNG 16, apple-touch-icon e manifest. Todos usam `assets/icons/n-v1/...`, sem barra inicial, resolvendo corretamente em `/NandaNails/`. A versão está no diretório para renovar a URL dos ícones. Em futura mudança da imagem, criar versão nova e atualizar os links.

Criado `scripts/generate-favicons.ps1` para reproduzir a conversão no Windows usando System.Drawing. Sem dependências instaladas, imagens geradas por IA ou alteração da imagem-fonte. Execução local, a partir da raiz:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-favicons.ps1
```

O parâmetro de política vale somente para esse processo; o script não altera a política permanente do sistema. A primeira tentativa direta foi bloqueada pela política local; a execução por processo funcionou. Uma incompatibilidade inicial de overload de DrawImage foi corrigida antes da geração final.

A composição preserva o desenho completo: redimensionamento proporcional, centralizado, com faixas simétricas preenchidas pela cor de fundo do pixel superior esquerdo da fonte. Um recorte quadrado da imagem original cortaria detalhes laterais; por isso não se cortou a letra N nem os adornos. Não há distorção, alteração deliberada de cores ou cantos arredondados embutidos. Versões maiores que a fonte são ampliações: não recuperam detalhes inexistentes no JPEG de 240 × 185.

O empacotador existente já copia toda a pasta assets; não precisou mudar. `dist/` foi regenerado e contém os ícones/manifest. Código de funcionamento JS, CSS, corpo das páginas, logo do cabeçalho, galeria, login e backend permanecem intactos.

## Verificações executadas

- PNGs abertos com System.Drawing e dimensões conferidas.
- Cabeçalho ICO, quantidade de entradas, tamanhos, offsets e assinatura/dimensões dos PNGs internos conferidos com Node.
- Cinco links em cada página apontam para arquivos existentes, inclusive no pacote dist. Resolução simulada de todas as URLs em `https://example.invalid/NandaNails/index.html` e `admin.html` confirmou o subdiretório correto.
- Manifest analisado como JSON; contém somente icons, com arquivos existentes na origem e no pacote.
- `npm.cmd run check`, `npm.cmd run build` e `npm.cmd test`: aprovados, 23 testes Node.
- Original conferido por hash; diff confirma preservação de CSS, JavaScript de funcionamento, Supabase e página de privacidade. Conteúdo das páginas conferido excluindo apenas os novos links do head.
- `git diff --check`: aprovado. Ícone Apple inspecionado visualmente. Sem teste de Safari/iPhone físico nesta etapa.

## Testar no computador

Execute `npm.cmd start` e abra `http://127.0.0.1:4173/` e `http://127.0.0.1:4173/admin.html`. Confira a letra N na aba e ao criar um favorito. No DevTools → Network, filtre favicon/apple-touch-icon/manifest e confirme as URLs relativas sem 404. Caso a aba reutilize cache antigo, recarregue com Ctrl+F5 ou abra em um perfil/janela nova; o diretório n-v1 também renova as URLs em relação à versão anterior.

Depois de uma publicação manual futura, conferir também as duas páginas hospedadas dentro de `/NandaNails/`, sem mudar domínio, CORS ou backend.

## Testar no iPhone

Depois da publicação manual, abra o site no Safari, crie um favorito e confira seu ícone. Use Compartilhar → Adicionar à Tela de Início para criar um novo atalho e conferir a imagem da letra N. Abra também o painel no Safari e confira o ícone no contexto de abas/favoritos disponível nessa versão do iOS.

Atalhos já existentes podem manter uma imagem armazenada pelo iOS; se isso ocorrer, recrie somente o atalho do site após a publicação. A troca da URL do apple-touch-icon não força a atualização de atalhos antigos. Não há promessa de uniformidade entre versões do Safari nem validação em dispositivo físico.

## Git e publicação

As alterações pendentes da correção administrativa anterior e a logo fornecida foram preservadas no commit local `e16d5c14d7545abb536aa2231f9b12297c568ac4`, antes de gerar os ícones. Tag inédita `backup-nandanails-antes-favicon`. O novo trabalho de favicon está pronto para revisão e um novo commit, sem stage/commit automático desta mudança. Não houve push, publicação, aplicação de SQL ou acesso ao Supabase remoto.
