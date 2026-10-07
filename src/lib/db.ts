import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const runtimeEnv = import.meta.env as Record<string, string | undefined>;
const store = globalThis as unknown as { __lunyntSql?: Sql };

export function databaseUrl(): string | undefined {
  return (
    runtimeEnv.POSTGRES_URL ??
    runtimeEnv.POSTGRES_URL_NON_POOLING ??
    runtimeEnv.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL
  );
}

export function getSql(url: string): Sql {
  if (!store.__lunyntSql) {
    store.__lunyntSql = postgres(url, {
      prepare: false,
      max: 1,
      idle_timeout: 20,
    });
  }

  return store.__lunyntSql;
}

export type { Sql };
