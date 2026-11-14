type Environment = Record<string, string | undefined>;

/**
 * Usa DATABASE_URL quando existe. Senão, monta a URL a partir das partes, codificando cada uma:
 * uma senha com @, :, / ou # quebraria a URL se fosse colada direto.
 */
export const resolveDatabaseUrl = (env: Environment = process.env): string | undefined => {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const { POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = env;
  if (!POSTGRES_HOST || !POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) return undefined;

  const credentials = `${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(POSTGRES_PASSWORD)}`;
  const address = `${POSTGRES_HOST}:${env.POSTGRES_PORT ?? "5432"}`;
  return `postgresql://${credentials}@${address}/${encodeURIComponent(POSTGRES_DB)}?schema=public`;
};
