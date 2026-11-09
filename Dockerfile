# Etapa com todas as dependências: compila e gera o cliente Prisma.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npm ci
RUN npm run build

# Imagem de uso único: aplica as migrations e o seed antes de a API subir.
FROM build AS migrate
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# Dependências de produção, sem scripts: o postinstall exige o CLI do Prisma.
FROM node:24-alpine AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Imagem final: sem compilador, sem código-fonte e sem usuário root.
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/generated ./generated
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3333) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server.js"]
