import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { q } from "./db.server";

const COOKIE = "pg_session";
const enc = new TextEncoder();

const toHex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new Uint8Array((h.match(/.{2}/g) ?? []).map((x) => parseInt(x, 16)));

export async function hashPassword(pw: string, saltHex?: string) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
    key,
    256,
  );
  return `pbkdf2$${toHex(salt.buffer as ArrayBuffer)}$${toHex(bits)}`;
}

export async function verifyPassword(pw: string, stored: string) {
  if (!/^pbkdf2\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(stored)) return false;
  const [, salt] = stored.split("$");
  if (!salt) return false;
  const actual = await hashPassword(pw, salt);
  let diff = actual.length ^ stored.length;
  for (let i = 0; i < stored.length; i++) diff |= actual.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}

export async function sha256Hex(s: string) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

/** 32 random bytes as 64 hex characters — used for session and reset tokens. */
export function randomToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer);
}

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "staff";
  can_reverse: boolean;
  can_message: boolean;
  branch_ids: string[];
};

export async function createSession(userId: string) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer);
  await q(
    `insert into sessions (token_hash, user_id, expires_at) values ($1,$2, now() + interval '30 days')`,
    [await sha256Hex(token), userId],
  );
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const t = getCookie(COOKIE);
  if (t) await q(`delete from sessions where token_hash = $1`, [await sha256Hex(t)]);
  deleteCookie(COOKIE, { path: "/" });
}

export async function currentUser(): Promise<SessionUser | null> {
  const t = getCookie(COOKIE);
  if (!t) return null;
  const rows = await q<SessionUser>(
    `select u.id, u.email, u.full_name, u.role, u.can_reverse, coalesce((to_jsonb(u)->>'can_message')::boolean, false) as can_message from sessions s join app_users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now() and u.is_active`,
    [await sha256Hex(t)],
  );
  const user = rows[0];
  if (!user) return null;
  let branch_ids: string[] = [];
  if (user.role === "staff") {
    // Older installations deny staff access until the additive migration is applied.
    const exists = (
      await q<{ ok: boolean }>("select to_regclass('public.staff_branches') is not null as ok")
    )[0]?.ok;
    if (exists)
      branch_ids = (
        await q<{ branch_id: string }>("select branch_id from staff_branches where user_id=$1", [
          user.id,
        ])
      ).map((r) => r.branch_id);
  }
  return { ...user, branch_ids };
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Error("Please sign in again.");
  return u;
}

export async function requireOwner() {
  const u = await requireUser();
  if (u.role !== "owner") throw new Error("Only the owner can do this.");
  return u;
}
