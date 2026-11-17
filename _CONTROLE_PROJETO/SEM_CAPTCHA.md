# Versão sem CAPTCHA — 17/11/2026

Decisão explícita do usuário: esta versão não usa Cloudflare Turnstile nem outro CAPTCHA. O usuário informou que o projeto `nandanails-agendamento` (`fdxocuhgiypynsjxsqtm`) existe, a CLI está vinculada e as migrations `001`, `002` e `003` já foram executadas. Esse estado remoto foi informado pelo usuário; não houve consulta ou alteração remota pelo Codex.

## Alterações de comportamento

- `js/api.js`: `configured` exige somente URL Supabase e Publishable key. Removidos carregamento de script externo, callbacks, widget, token e condição de CAPTCHA antes do envio.
- `js/config.js`: removido somente o campo `turnstileSiteKey`; URL e campo da Publishable key foram preservados. Não incluir Secret keys ou `service_role` neste arquivo.
- `js/booking.js` e `index.html`: removidos inicialização e contêiner vazio do widget. A seleção de serviço continua exigindo `serverToday` obtido do backend; a confirmação continua exigindo ID da reserva. Respostas nulas agora também são tratadas sem erro técnico para a cliente.
- `privacidade.html`: removida a informação desatualizada de uso da verificação Cloudflare. Não houve mudança de estilo, logo, fotos, animações, catálogo ou calendário.
- `supabase/functions/_shared/booking-handler.mjs`: removidas dependências de secrets Turnstile, Siteverify e `agenda_consume_challenge`. O endpoint aceita reserva sem token. Campos desconhecidos continuam sendo recusados; clientes com JavaScript antigo que enviem `captchaToken` devem atualizar a página.
- `.env.example`: removidas as duas configurações Turnstile. Não foram lidos, editados ou apagados secrets reais. Eventuais secrets antigos podem permanecer sem uso; não são necessários à função nova.

## Proteções preservadas e compensação simples

Não foi necessária nenhuma alteração de banco. A função existente `agenda_rate_limit` continua exclusiva do backend e é chamada em RPC independente antes da tentativa de reserva, preservando contagem mesmo em conflitos e falhas.

| Limite existente | Valor |
|---|---|
| Catálogo | 300 consultas/minuto, compartilhadas pelo estúdio |
| Disponibilidade | 300 consultas/minuto, compartilhadas pelo estúdio |
| Tentativas de reserva globais | 60/hora |
| Tentativas por telefone | 5/hora |
| Reservas registradas por telefone | 5 nas últimas 24 horas |

Agora a cota por telefone é verificada imediatamente depois da global, sem depender de CAPTCHA e antes de `agenda_book`. O identificador continua sendo HMAC-SHA256 do telefone normalizado, calculado somente no backend com `RATE_LIMIT_SALT` aleatório de pelo menos 32 caracteres. UUID, chaves do corpo e cabeçalhos de IP não permitem escolher uma cota arbitrária. A proteção falha de forma fechada: falta de salt, erro de cota ou limite esgotado não chega à gravação.

Como compensação simples adicional, o handler exige `Content-Type: application/json` e valida nome completo, telefone, datas reais, horário, UUID, preço inteiro entre 0 e 10000000 centavos e duração entre 15 e 480 minutos em múltiplos de 15. O banco continua sendo a autoridade do preço e duração do serviço, não esses valores enviados pela cliente. Mantidos limite de leitura de 4096 bytes, lista de campos permitidos e CORS com origens explícitas. Isso recusa parte do tráfego inválido cedo, sem introduzir desafio, atraso obrigatório ou campo extra no formulário.

Mantidos sem alteração: RLS, grants restritos, autorização administrativa, chaves estrangeiras, snapshots de preço/duração, lock transacional, exclusão GiST contra sobreposição e idempotência por UUID. O servidor agora também recusa resposta de reserva sem ID não vazio. O frontend mantém sua própria checagem antes de exibir confirmação. Falha, conflito ou ausência de confirmação do banco não vira sucesso visual.

