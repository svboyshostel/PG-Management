import { createServerFn } from "@tanstack/react-start";
import { q, tx } from "./db.server";
import { SCHEMA_STATEMENTS } from "./schema";
import {
  createSession,
  currentUser,
  destroySession,
  hashPassword,
  requireOwner,
  sha256Hex,
  verifyPassword,
} from "./auth.server";
import { loginInput, recoveryResetInput } from "./validation";
import {
  RECOVERY_MAX_GLOBAL_FAILS,
  RECOVERY_WINDOW_MINUTES,
  attemptsAllowed,
  generateRecoveryCode,
  normalizeRecoveryCode,
  passwordProblem,
  recoveryHashInput,
} from "./reset";

export const getAppStatus = createServerFn({ method: "GET" }).handler(async () => {
  if (!process.env["DATABASE_URL"])
    return { db: false as const, schema: false, hasOwner: false, user: null };
  try {
    const t = await q<any>(`select to_regclass('public.app_users') is not null as ok`);
    if (!t[0]?.ok) return { db: true as const, schema: false, hasOwner: false, user: null };
    const o = await q<any>(`select count(*) as n from app_users where role = 'owner'`);
    return {
      db: true as const,
      schema: true,
      hasOwner: Number(o[0].n) > 0,
      user: await currentUser(),
    };
  } catch (e) {
    console.error(e);
    return {
      db: true as const,
      schema: false,
      hasOwner: false,
      user: null,
      error: "Could not reach the database. Check DATABASE_URL.",
    };
  }
});

export const runSetup = createServerFn({ method: "POST" })
  .inputValidator((d: { pgName: string; fullName: string; email: string; password: string }) => {
    if (!d.pgName?.trim() || !d.fullName?.trim())
      throw new Error("PG name and your name are required.");
    if (!/^\S+@\S+\.\S+$/.test(d.email ?? "")) throw new Error("Enter a valid email.");
    if ((d.password ?? "").length < 8) throw new Error("Password must be at least 8 characters.");
    return d;
  })
  .handler(async ({ data }) => {
    const exists = (
      await q<{ ok: boolean }>("select to_regclass('public.app_users') is not null as ok")
    )[0]?.ok;
    if (exists && (await q("select id from app_users where role='owner' limit 1")).length)
      throw new Error("Setup is already complete. Please sign in.");
    for (const s of SCHEMA_STATEMENTS) await q(s);
    const id = crypto.randomUUID();
    const result = await tx([
      { text: "select id from settings where id=1 for update" },
      {
        text: `insert into app_users (id, email, full_name, password_hash, role, can_reverse)
          select $1,$2,$3,$4,'owner',true where not exists (select 1 from app_users where role='owner') returning id`,
        params: [
          id,
          data.email.toLowerCase().trim(),
          data.fullName.trim(),
          await hashPassword(data.password),
        ],
      },
      {
        text: "update settings set pg_name=$2 where id=1 and exists (select 1 from app_users where id=$1)",
        params: [id, data.pgName.trim()],
      },
    ]);
    if (!result[1]?.length) throw new Error("Setup is already complete. Please sign in.");
    const recoveryCode = await issueRecoveryCode(id);
    await createSession(id);
    // Shown once on the setup screen; only its hash is kept.
    return { ok: true, recoveryCode };
  });

/** Re-applies the idempotent schema (safe to run after app updates). Owner only once set up. */
export const upgradeSchema = createServerFn({ method: "POST" }).handler(async () => {
  const u = await currentUser();
  if (!u || u.role !== "owner") throw new Error("Only the owner can do this.");
  for (const s of SCHEMA_STATEMENTS) await q(s);
  return { ok: true };
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => loginInput.parse(d))
  .handler(async ({ data }) => {
    const rows = await q<{ id: string; password_hash: string; is_active: boolean }>(
      `select id, password_hash, is_active from app_users where email = $1`,
      [
        String(data.email ?? "")
          .toLowerCase()
          .trim(),
      ],
    );
    const u = rows[0];
    if (!u || !u.is_active || !(await verifyPassword(String(data.password ?? ""), u.password_hash)))
      throw new Error("Wrong email or password.");
    await createSession(u.id);
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await destroySession();
  return { ok: true };
});

// ---------- owner password recovery with a one-time recovery code (no email) ----------

/** Creates a new code, stores only its hash (replacing any old one) and returns the plain code once. */
async function issueRecoveryCode(userId: string): Promise<string> {
  const code = generateRecoveryCode();
  const hash = await sha256Hex(recoveryHashInput(userId, normalizeRecoveryCode(code)!));
  await q(
    `update app_users set recovery_code_hash = $2, recovery_code_created_at = now() where id = $1`,
    [userId, hash],
  );
  return code;
}

function sameText(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Owner only: whether a recovery code exists (never the code itself). */
export const getRecoveryStatus = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireOwner();
  const row = (
    await q<{ created_at: string | null }>(
      `select recovery_code_created_at as created_at from app_users where id = $1`,
      [u.id],
    )
  )[0];
  return { hasCode: !!row?.created_at, createdAt: row?.created_at ?? null };
});

