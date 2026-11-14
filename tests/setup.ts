import { getTestDatabaseUrl } from "./test-database";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = getTestDatabaseUrl();
process.env.JWT_SECRET = "chave-usada-somente-nos-testes-automatizados";
process.env.LOGIN_RATE_LIMIT_MAX ??= "1000";
// Vazia de propósito: nenhum teste pode chamar a API real, mesmo com a chave no .env.
process.env.ANTHROPIC_API_KEY = "";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
