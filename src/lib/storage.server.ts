type StorageConfig = { url: string; key: string; bucket: string };
export function storageConfig(): StorageConfig | null {
  const url = process.env["SUPABASE_URL"]?.trim();
  const key = process.env["SUPABASE_SECRET_KEY"]?.trim();
  const bucket = process.env["SUPABASE_STORAGE_BUCKET"]?.trim();
  if (!url || !key || !bucket) return null;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !/^[a-zA-Z0-9_-]+$/.test(bucket)) {
    throw new Error("Private document storage settings are invalid.");
  }
  if (!key.startsWith("sb_secret_")) {
    throw new Error("Private document storage requires a Supabase secret key (sb_secret_...).");
  }
  return { url: parsed.origin, key, bucket };
}
export async function storageCall(config: StorageConfig, path: string, init: RequestInit = {}, f: typeof fetch = fetch) {
  const headers = new Headers(init.headers);
  // New Supabase Secret API keys (sb_secret_...) authenticate solely via apikey and must never be sent as JWT Bearer headers.
  headers.delete("Authorization");
  headers.set("apikey", config.key);
  const r = await f(`${config.url}/storage/v1${path}`, { ...init, headers, signal: AbortSignal.timeout(15000) });
  if (!r.ok) { console.error("Private storage request failed",r.status); throw new Error(`Document storage request failed (${r.status}). Check the private bucket settings.`); }
  return r;
}
export async function privateStorage(f: typeof fetch = fetch) {
  const c = storageConfig();
  if (!c) throw new Error("Private document storage needs configuring. Set the Supabase URL, server key and private bucket.");
  const bucket = await (await storageCall(c,`/bucket/${encodeURIComponent(c.bucket)}`,{},f)).json() as { public?: boolean };
  if (bucket.public !== false) throw new Error("Resident documents require a private bucket. Turn off public access first.");
  return c;
}
export const objectPath = (bucket: string, path: string) => `/object/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`;