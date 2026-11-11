// Actual application handlers and SQL run against an isolated PostgreSQL WASM fixture.
// No Neon connection, cookies, Meta account, or production records are used.
// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { SCHEMA_STATEMENTS } from "../lib/schema";
import type { SessionUser } from "../lib/auth.server";

const fixture = vi.hoisted(() => ({ db: null as PGlite | null, user: null as SessionUser | null }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validator: ((v: any) => any) | undefined;
  const builder = { inputValidator: (validate: (v: any) => any) => { validator = validate; return builder; }, handler: (handler: (v: any) => unknown) => async (v: any = {}) => handler({ data: validator ? validator(v.data) : v.data, context: {} }) };
  return builder;
} }));
vi.mock("../lib/db.server", () => ({
  q: async (sql: string, params: unknown[] = []) => { if (!fixture.db) throw new Error("Fixture missing"); return (await fixture.db.query(sql, params)).rows; },
  tx: async (statements: { text: string; params?: unknown[] }[]) => {
    if (!fixture.db) throw new Error("Fixture missing");
    return fixture.db.transaction(async (db) => {
      const rows = []; for (const s of statements) rows.push((await db.query(s.text, s.params)).rows); return rows;
    });
  },
}));
vi.mock("../lib/auth.server", () => ({
  requireUser: async () => { if (!fixture.user) throw new Error("Please sign in again."); return fixture.user; },
  requireOwner: async () => { if (fixture.user?.role !== "owner") throw new Error("Only the owner can do this."); return fixture.user; },
  hashPassword: async () => "isolated-test-hash",
}));
import * as pg from "../lib/pg.functions";

const ids = { owner: "00000000-0000-4000-8000-000000000001", staff: "00000000-0000-4000-8000-000000000002", a: "00000000-0000-4000-8000-000000000003", b: "00000000-0000-4000-8000-000000000004" };
const owner: SessionUser = { id: ids.owner, email: "owner@example.invalid", full_name: "Fixture Owner", role: "owner", can_reverse: true, can_message: true, branch_ids: [] };
const staff: SessionUser = { ...owner, id: ids.staff, role: "staff", branch_ids: [ids.a] };
const query = async (sql: string, p: unknown[] = []) => { if (!fixture.db) throw new Error("Fixture missing"); return (await fixture.db.query<any>(sql, p)).rows; };
let residentA = "", residentB = "", bedA = "", roomA = "";

beforeAll(async () => {
  fixture.db = new PGlite();
  for (const sql of SCHEMA_STATEMENTS) if (!sql.startsWith("create extension")) await fixture.db.exec(sql);
  await query("insert into app_users (id,email,full_name,password_hash,role) values ($1,'owner@example.invalid','Owner','hash','owner'),($2,'staff@example.invalid','Staff','hash','staff')", [ids.owner, ids.staff]);
  await query("insert into branches (id,name) values ($1,'Allowed'),($2,'Forbidden')", [ids.a, ids.b]);
  await query("insert into staff_branches values ($1,$2)", [ids.staff, ids.a]);
  fixture.user = owner;
  await pg.createRoom({ data: { branchId: ids.a, roomNumber: "101", isAc: true, beds: 2, bedRent: 500000 } });
  await pg.createRoom({ data: { branchId: ids.b, roomNumber: "201", isAc: false, beds: 2, bedRent: 600000 } });
  const beds = await pg.vacantBeds();
  const a = beds.find((b) => b.branch_id === ids.a), b = beds.find((b) => b.branch_id === ids.b);
  if (!a || !b) throw new Error("Beds missing"); bedA = a.bed_id;
  roomA = (await query("select room_id from beds where id=$1", [bedA]))[0].room_id;
  const onboard = (bedId: string, name: string) => pg.onboardResident({ data: { name, mobile: "9876543210", bedId, joiningDate: "2026-11-01", monthlyRent: 500000, depositAgreed: 100000, depositPaid: 100000, method: "cash", idem: name } });
  residentA = (await onboard(bedA, "Allowed resident")).id;
  residentB = (await onboard(b.bed_id, "Forbidden resident")).id;
}, 60000);
afterAll(async () => { await fixture.db?.close(); });

