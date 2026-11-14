# Deploy do Finn

> Prefere não manter um servidor? Veja [Vercel, Cloud Run e Neon](DEPLOY-NUVEM.md).

O projeto sobe com Docker Compose em qualquer servidor Linux com Docker. São quatro serviços:

| Serviço   | Função                                                                     |
| --------- | -------------------------------------------------------------------------- |
| `db`      | PostgreSQL com volume persistente.                                         |
| `migrate` | Roda uma vez a cada subida: aplica as migrations e o seed, depois encerra. |
| `api`     | API Express. Só sobe depois do `migrate` e não fica exposta na internet.   |
| `web`     | nginx: entrega o frontend e encaminha `/api` para a `api`.                 |

## Primeira subida

1. Aponte o domínio para o servidor e clone o repositório nele.
2. Crie a configuração e preencha todos os valores:

   ```bash
   cp .env.production.example .env.production
   ```

3. Suba tudo:

   ```bash
   docker compose --env-file .env.production up -d --build
   ```

4. Confira a saúde da aplicação:

   ```bash
   curl http://localhost:8080/api/health
   ```

## HTTPS é obrigatório

Em produção o cookie de sessão é `Secure`, e o navegador só o aceita por HTTPS. Sem HTTPS, o login
funciona até o token de acesso expirar ou a página ser recarregada.

Coloque um proxy HTTPS na frente da porta `WEB_PORT`, como Caddy, Traefik ou o balanceador do seu
provedor. Com um proxy à frente, use `TRUST_PROXY=2`: o valor errado faz o limite de tentativas
contar todos os usuários como um só IP, ou permite falsificar o IP.

Exemplo com Caddy, que emite o certificado sozinho:

```text
finn.seudominio.com.br {
    reverse_proxy localhost:8080
}
```

## Atualizar

```bash
git pull
docker compose --env-file .env.production up -d --build
```

## Backup

O volume `db-data` é o único dado que importa. Agende um dump e guarde-o fora do servidor:

```bash
docker compose --env-file .env.production exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > finn-backup.sql
```

## Limitações conhecidas

- O limite de tentativas fica na memória do processo. Para rodar mais de uma réplica da `api`, use
  um armazenamento compartilhado, como Redis.
- Os logs saem em JSON na saída padrão. Veja-os com `docker compose logs -f api`.
