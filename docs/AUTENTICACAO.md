# Autenticação

O Finn usa o [Better Auth](https://better-auth.com) dentro da própria API: os dados ficam no seu
banco (`User`, `Account`, `Session`, `Verification`), e nenhum serviço de login de terceiros
guarda contas ou senhas.

## Como funciona

| Etapa            | O que acontece                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Cadastro e login | `POST /api/auth/sign-up/email` e `/sign-in/email` criam a sessão e devolvem o cookie.                          |
| Sessão           | Cookie `finn.session_token`, HttpOnly e `SameSite=Lax`, válido por `SESSION_DAYS` (30).                        |
| Rotas protegidas | `ensureAuthenticated` consulta a sessão no banco. O mesmo token vale em `Authorization: Bearer`.               |
| Esqueci a senha  | `POST /api/auth/request-password-reset` envia o link. A resposta é igual com ou sem conta.                     |
| Link de e-mail   | Vale 1 hora e uma vez só. Ao trocar a senha, todas as sessões abertas caem.                                    |
| Google           | `POST /api/auth/sign-in/social`. Só existe quando `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão definidos. |

Senhas continuam em bcrypt (custo 12, no máximo 72 bytes), na tabela `Account` com
`providerId = "credential"`. As contas criadas antes do Better Auth foram copiadas pela migration
`better_auth` e entram com a mesma senha.

## Decisões que valem lembrar

- **Sem vínculo automático** entre senha e Google (`accountLinking` desligado). Se alguém criou a
  conta com senha e depois tenta o Google com o mesmo e-mail, recebe um aviso para entrar com a
  senha. Isso impede que uma conta criada com o e-mail de outra pessoa passe a valer no Google dela.
- **`SameSite=Lax`** em vez de `Strict`: o retorno do Google é uma navegação vinda de outro site, e o
  Better Auth guarda o `state` do login num cookie que `Strict` esconderia. A defesa contra CSRF é a
  conferência de `Origin` dos POSTs, que fica sempre ligada (inclusive nos testes).
- **Limites de tentativas** ficam no Express (`rate-limit.middleware.ts`): login e cadastro por IP, e
  "esqueci a senha" por e-mail, com 1 minuto entre pedidos e até 10 por hora, para ninguém encher a
  caixa de outra pessoa.
- **`JWT_SECRET`** mantém o nome antigo, mas agora é o segredo do Better Auth. Trocá-lo derruba as
  sessões abertas.
- **`FRONTEND_ORIGIN`** é o endereço público da tela: os links de e-mail e o retorno do Google são
  montados a partir dele.

## Configurar o e-mail (Resend)

1. Crie a conta em <https://resend.com> e uma chave de API.
2. Sem domínio verificado, o Resend só entrega para o e-mail do dono da conta: serve para testar.
   Para qualquer pessoa receber, verifique um domínio seu e use um remetente dele em `EMAIL_FROM`.
3. Defina `RESEND_API_KEY` e `EMAIL_FROM`. Em produção, guarde a chave no Secret Manager.

Sem `RESEND_API_KEY`, em desenvolvimento o link aparece no log da API; em produção nada é enviado e
o erro é registrado.

## Configurar o Google

1. Em <https://console.cloud.google.com/apis/credentials>, crie um **ID do cliente OAuth** do tipo
   _Aplicativo da Web_ (na primeira vez, configure a tela de consentimento).
2. Em _URIs de redirecionamento autorizados_, cadastre `<FRONTEND_ORIGIN>/api/auth/callback/google`
   (por exemplo `https://seu-app.vercel.app/api/auth/callback/google` e, para testar,
   `http://localhost:5173/api/auth/callback/google`).
3. Defina `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. O botão "Continuar com o Google" aparece sozinho.

## Aplicativo futuro

O token da sessão aparece no cabeçalho `set-auth-token` das respostas de login e cadastro e vale em
`Authorization: Bearer`. O login com o Google dentro do aplicativo precisará de um fluxo nativo com
`idToken`, que ainda não foi feito.