/** Owner only, signed in, and must re-enter the current password. Replaces any previous code. */
export const createRecoveryCode = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({ password: String(d?.password ?? "").slice(0, 200) }))
  .handler(async ({ data }) => {
    const u = await requireOwner();
    const row = (
      await q<{ password_hash: string }>(`select password_hash from app_users where id = $1`, [u.id])
    )[0];
    if (!row || !(await verifyPassword(data.password, row.password_hash)))
      throw new Error("Current password is wrong.");
    return { recoveryCode: await issueRecoveryCode(u.id) };
  });

const WRONG = "That email and recovery code don't match.";

/**
 * Forgot password for the owner: email + recovery code + new password.
 * On success the password changes, every session ends, the used code stops working
 * and a replacement code is returned once.
 */
export const resetWithRecoveryCode = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; code: string; password: string }) =>
    recoveryResetInput.parse(d),
  )
  .handler(async ({ data }) => {
    const pwProblem = passwordProblem(data.password);
    if (pwProblem) throw new Error(pwProblem);
    const email = data.email.toLowerCase().trim();
    const win = String(RECOVERY_WINDOW_MINUTES);

    const fails = await q<{ mine: string; all: string }>(
      `select count(*) filter (where email = $1) as mine, count(*) as all
       from recovery_attempts where not ok and created_at > now() - ($2 || ' minutes')::interval`,
      [email, win],
    );
    if (
      !attemptsAllowed(Number(fails[0]?.mine ?? 0)) ||
      !attemptsAllowed(Number(fails[0]?.all ?? 0), RECOVERY_MAX_GLOBAL_FAILS)
    )
      throw new Error(
        `Too many wrong attempts. Please wait ${RECOVERY_WINDOW_MINUTES} minutes and try again.`,
      );

    // Count this attempt as failed up front, so parallel guesses can't skip the limit.
    const attempt = (
      await q<{ id: string }>(`insert into recovery_attempts (email) values ($1) returning id`, [
        email,
      ])
    )[0]!;

    const user = (
      await q<{ id: string; recovery_code_hash: string | null }>(
        `select id, recovery_code_hash from app_users where email = $1 and role = 'owner' and is_active`,
        [email],
      )
    )[0];
    const normalized = normalizeRecoveryCode(data.code);
    const given =
      user && normalized ? await sha256Hex(recoveryHashInput(user.id, normalized)) : "";
    if (!user?.recovery_code_hash || !given || !sameText(given, user.recovery_code_hash))
      throw new Error(WRONG);

    const next = generateRecoveryCode();
    const nextHash = await sha256Hex(recoveryHashInput(user.id, normalizeRecoveryCode(next)!));
    // Swap only if the code is still the one we checked: a replayed or parallel use changes nothing.
    const out = await tx([
      {
        text: `update app_users set password_hash = $3, recovery_code_hash = $4, recovery_code_created_at = now()
               where id = $1 and recovery_code_hash = $2 returning id`,
        params: [user.id, given, await hashPassword(data.password), nextHash],
      },
      {
        text: `delete from sessions where user_id = $1
               and exists (select 1 from app_users where id = $1 and recovery_code_hash = $2)`,
        params: [user.id, nextHash],
      },
    ]);
    if (!out[0]?.length) throw new Error(WRONG);
    await q(`update recovery_attempts set ok = true where id = $1`, [attempt.id]);
    return { ok: true, recoveryCode: next };
  });