describe("Phase 4 real handlers in isolated PostgreSQL", () => {
  it("applies the additive schema repeatedly without losing residents or money", async () => {
    const before = await query("select count(*) n from money_txns");
    for (const sql of SCHEMA_STATEMENTS) if (!sql.startsWith("create extension")) await fixture.db?.exec(sql);
    expect((await query("select count(*) n from residents"))[0].n).toBe(2);
    expect((await query("select count(*) n from money_txns"))[0].n).toBe(before[0].n);
  });
  it("rejects signed-out server requests", async () => {
    fixture.user = null;
    await expect(pg.listBranches()).rejects.toThrow("sign in");
    await expect(pg.collectPayment({ data: { residentId: residentA, account: "rent", amount: 100, method: "cash", date: "2026-11-04", idem: "unauth" } })).rejects.toThrow("sign in");
  });
  it("filters branches, rooms, vacancies, residents, dashboard and payments for staff", async () => {
    fixture.user = staff;
    expect((await pg.listBranches()).map((r: any) => r.id)).toEqual([ids.a]);
    expect((await pg.listRooms({ data: {} })).every((r: any) => r.branch_id === ids.a)).toBe(true);
    expect((await pg.vacantBeds()).every((r) => r.branch_id === ids.a)).toBe(true);
    expect((await pg.listResidents({ data: {} })).map((r: any) => r.id)).toEqual([residentA]);
    expect((await pg.getDashboard({ data: {} })).activeResidents).toBe(1);
    expect((await pg.listTxns({ data: { month: "2026-11-01" } })).every((r) => r.resident_id === residentA)).toBe(true);
  });
  it("blocks direct cross-branch reads, payments, charges, rooms, and transfers", async () => {
    fixture.user = staff;
    await expect(pg.getResident({ data: { id: residentB } })).rejects.toThrow("access");
    await expect(pg.listRooms({ data: { branchId: ids.b } })).rejects.toThrow("access");
    await expect(pg.getDashboard({ data: { branchId: ids.b } })).rejects.toThrow("access");
    await expect(pg.collectPayment({ data: { residentId: residentB, amount: 100, account: "rent", method: "cash", date: "2026-11-04", idem: "forbidden" } })).rejects.toThrow("access");
    await expect(pg.addCharges({ data: { residentIds: [residentB], amount: 100, description: "Forbidden", mode: "each" } })).rejects.toThrow("access");
    await expect(pg.changeRoom({ data: { residentId: residentB, bedId: bedA, date: "2026-11-04", monthlyRent: 500000 } })).rejects.toThrow("access");
  });
  it("unassigned staff see no branch data", async () => {
    fixture.user = { ...staff, branch_ids: [] };
    expect(await pg.listBranches()).toEqual([]);
    expect(await pg.listResidents({ data: {} })).toEqual([]);
    expect((await pg.getDashboard({ data: {} })).beds.total).toBe(0);
  });
  it("preserves immediate due-day updates and after-day charge rollover", async () => {
    fixture.user = owner;
    await pg.saveSettings({ data: { pg_name: "Fixture", default_due_day: 1, timezone: "Asia/Kolkata" } });
    expect((await query("select due_date::text as due from bills where resident_id=$1 and billing_month='2026-11-01'", [residentA]))[0].due).toBe("2026-11-01");
    expect((await pg.listResidents({ data: {} })).find((r: any) => r.id === residentA)?.overdue).toBe(true);
    await pg.addCharges({ data: { residentIds: [residentA], amount: 10000, description: "Electricity", mode: "each" } });
    expect((await query("select b.billing_month::text as month from bill_lines l join bills b on b.id=l.bill_id where l.description='Electricity'"))[0].month).toBe("2026-12-01");
  });
  it("generates one bill and one rent line per eligible resident", async () => {
    fixture.user = owner;
    await pg.generateBills({ data: { month: "2026-11-01" } });
    await pg.generateBills({ data: { month: "2026-11-01" } });
    expect((await query("select count(*) n from bills where resident_id=$1 and billing_month='2026-11-01'", [residentA]))[0].n).toBe(1);
    expect((await query("select count(*) n from bill_lines l join bills b on b.id=l.bill_id where b.resident_id=$1 and b.billing_month='2026-11-01' and l.kind='rent'", [residentA]))[0].n).toBe(1);
  });
  it("payments are idempotent and FIFO retains correct outstanding", async () => {
    fixture.user = owner;
    const data = { residentId: residentA, amount: 200000, account: "rent" as const, method: "cash", date: "2026-11-04", idem: "payment-once" };
    await pg.collectPayment({ data });
    expect((await pg.collectPayment({ data })).duplicate).toBe(true);
    const resident = await pg.getResident({ data: { id: residentA } });
    expect(resident.outstanding).toBe(310000);
    expect(resident.bills.find((b: any) => b.billing_month === "2026-11-01")?.paid).toBe(200000);
    await expect(pg.collectPayment({ data: { ...data, amount: -1, idem: "negative" } })).rejects.toThrow();
  });
  it("blocks occupied bed removal and room archive; pricing does not alter agreed rent", async () => {
    fixture.user = owner;
    await expect(pg.updateBed({ data: { action: "remove", bedId: bedA } })).rejects.toThrow("occupied");
    await expect(pg.archiveRoom({ data: { roomId: roomA } })).rejects.toThrow("residents");
    await pg.updateBed({ data: { action: "rent", bedId: bedA, bedRent: 900000 } });
    expect((await query("select monthly_rent from allocations where resident_id=$1 and end_date is null", [residentA]))[0].monthly_rent).toBe(500000);
  });
  it("database append-only triggers reject financial changes", async () => {
    await expect(query("update money_txns set amount=1")).rejects.toThrow("append-only");
    await expect(query("delete from bill_lines")).rejects.toThrow("append-only");
  });
  it("staff sending needs permission and sessions never reveal other branches", async () => {
    fixture.user = owner;
    const template = (await pg.listWaTemplates({ data: {} }))[0];
    const session = await pg.createWaSession({ data: { month: "2026-11-01", category: "all", templateId: template.id, residentIds: [residentA, residentB], method: "MANUAL_WHATSAPP", idem: "mixed" } });
    fixture.user = staff;
    await expect(pg.getWaSession({ data: { id: session.id } })).rejects.toThrow("access");
    expect(await pg.listWaSessions({ data: {} })).toEqual([]);
    const preview = await pg.previewWaRecipients({ data: { month: "2026-11-01", category: "all", templateId: template.id } });
    expect(preview.rows.map((r) => r.id)).toEqual([residentA]);
    fixture.user = { ...staff, can_message: false };
    await expect(pg.previewWaRecipients({ data: { month: "2026-11-01", category: "all", templateId: template.id } })).rejects.toThrow("permission");
  });
  it("rejects automated sending even if requested directly", async () => {
    fixture.user = owner;
    const template = (await pg.listWaTemplates({ data: {} }))[0];
    await expect(pg.createWaSession({ data: { month: "2026-11-01", category: "all", templateId: template.id, residentIds: [residentA], method: "WHATSAPP_CLOUD_API", idem: "blocked-api" } })).rejects.toThrow("manual");
  });
  it("serial checkout frees the bed and a duplicate checkout is rejected", async () => {
    fixture.user = owner;
    await pg.checkoutResident({ data: { residentId: residentB, date: "2026-11-04", deductions: [], applyDeposit: false } });
    const after = await pg.getResident({ data: { id: residentB } });
    expect(after.resident.status).toBe("checked_out");
    expect(after.depositHeld).toBe(100000);
    expect(after.current).toBeNull();
    await expect(pg.checkoutResident({ data: { residentId: residentB, date: "2026-11-04", deductions: [], applyDeposit: false } })).rejects.toThrow("not active");
    await pg.recordRefund({ data: { residentId: residentB, account: "deposit", amount: 40000, method: "cash", date: "2026-11-04", idem: "partial-refund" } });
    expect((await pg.getResident({ data: { id: residentB } })).depositHeld).toBe(60000);
  });
});