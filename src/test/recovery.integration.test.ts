// Owner recovery-code reset against real handlers, real hashing and an isolated PostgreSQL fixture.
// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { SCHEMA_STATEMENTS } from "../lib/schema";

const fixture = vi.hoisted(() => ({ db: null as PGlite | null, user: null as any }));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: ((v: any) => any) | undefined;
    const builder = {
      middleware: () => builder,
      inputValidator: (validate: (v: any) => any) => {
        validator = validate;
        return builder;
      },
      handler:
        (handler: (v: any) => unknown) =>
        async (input: { data?: unknown } = {}) =>
          handler({ data: validator ? validator(input.data) : input.data }),
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  getCookie: () => undefined,
  setCookie: () => undefined,
  deleteCookie: () => undefined,
}));
vi.mock("../lib/db.server", () => ({
  q: async (sql: string, params: unknown[] = []) =>
    (await fixture.db!.query(sql, params)).rows,
  tx: async (statements: { text: string; params?: unknown[] }[]) =>
    fixture.db!.transaction(async (db) => {
      const rows = [];
      for (const s of statements) rows.push((await db.query(s.text, s.params ?? [])).rows);
      return rows;
    }),
}));
vi.mock("../lib/auth.server", async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    requireOwner: async () => {
      if (!fixture.user || fixture.user.role !== "owner") throw new Error("Only the owner can do this.");
      return fixture.user;
    },
  };
});

import { createRecoveryCode, getRecoveryStatus, resetWithRecoveryCode } from "../lib/auth.functions";
import { hashPassword, verifyPassword } from "../lib/auth.server";

const OWNER = "00000000-0000-4000-8000-000000000021";
const STAFF = "00000000-0000-4000-8000-000000000022";
const query = async (sql: string, p: unknown[] = []) => (await fixture.db!.query<any>(sql, p)).rows;
const reset = (email: string, code: string, password = "brandnew99") =>
  resetWithRecoveryCode({ data: { email, code, password } });

let code = "";

beforeAll(async () => {
  fixture.db = new PGlite();
  for (const sql of SCHEMA_STATEMENTS)
    if (!sql.startsWith("create extension")) await fixture.db.exec(sql);
  await query(
    "insert into app_users (id,email,full_name,password_hash,role) values ($1,'owner@example.invalid','Owner',$3,'owner'),($2,'staff@example.invalid','Staff',$3,'staff')",
    [OWNER, STAFF, await hashPassword("oldsecret1")],
  );
}, 60_000);
afterAll(async () => {
  await fixture.db?.close();
});
beforeEach(async () => {
  await query("delete from recovery_attempts");
  await query("update app_users set password_hash=$2 where id=$1", [OWNER, await hashPassword("oldsecret1")]);
  await query("insert into sessions values ('s-'||gen_random_uuid(), $1, now() + interval '1 day')", [OWNER]);
  fixture.user = { id: OWNER, role: "owner" };
  code = (await createRecoveryCode({ data: { password: "oldsecret1" } })).recoveryCode;
});

describe("creating a recovery code", () => {
  it("needs the signed-in owner and their current password", async () => {
    await expect(createRecoveryCode({ data: { password: "wrong-pass" } })).rejects.toThrow(
      "Current password is wrong.",
    );
    fixture.user = { id: STAFF, role: "staff" };
    await expect(createRecoveryCode({ data: { password: "oldsecret1" } })).rejects.toThrow("Only the owner");
    fixture.user = null;
    await expect(createRecoveryCode({ data: { password: "oldsecret1" } })).rejects.toThrow();
  });
  it("stores only a hash and the status never reveals the code", async () => {
    const row = (await query("select recovery_code_hash h from app_users where id=$1", [OWNER]))[0];
    expect(row.h).toMatch(/^[a-f0-9]{64}$/);
    expect(row.h).not.toContain(code.replace(/-/g, ""));
    const status = await getRecoveryStatus();
    expect(status.hasCode).toBe(true);
    expect(JSON.stringify(status)).not.toContain(code);
  });
});

describe("resetting with a recovery code", () => {
  it("changes the password, ends all sessions and returns a new code", async () => {
    const r = await reset("OWNER@example.invalid ", code.toLowerCase());
    expect(r.recoveryCode).not.toBe(code);
    const u = (await query("select password_hash from app_users where id=$1", [OWNER]))[0];
    expect(await verifyPassword("brandnew99", u.password_hash)).toBe(true);
    expect(await verifyPassword("oldsecret1", u.password_hash)).toBe(false);
    expect((await query("select 1 from sessions where user_id=$1", [OWNER])).length).toBe(0);
  });
  it("refuses to reuse a code (replay) but accepts the replacement", async () => {
    const r = await reset("owner@example.invalid", code);
    await expect(reset("owner@example.invalid", code, "another99")).rejects.toThrow("don't match");
    await expect(reset("owner@example.invalid", r.recoveryCode, "another99")).resolves.toMatchObject({ ok: true });
  });
  it("rejects a wrong code without touching password or sessions", async () => {
    await expect(reset("owner@example.invalid", "AAAA-AAAA-AAAA-AAAA-AAAA-AAAA")).rejects.toThrow("don't match");
    const u = (await query("select password_hash from app_users where id=$1", [OWNER]))[0];
    expect(await verifyPassword("oldsecret1", u.password_hash)).toBe(true);
    expect((await query("select 1 from sessions where user_id=$1", [OWNER])).length).toBeGreaterThan(0);
  });
  it("does not work for staff accounts or unknown emails", async () => {
    await expect(reset("staff@example.invalid", code)).rejects.toThrow("don't match");
    await expect(reset("nobody@example.invalid", code)).rejects.toThrow("don't match");
  });
  it("rejects a weak new password", async () => {
    await expect(reset("owner@example.invalid", code, "short")).rejects.toThrow("at least 8");
  });
  it("locks the email after 5 wrong guesses, even with the right code", async () => {
    for (let i = 0; i < 5; i++)
      await expect(reset("owner@example.invalid", "BBBB-BBBB-BBBB-BBBB-BBBB-BBBB")).rejects.toThrow("don't match");
    await expect(reset("owner@example.invalid", code)).rejects.toThrow("Too many wrong attempts");
  });
});
