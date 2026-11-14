# Deploy na nuvem: Vercel, Cloud Run e Neon

Este caminho dispensa manter um servidor. Cada parte roda num serviço gerenciado:

| Parte              | Serviço                         | Custo esperado                          |
| ------------------ | ------------------------------- | --------------------------------------- |
| Tela (React)       | Vercel, plano Hobby             | Grátis para uso pessoal                 |
| API (Express)      | Google Cloud Run                | Perto de zero: só cobra enquanto atende |
| Migrations e seed  | Cloud Run Job                   | Centavos por execução                   |
| Banco (PostgreSQL) | Neon, plano gratuito            | Grátis, com 0,5 GB de dados             |
| Senhas e chaves    | Google Secret Manager           | Centavos por mês                        |
| Imagens Docker     | Artifact Registry e Cloud Build | Centavos por mês, dentro dos créditos   |

## Como as partes conversam

O navegador só fala com a Vercel. Ela entrega a tela e repassa tudo o que começa com `/api` para o
Cloud Run. Para o navegador, tela e API ficam no mesmo endereço, e é isso que mantém o cookie de
sessão funcionando: ele é `SameSite=Strict` e não seria enviado de `vercel.app` para `run.app`, que
são sites diferentes.

```text
celular ─► seu-app.vercel.app ─┬─► arquivos da tela
                               └─► /api/... ─► finn-api (Cloud Run) ─► Neon
```

## Antes de começar

