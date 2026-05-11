import postgres from 'npm:postgres@3.4.7';

type SqlLike = ReturnType<typeof postgres>;

export type DbClient = {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
};

const connectionString = Deno.env.get('DATABASE_URL');

if (!connectionString) {
  throw new Error('DATABASE_URL secret is required');
}

const connectionLimit = Number(Deno.env.get('DB_CONNECTION_LIMIT') ?? '3');

const sql = postgres(connectionString, {
  max: Number.isFinite(connectionLimit) ? connectionLimit : 3,
  idle_timeout: 5,
  connect_timeout: 30,
  prepare: false,
});

const createDbClient = (executor: SqlLike): DbClient => ({
  async query<T>(text: string, params: unknown[] = []) {
    const rows = await executor.unsafe(text, params);
    return rows as T[];
  },
});

export const db = createDbClient(sql);

export const withTransaction = async <T>(handler: (client: DbClient) => Promise<T>) =>
  sql.begin(async (transaction) => handler(createDbClient(transaction as SqlLike)));
