import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// One portable driver (HTTP over fetch) that runs on Lovable hosting, Cloudflare and Vercel.
// The connection string comes only from the DATABASE_URL environment variable.
export function db(): NeonQueryFunction<false, false> {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set. Add your Neon connection string as DATABASE_URL.");
  return neon(url);
}

export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db().query(text, params)) as T[];
}

/** Run several statements in one atomic transaction. */
export async function tx(stmts: { text: string; params?: unknown[] }[]) {
  const sql = db();
  return sql.transaction(stmts.map((s) => sql.query(s.text, s.params ?? [])));
}