1. Crie as contas: [Neon](https://neon.com), [Vercel](https://vercel.com) (pode entrar com o
   GitHub) e um projeto no [Google Cloud](https://console.cloud.google.com) com os créditos ativos.
2. Instale o [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) e entre com
   `gcloud auth login`.
3. Garanta que o código que você quer publicar está commitado e no GitHub, porque a Vercel publica a
   partir do repositório.
4. Crie um alerta de orçamento no Google Cloud (Faturamento → Orçamentos e alertas). Créditos vencem,
   e o alerta avisa antes de qualquer cobrança.

Os comandos abaixo são para o **Git Bash**. No PowerShell, um texto enviado por `|` ganha uma quebra
de linha no fim, e a senha guardada no Secret Manager ficaria errada.

## 1. Banco no Neon

1. Crie um projeto na região **AWS South America (São Paulo)**, perto do Cloud Run.
2. Em _Connection Details_, copie duas URLs:
   - a **pooled**, que tem `-pooler` no endereço: é a que a API usa;
   - a **direct**, sem `-pooler`: é a das migrations, que precisam de uma conexão direta.

As duas já vêm com `sslmode=require`. Não salve essas URLs em arquivo do projeto.

## 2. Preparar o Google Cloud

```bash
export PROJECT_ID="seu-projeto"
export REGION="southamerica-east1"
export IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/finn"

gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create finn --repository-format=docker --location="$REGION"
```

## 3. Guardar os segredos

Troque os valores entre aspas pelas URLs copiadas do Neon.

```bash
printf '%s' 'postgresql://...-pooler...' | gcloud secrets create finn-database-url --data-file=-
printf '%s' 'postgresql://...direct...' | gcloud secrets create finn-database-url-direct --data-file=-
node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))" \
  | gcloud secrets create finn-jwt-secret --data-file=-
```

Dê ao Cloud Run permissão de ler esses segredos:

```bash
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 4. Construir as imagens

Na raiz do projeto:

```bash
gcloud builds submit --config cloudbuild.yaml
```

Isso gera duas imagens a partir do `Dockerfile`: `api` e `migrate`.

## 5. Criar as tabelas e as categorias

```bash
gcloud run jobs deploy finn-migrate --image "$IMAGE/migrate:latest" --region "$REGION" \
  --set-secrets DATABASE_URL=finn-database-url-direct:latest --max-retries 0
gcloud run jobs execute finn-migrate --region "$REGION" --wait
```

## 6. Publicar a API

Troque o e-mail pelo seu: só ele vai poder criar conta.

```bash
gcloud run deploy finn-api --image "$IMAGE/api:latest" --region "$REGION" \
  --allow-unauthenticated --min-instances 0 --max-instances 1 --memory 512Mi \
  --set-secrets DATABASE_URL=finn-database-url:latest,JWT_SECRET=finn-jwt-secret:latest \
  --set-env-vars "TRUST_PROXY=1,SIGNUP_ALLOWED_EMAILS=voce@exemplo.com"
```

O comando mostra a URL do serviço, algo como `https://finn-api-abc123-rj.a.run.app`. Confira:

```bash
curl https://finn-api-abc123-rj.a.run.app/api/health
```

A resposta esperada é `{"status":"ok"}`. A primeira chamada pode levar alguns segundos, porque a API
e o banco acordam do modo de espera.

## 7. Publicar a tela na Vercel

1. Em `frontend/vercel.json`, troque `SUBSTITUA-PELA-URL-DO-CLOUD-RUN` pelo endereço da API, sem o
   `https://` duplicado: `"destination": "https://finn-api-abc123-rj.a.run.app/api/:path*"`.
2. Faça commit e push dessa mudança.
3. Na Vercel, crie um projeto importando o repositório e defina **Root Directory** como `frontend`.
   O resto é detectado pelo `vercel.json`.
4. Depois do primeiro deploy, informe o endereço da tela à API:

```bash
gcloud run services update finn-api --region "$REGION" \
  --update-env-vars FRONTEND_ORIGIN=https://seu-app.vercel.app
```

Abra o endereço da Vercel no celular, crie sua conta e entre.

## Assistente (opcional)

```bash
printf '%s' 'sua-chave-da-anthropic' | gcloud secrets create finn-anthropic-key --data-file=-
gcloud run services update finn-api --region "$REGION" \
  --update-secrets ANTHROPIC_API_KEY=finn-anthropic-key:latest
```

## Atualizar depois de mudanças

```bash
gcloud builds submit --config cloudbuild.yaml
gcloud run jobs execute finn-migrate --region "$REGION" --wait
gcloud run deploy finn-api --image "$IMAGE/api:latest" --region "$REGION"
```

A tela atualiza sozinha a cada push no GitHub.

## Decisões deste desenho

- **No máximo uma instância da API:** o limite de tentativas de login fica na memória do processo.
  Com duas instâncias, cada uma contaria separado.
- **`TRUST_PROXY=1`:** a API identifica o IP pelo último salto antes do Google. Pela Vercel, isso é o
  IP da Vercel, então o limite de login vale para todo o tráfego que passa por ela. Para uso pessoal,
  é o mais seguro: quem chamar o Cloud Run direto não consegue falsificar o próprio IP para fugir do
  limite. O custo é que alguém pode bloquear o seu login por 15 minutos errando a senha pela Vercel.
- **Cadastro fechado:** com `SIGNUP_ALLOWED_EMAILS`, só os e-mails da lista criam conta. Vazio, o
  cadastro fica aberto para qualquer pessoa com o link.
- **Banco no Neon:** o plano gratuito suspende o banco após alguns minutos sem uso, e a primeira
  consulta depois disso demora um pouco mais.

## Quando algo dá errado

| Sintoma                                        | Causa provável                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `PERMISSION_DENIED` no `gcloud builds submit`  | A conta de serviço do Cloud Build não pode gravar no Artifact Registry: dê a ela o papel `roles/artifactregistry.writer` |
| A API não sobe e o log cita uma variável       | Segredo faltando ou sem permissão de leitura (passo 3)                                                                   |
| A tela abre, mas o login falha com erro 404    | O endereço em `vercel.json` está errado ou ficou o texto de exemplo                                                      |
| Login funciona, mas a sessão cai em 15 minutos | A tela está sendo acessada por outro endereço que não o da Vercel                                                        |
| Exportação grande falha no meio                | Limite de tempo do repasse da Vercel; exporte por mês                                                                    |

Os logs da API ficam em Cloud Run → `finn-api` → Registros.