A função `agenda_consume_challenge` e a tabela privada `used_challenges` permanecem no histórico já aplicado, com as permissões restritas originais. Não são chamadas pelo fluxo novo. Não apagar objetos nem reaplicar migrations para removê-los. Nenhuma migration incremental é necessária nesta entrega.

## Riscos que permanecem

Sem CAPTCHA, scripts podem chamar o endpoint diretamente e criar reservas sintaticamente válidas. HMAC protege a derivação da chave de limite, mas não comprova posse do telefone; um atacante pode alternar números. A cota global limita volume, porém é compartilhada: seu esgotamento pode impedir clientes legítimas de reservar até a janela expirar. Bots ainda podem ocupar horários reais antes de atingir o limite.

CORS e JSON obrigatório dificultam alguns envios de páginas externas, mas não autenticam um script: cabeçalhos podem ser simulados fora do navegador. Os limites dentro da função também não impedem o custo de invocá-la. Monitorar a fila de reservas e erros 429 e revisar/cancelar abuso pelo painel continua necessário. Não foram implementados login obrigatório, OTP, novo provedor, WAF ou qualquer desafio nesta versão. Não se promete bloqueio completo de automação.

## Configuração e publicação manual

No frontend são necessários somente `supabaseUrl` e `publishableKey` em `js/config.js`. A data de referência e horários continuam vindo da função `booking`. Não colocar chave privilegiada no navegador.

No backend, manter:

- `ALLOWED_ORIGINS`: origens reais do site, separadas por vírgula, sem barra final.
- `RATE_LIMIT_SALT`: secret aleatório de pelo menos 32 caracteres. Se ele já está configurado corretamente, preservá-lo.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: somente no ambiente de backend do Supabase, conforme a configuração existente.

Não são necessárias chaves públicas ou privadas de CAPTCHA. O `supabase/config.toml` existente mantém `verify_jwt=false` para `booking`, permitindo visitantes sem conta. Isso não altera RLS ou autenticação do painel.

Depois de conferir que a CLI continua vinculada exclusivamente a `fdxocuhgiypynsjxsqtm`, execute manualmente na raiz do projeto:

```powershell
supabase functions deploy booking --no-verify-jwt
```

O comando publica somente a função `booking` no projeto vinculado. Não executa migrations nem publica o frontend. Não usar `db push`, não reaplicar `001`/`002`/`003` e não implantar `notify` para esta mudança. Referências oficiais: [deploy de Edge Functions](https://supabase.com/docs/guides/functions/deploy), [configuração da função](https://supabase.com/docs/guides/functions/function-configuration).

O frontend também precisa receber os arquivos atualizados em sua hospedagem em uma publicação autorizada separada. `npm.cmd run build` prepara os arquivos públicos em `dist/`, sem publicar. Atualize/recarregue o navegador para não misturar scripts antigos que ainda exijam CAPTCHA com o backend novo.

Não houve deploy, consulta remota, alteração de secrets, publicação do frontend ou `git push` pelo Codex. A instalação e o vínculo CLI informados pelo usuário não foram auditados remotamente. Teste real de ponta a ponta só poderá ser afirmado depois de publicação manual e teste autorizado.

## Recuperação

Estado anterior: tag `backup-nandanails-antes-sem-captcha`, commit `3cb92400de026920e84973c5542af1c13a022813`. Preservar alterações pendentes antes de recuperar em branch nova, conforme `RECUPERACAO.md`. Retornar à versão com CAPTCHA exigiria recuperar frontend e função compatíveis e configurar novamente o provedor; não desfaz nem reaplica o banco.

Os resultados desta execução ficam em `HISTORICO_ALTERACOES.md`. Testes de navegador usam backend simulado; testes SQL usam apenas bancos descartáveis locais. Nenhum deles comprova funcionamento online em produção.
