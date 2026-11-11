import { assertBranchAccess, branchScope } from "./access";
import { requireEntityAccess, requireSessionAccess, requireRecipientAccess } from "./access.server";
import type { SessionUser } from "./auth.server";
import { calendarDate, calendarMonth, paymentInput } from "./validation";
import { createServerFn } from "@tanstack/react-start";
import { q, tx } from "./db.server";
import { requireOwner as _requireOwner, requireUser as _requireUser, hashPassword } from "./auth.server";
import { applyFifo, splitEqual, inr } from "./money";
import { mergeHistory, visibleHistory, canViewFullMessage, type HistoryEntry, canSendMessages, validateTemplate, RECIPIENT_CATEGORIES, renderTemplate, breakdownText, waNumber, payStatus, isOverdue, matchesCategory, findDuplicates, methodError, progress, nextStatus, sessionAfter, logTypeForCategory, isGapLimited, type RecipientStatus } from "./wa";
import { pgToday, monthOf, chargeMonthFor, clampDueDay, planCapacity, depositStatus, normalizeIdProof, billBreakdown, bedLabel, MAX_SHARING, CATEGORIES } from "./rules";

// PG clock: today's date in the PG timezone (refreshed from settings on every authenticated call).
let TZ = "Asia/Kolkata";
async function loadTz() {
  try { TZ = (await q<any>(`select timezone from settings where id=1`))[0]?.timezone || TZ; } catch { /* settings not created yet */ }
}
const todayPg = () => pgToday(TZ);
const monthStart = () => monthOf(todayPg());
const sqlDate = (d: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("bad date"); return `'${d}'::date`; };
async function requireUser() { const u = await _requireUser(); await loadTz(); return u; }
async function requireOwner() { const u = await _requireOwner(); await loadTz(); return u; }

const num = (v: unknown) => Number(v ?? 0);
const req = (v: unknown, msg: string) => {
  if (v === undefined || v === null || String(v).trim() === "") throw new Error(msg);
  return String(v).trim();
};
const paise = (v: unknown, msg = "Enter a valid amount.") => {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(msg);
  return n;
};
const isDate = (s: string) => calendarDate.safeParse(s).success;
const isMonth = (s: string) => calendarMonth.safeParse(s).success;
// Resident financial history is indivisible: mixed-branch history requires all those assignments.
const historyScope = (alias: string, parameter: number) => `($${parameter}::uuid[] is null or (
  not exists (select 1 from bills hb where hb.resident_id=${alias}.id and not (hb.branch_id = any($${parameter})))
  and not exists (select 1 from allocations ha join beds hd on hd.id=ha.bed_id join rooms hr on hr.id=hd.room_id where ha.resident_id=${alias}.id and not (hr.branch_id = any($${parameter})))
))`;

/* ---------------- Settings ---------------- */
const win = (v: any) => (v === "first_week" || v === "last_week" || v === "day" ? v : null);
export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  return (await q(`select * from settings where id = 1`))[0];
});

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    await requireOwner();
    const due = clampDueDay(data.default_due_day);
    const tz = String(data.timezone || "Asia/Kolkata");
    try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { throw new Error("Unknown timezone."); }
    await q(
      `update settings set pg_name=$1, phone=$2, address=$3, default_due_day=$4, timezone=$5 where id=1`,
      [req(data.pg_name, "PG name required"), data.phone ?? "", data.address ?? "", due, tz],
    );
    // The chosen due day applies right away to this month's and future bills, and to older bills not yet due this month.
    await q(
      `update bills b set due_date = case when r.joining_date > (b.billing_month + ($1::int - 1))
           then (b.billing_month + interval '1 month')::date + ($1::int - 1)
           else b.billing_month + ($1::int - 1) end
       from residents r where r.id=b.resident_id and (b.billing_month >= $2::date or b.due_date >= $2::date)`,
      [due, monthStart()],
    );
    return { ok: true };
  });

/** The overdue reminder gap belongs to messaging, so it is saved from the WhatsApp settings screen. */
export const saveWaReminderGap = createServerFn({ method: "POST" })
  .inputValidator((d: { days: number }) => d)
  .handler(async ({ data }) => {
    await requireOwner();
    const days = Number(data.days);
    if (!(days >= 1 && days <= 60)) throw new Error("Reminder gap must be 1–60 days.");
    await q(`update settings set overdue_cooldown_days=$1 where id=1`, [days]);
    return { ok: true, days };
  });

/* ---------------- Staff ---------------- */
export const listStaff = createServerFn({ method: "GET" }).handler(async () => {
  await requireOwner();
  return q(`select u.id, u.email, u.full_name, u.role, u.can_reverse, u.can_message, u.is_active,
    coalesce((select json_agg(sb.branch_id) from staff_branches sb where sb.user_id=u.id), '[]') as branch_ids
    from app_users u order by u.role, u.full_name`);
});

export const saveStaff = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; email?: string; full_name?: string; password?: string; can_reverse?: boolean; can_message?: boolean; is_active?: boolean; branchIds?: string[] }) => d)
  .handler(async ({ data }) => {
    const me = await requireOwner();
    const assignments = data.branchIds === undefined ? undefined : [...new Set(data.branchIds)];
    if (assignments) {
      const valid = await q("select id from branches where id = any($1::uuid[])", [assignments]);
      if (valid.length !== assignments.length) throw new Error("Choose valid branches.");
    }
    if (!data.id) {
      if (!/^\S+@\S+\.\S+$/.test(data.email ?? "")) throw new Error("Enter a valid email.");
      if ((data.password ?? "").length < 8) throw new Error("Password must be at least 8 characters.");
      const id = crypto.randomUUID();
      await tx([
        { text: `insert into app_users (id, email, full_name, password_hash, role, can_reverse, can_message) values ($1,$2,$3,$4,'staff',$5,$6)`, params: [id, String(data.email).toLowerCase().trim(), req(data.full_name, "Name required"), await hashPassword(String(data.password)), !!data.can_reverse, data.can_message === true] },
        ...(assignments ?? []).map((branch) => ({ text: "insert into staff_branches (user_id, branch_id) values ($1,$2)", params: [id, branch] })),
      ]);
      return { ok: true };
    }
    if (data.id === me.id && data.is_active === false) throw new Error("You can't deactivate yourself.");
    if (assignments) {
      const staff = await q("select id from app_users where id=$1 and role='staff'", [data.id]);
      if (!staff.length) throw new Error("Only staff can have branch assignments.");
      await tx([
        { text: "delete from staff_branches where user_id=$1", params: [data.id] },
        ...assignments.map((branch) => ({ text: "insert into staff_branches (user_id, branch_id) values ($1,$2)", params: [data.id, branch] })),
      ]);
    }
    if (data.password) {
      if (data.password.length < 8) throw new Error("Password must be at least 8 characters.");
      await tx([
        { text: `update app_users set password_hash=$2 where id=$1`, params: [data.id, await hashPassword(data.password)] },
        { text: `delete from sessions where user_id=$1`, params: [data.id] },
      ]);
    }
    if (data.can_reverse !== undefined) await q(`update app_users set can_reverse=$2 where id=$1 and role='staff'`, [data.id, data.can_reverse]);
    if (data.can_message !== undefined) await q(`update app_users set can_message=$2 where id=$1 and role='staff'`, [data.id, data.can_message]);
    if (data.is_active !== undefined) {
      await q(`update app_users set is_active=$2 where id=$1`, [data.id, data.is_active]);
      if (!data.is_active) await q(`delete from sessions where user_id=$1`, [data.id]);
    }
    return { ok: true };
  });

/* ---------------- Branches, rooms, beds ---------------- */
export const listBranches = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  return q(`select * from branches where ($1::uuid[] is null or id = any($1)) order by is_active desc, name`, [branchScope(u)]);
});

export const saveBranch = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; name: string; address?: string; due_day?: number | null; due_window?: string | null; is_active?: boolean }) => d)
  .handler(async ({ data }) => {
    await requireOwner();
    const due = data.due_day ? Number(data.due_day) : null;
    if (due !== null && !(due >= 1 && due <= 28)) throw new Error("Due day must be 1–28.");
    if (data.id)
      await q(`update branches set name=$2, address=$3, due_day=$4, is_active=$5, due_window=$6 where id=$1`, [data.id, req(data.name, "Name required"), data.address ?? "", due, data.is_active ?? true, win(data.due_window)]);
    else await q(`insert into branches (name, address, due_day, due_window) values ($1,$2,$3,$4)`, [req(data.name, "Name required"), data.address ?? "", due, win(data.due_window)]);
    return { ok: true };
  });

export const listRooms = createServerFn({ method: "GET" })
  .inputValidator((d: { branchId?: string | undefined }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    if (data.branchId) assertBranchAccess(u, data.branchId);
    return q(
      `select r.id, r.branch_id, br.name as branch_name, r.room_number, r.floor, r.is_ac,
        coalesce(json_agg(json_build_object('id', b.id, 'label', b.label, 'bed_rent', b.bed_rent,
          'resident_id', res.id, 'resident_name', res.name) order by b.label) filter (where b.id is not null), '[]') as beds
       from rooms r join branches br on br.id = r.branch_id
       left join beds b on b.room_id = r.id and b.is_active
       left join allocations a on a.bed_id = b.id and a.end_date is null
       left join residents res on res.id = a.resident_id
       where r.is_active and ($1::uuid is null or r.branch_id = $1) and ($2::uuid[] is null or r.branch_id = any($2))
       group by r.id, br.name order by br.name, r.room_number`,
      [data.branchId || null, branchScope(u)],
    );
  });

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((d: { branchId: string; roomNumber: string; floor?: string; isAc: boolean; beds: number; bedRent: number }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    assertBranchAccess(u, data.branchId);
    const n = Number(data.beds);
    if (!(Number.isInteger(n) && n >= 1 && n <= MAX_SHARING)) throw new Error(`Sharing must be 1–${MAX_SHARING}.`);
    const rent = paise(data.bedRent, "Enter the rent per bed.");
    const id = crypto.randomUUID();
    await tx([
      { text: `insert into rooms (id, branch_id, room_number, floor, is_ac) values ($1,$2,$3,$4,$5)`, params: [id, req(data.branchId, "Choose a branch"), req(data.roomNumber, "Room number required"), data.floor ?? "", !!data.isAc] },
      ...Array.from({ length: n }, (_, i) => ({ text: `insert into beds (room_id, label, bed_rent) values ($1,$2,$3)`, params: [id, bedLabel(i), rent] })),
    ]);
    return { ok: true };
  });

export const updateBed = createServerFn({ method: "POST" })
  .inputValidator((d: { bedId?: string; roomId?: string; bedRent?: number; action: "rent" | "add" | "remove" }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, data.action === "add" ? "room" : "bed", data.action === "add" ? data.roomId : data.bedId);
    if (data.action === "rent") await q(`update beds set bed_rent=$2 where id=$1`, [data.bedId, paise(data.bedRent)]);
    if (data.action === "add") {
      const count = (await q<{ n: string }>("select count(*) as n from beds where room_id=$1 and is_active", [data.roomId]))[0];
      if (Number(count?.n) >= MAX_SHARING) throw new Error(`Sharing must be 1–${MAX_SHARING}.`);
      const ex = await q<{ label: string }>(`select label from beds where room_id=$1`, [data.roomId]);
      const used = new Set(ex.map((e) => e.label));
      let i = 0; while (used.has(String.fromCharCode(65 + i))) i++;
      await q(`insert into beds (room_id, label, bed_rent) values ($1,$2,$3)`, [data.roomId, String.fromCharCode(65 + i), paise(data.bedRent ?? 0)]);
    }
    if (data.action === "remove") {
      const occ = await q(`select 1 from allocations where bed_id=$1 and end_date is null`, [data.bedId]);
      if (occ.length) throw new Error("This bed is occupied. Move the resident first.");
      await q(`update beds set is_active=false where id=$1`, [data.bedId]);
    }
    if (!["rent", "add", "remove"].includes(data.action)) throw new Error("Invalid bed action.");
    return { ok: true };
  });

/** Edit a room. Sharing changes add beds or remove VACANT beds only. Residents' agreed rent (allocations) is never touched. */
export const updateRoom = createServerFn({ method: "POST" })
  .inputValidator((d: { roomId: string; roomNumber: string; floor?: string; isAc: boolean; sharing: number; rentAll?: number | null; newBedRent?: number | null }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "room", data.roomId);
    const room = (await q<any>(`select id, branch_id from rooms where id=$1 and is_active`, [data.roomId]))[0];
    if (!room) throw new Error("Room not found.");
    const beds = await q<any>(
      `select b.id, b.label, b.bed_rent, exists(select 1 from allocations a where a.bed_id=b.id and a.end_date is null) as occupied
       from beds b where b.room_id=$1 and b.is_active order by b.label`, [data.roomId]);
    const all = await q<{ label: string }>(`select label from beds where room_id=$1`, [data.roomId]);
    // Labels of archived beds stay reserved (unique per room), so new beds skip them.
    const plan = planCapacity(beds.map((b) => ({ id: b.id, label: b.label, occupied: b.occupied })), Number(data.sharing));
    const used = new Set(all.map((x) => x.label));
    const addLabels: string[] = [];
    for (let i = 0; addLabels.length < plan.add.length; i++) if (!used.has(bedLabel(i))) addLabels.push(bedLabel(i));
    const rentAll = data.rentAll === null || data.rentAll === undefined ? null : paise(data.rentAll, "Enter the rent for all beds.");
    const newRent = rentAll ?? (data.newBedRent != null ? paise(data.newBedRent) : num(beds[0]?.bed_rent));
    const stmts: { text: string; params: unknown[] }[] = [
      { text: `update rooms set room_number=$2, floor=$3, is_ac=$4 where id=$1`, params: [data.roomId, req(data.roomNumber, "Room number required"), data.floor ?? "", !!data.isAc] },
      ...plan.remove.map((id) => ({ text: `update beds set is_active=false where id=$1 and not exists (select 1 from allocations a where a.bed_id=$1 and a.end_date is null)`, params: [id] })),
      ...addLabels.map((l) => ({ text: `insert into beds (room_id, label, bed_rent) values ($1,$2,$3)`, params: [data.roomId, l, newRent] })),
    ];
    if (rentAll !== null) stmts.push({ text: `update beds set bed_rent=$2 where room_id=$1 and is_active`, params: [data.roomId, rentAll] });
    try { await tx(stmts); } catch (e: any) {
      if (String(e?.message).includes("rooms_unique_active")) throw new Error("Another room in this branch already has that number.");
      throw e;
    }
    return { ok: true, added: addLabels.length, removed: plan.remove.length };
  });

/** Archive (never delete) a room. Refused while anyone lives in it. */
export const archiveRoom = createServerFn({ method: "POST" })
  .inputValidator((d: { roomId: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "room", data.roomId);
    const occ = await q(`select 1 from beds b join allocations a on a.bed_id=b.id and a.end_date is null where b.room_id=$1`, [data.roomId]);
    if (occ.length) throw new Error("This room has residents. Move or check them out before archiving.");
    await q(`update rooms set is_active=false where id=$1`, [data.roomId]);
    return { ok: true };
  });

export const vacantBeds = createServerFn({ method: "GET" }).handler(async () => {
  const u = await requireUser();
  return q<{ bed_id: string; label: string; bed_rent: string; room_number: string; branch_id: string; branch_name: string; is_ac: boolean; sharing: string }>(
    `select b.id as bed_id, b.label, b.bed_rent, r.room_number, r.branch_id, br.name as branch_name, r.is_ac,
       (select count(*) from beds x where x.room_id=r.id and x.is_active) as sharing
     from beds b join rooms r on r.id=b.room_id join branches br on br.id=r.branch_id
     where ($1::uuid[] is null or r.branch_id = any($1)) and b.is_active and r.is_active and br.is_active and not exists (select 1 from allocations a where a.bed_id=b.id and a.end_date is null)
     order by br.name, r.room_number, b.label`, [branchScope(u)],
  );
});

/* ---------------- Bills ---------------- */
// Due rule: one PG-wide due day (1–28). A bill's due date is fixed when the bill is created, so changing the
// due day only affects future months. Someone who starts after that month's due date is due next month's due date.
function dueSql(m: string, started: string) {
  return `(case when ${started} > (${m}::date + (s.default_due_day - 1))
     then (${m}::date + interval '1 month')::date + (s.default_due_day - 1)
     else ${m}::date + (s.default_due_day - 1) end)`;
}

/** Which month's bill a new extra charge belongs to: on/before the due date → this month, after → next month. */
async function chargeMonth() {
  const s = (await q<any>(`select default_due_day from settings where id=1`))[0];
  return chargeMonthFor(todayPg(), Number(s?.default_due_day ?? 7));
}

async function ensureBillsFor(month: string, scope: string[] | null) {
  // Every resident whose allocation overlaps the month gets one bill and one rent line; idempotent.
  const a = `select distinct on (al.resident_id) al.resident_id, al.monthly_rent, rm.branch_id, al.start_date
       from allocations al join beds bd on bd.id=al.bed_id join rooms rm on rm.id=bd.room_id
       where ($2::uuid[] is null or rm.branch_id = any($2)) and al.start_date <= ($1::date + interval '1 month' - interval '1 day')::date
         and (al.end_date is null or al.end_date >= $1::date)
       order by al.resident_id, al.start_date desc`;
  await q(
    `insert into bills (resident_id, branch_id, billing_month, due_date)
     select a.resident_id, a.branch_id, $1::date, ${dueSql('$1', 'a.start_date')}
     from (${a}) a cross join settings s
     on conflict (resident_id, billing_month) do nothing`, [month, scope]);
  await q(
    `insert into bill_lines (bill_id, kind, description, amount, service_month)
     select b.id, 'rent', 'Rent for ' || to_char($1::date, 'Mon YYYY'), a.monthly_rent, $1::date
     from (${a}) a join bills b on b.resident_id=a.resident_id and b.billing_month=$1::date
     where not exists (select 1 from bill_lines l where l.bill_id=b.id and l.kind='rent')`, [month, scope]);
}


export const generateBills = createServerFn({ method: "POST" })
  .inputValidator((d: { month?: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    const m = data.month || monthStart();
    if (!isMonth(m)) throw new Error("Invalid month.");
    if (m > monthStart()) throw new Error("Bills can't be created for future months.");
    const before = await q<any>(`select count(*) n from bills where billing_month=$1 and ($2::uuid[] is null or branch_id = any($2))`, [m, branchScope(u)]);
    await ensureBillsFor(m, branchScope(u));
    const after = await q<any>(`select count(*) n from bills where billing_month=$1 and ($2::uuid[] is null or branch_id = any($2))`, [m, branchScope(u)]);
    return { created: num(after[0].n) - num(before[0].n) };
  });

/* ---------------- Residents ---------------- */
type Ledger = { outstanding: number; credit: number; depositHeld: number; depositReceived: number; oldestDue: string | null; currentPaid: boolean | null; bills: any[] };

async function ledgers(residentIds: string[] | null): Promise<Map<string, Ledger>> {
  const filt = residentIds ? `where resident_id = any($1)` : ``;
  const p = residentIds ? [residentIds] : [];
  const bills = await q<any>(
    `select b.id, b.resident_id, b.billing_month::text as billing_month, b.due_date::text as due_date,
       coalesce((select sum(amount) from bill_lines l where l.bill_id=b.id),0) as payable
     from bills b ${filt.replace("resident_id", "b.resident_id")} order by b.billing_month, b.created_at`, p);
  const money = await q<any>(
    `select resident_id,
       coalesce(sum(case when account='rent' and direction='in' then amount when account='rent' then -amount end),0) as rent_net,
       coalesce(sum(case when account='deposit' and direction='in' then amount when account='deposit' then -amount end),0) as dep_net,
       coalesce(sum(case when account='deposit' and purpose='deposit_receipt' then amount
                         when account='deposit' and purpose='reversal' and direction='out' then -amount end),0) as dep_received
     from money_txns ${filt} group by resident_id`, p);
  const mm = new Map(money.map((m) => [m.resident_id, m]));
  const by = new Map<string, any[]>();
  for (const b of bills) (by.get(b.resident_id) ?? by.set(b.resident_id, []).get(b.resident_id)!).push({ ...b, payable: num(b.payable) });
  const ids = new Set([...by.keys(), ...mm.keys(), ...(residentIds ?? [])]);
  const out = new Map<string, Ledger>();
  const cur = monthStart();
  for (const id of ids) {
    const bs = by.get(id) ?? [];
    const m = mm.get(id);
    const { paid, credit } = applyFifo(bs, num(m?.rent_net));
    const total = bs.reduce((s, b) => s + b.payable, 0);
    const withPaid = bs.map((b) => ({ ...b, paid: paid[b.id] ?? 0, outstanding: b.payable - (paid[b.id] ?? 0) }));
    const open = withPaid.filter((b) => b.outstanding > 0);
    const curBill = withPaid.find((b) => b.billing_month === cur);
    out.set(id, {
      outstanding: Math.max(0, total - num(m?.rent_net)),
      credit, depositHeld: num(m?.dep_net), depositReceived: num(m?.dep_received),
      oldestDue: open[0]?.due_date ?? null,
      currentPaid: curBill ? curBill.outstanding <= 0 : null,
      bills: withPaid,
    });
  }
  return out;
}

export const listResidents = createServerFn({ method: "GET" })
  .inputValidator((d: { status?: string | undefined; branchId?: string | undefined }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    if (data.branchId) assertBranchAccess(u, data.branchId);
    await ensureBillsFor(monthStart(), branchScope(u));
    const rows = await q<any>(
      `select r.id, r.code, r.name, r.mobile, r.status, r.branch_id, br.name as branch_name, r.joining_date::text, r.checkout_date::text,
         r.deposit_agreed, a.monthly_rent, rm.room_number, bd.label as bed_label,
         (select max(marked_at) from notification_log n where n.resident_id=r.id and n.type='overdue') as last_overdue_at,
         (select count(*) from notification_log n join bills b on b.id=n.bill_id where n.resident_id=r.id and n.type='bill' and b.billing_month=$3::date) as bill_shared
       from residents r join branches br on br.id=r.branch_id
       left join allocations a on a.resident_id=r.id and a.end_date is null
       left join beds bd on bd.id=a.bed_id left join rooms rm on rm.id=bd.room_id
       where ($1::text is null or r.status=$1) and ($2::uuid is null or r.branch_id=$2) and ($4::uuid[] is null or r.branch_id = any($4)) and ${historyScope("r", 4)}
       order by r.status, br.name, rm.room_number nulls last, bd.label, r.name limit 1000`,
      [data.status || null, data.branchId || null, monthStart(), branchScope(u)],
    );
    const L = await ledgers(rows.map((r) => r.id));
    const cd = num((await q<any>(`select overdue_cooldown_days from settings where id=1`))[0]?.overdue_cooldown_days ?? 3);
    return rows.map((r) => {
      const l = L.get(r.id)!;
      const { bills, ...rest } = l;
      void bills;
      return { ...r, ...rest, overdue: isOverdue(l.bills, todayPg()), deposit: depositStatus(num(r.deposit_agreed), rest.depositReceived), bill_shared: num(r.bill_shared) > 0, cooldownDays: cd };
    });
  });

export const getResident = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "resident", data.id);
    const r = (await q<any>(
      `select r.*, r.joining_date::text as joining_date, r.checkout_date::text as checkout_date, br.name as branch_name, br.due_day as branch_due_day
       from residents r join branches br on br.id=r.branch_id where r.id=$1`, [data.id]))[0];
    if (!r) throw new Error("Resident not found.");
    const [alloc, lines, txns, notes, settings, templates] = await Promise.all([
      q<any>(`select a.id, a.start_date::text, a.end_date::text, a.monthly_rent, bd.label, rm.room_number, br.name as branch_name
              from allocations a join beds bd on bd.id=a.bed_id join rooms rm on rm.id=bd.room_id join branches br on br.id=rm.branch_id
              where a.resident_id=$1 and ($2::uuid[] is null or rm.branch_id = any($2)) order by a.start_date desc, a.created_at desc`, [data.id, branchScope(u)]),
      q<any>(`select l.id, l.bill_id, l.kind, l.description, l.amount, l.reason, l.reverses_line_id, l.created_at,
              exists(select 1 from bill_lines x where x.reverses_line_id=l.id) as reversed
              from bill_lines l join bills b on b.id=l.bill_id where b.resident_id=$1 order by l.created_at`, [data.id]),
      q<any>(`select t.*, t.txn_date::text as txn_date, u.full_name as by_name,
              exists(select 1 from money_txns x where x.reverses_txn_id=t.id) as reversed
              from money_txns t left join app_users u on u.id=t.created_by where t.resident_id=$1 order by t.created_at desc`, [data.id]),
      q<any>(`select n.*, u.full_name as by_name from notification_log n left join app_users u on u.id=n.marked_by where n.resident_id=$1 order by marked_at desc limit 100`, [data.id]),
      q<any>(`select * from settings where id=1`),
      canSendMessages(u) ? q<any>(`select id, title, body, category from wa_templates where status='active' order by title`) : Promise.resolve([] as any[]),
    ]);
    const center = await q<any>(`select rc.id, rc.status, rc.message_text, rc.provider_message_id, rc.error, coalesce(rc.sent_at, rc.updated_at) as at,
        ss.template_title, ss.method, uu.full_name as by_name from wa_send_recipients rc join wa_send_sessions ss on ss.id=rc.session_id
        left join app_users uu on uu.id=rc.updated_by where rc.resident_id=$1 and rc.status<>'pending' order by at desc limit 200`, [data.id]);
    const typeName: Record<string, string> = { welcome: "Welcome", bill: "Bill share", overdue: "Overdue reminder", other: "Message" };
    const messageHistory = visibleHistory(mergeHistory([
      ...notes.map((n): HistoryEntry => ({ id: n.id, source: "resident", at: new Date(n.marked_at).toISOString(), template: n.template_title ?? typeName[n.type] ?? n.type,
        text: n.message_text, method: "MANUAL_WHATSAPP", status: "sent", by: n.by_name })),
      ...center.map((c): HistoryEntry => ({ id: c.id, source: "center", at: new Date(c.at).toISOString(), template: c.template_title,
        text: c.message_text, method: c.method, status: c.status, by: c.by_name, providerId: c.provider_message_id, error: c.error, events: [] })),
    ]), u);
    // Non-owners never receive full message bodies from the server.
    const notesOut = canViewFullMessage(u) ? notes : notes.map((n) => ({ ...n, message_text: undefined }));
    const l = (await ledgers([data.id])).get(data.id)!;
    const bills = l.bills.map((b) => ({ ...b, lines: lines.filter((x) => x.bill_id === b.id) })).reverse();
    return { resident: r, allocations: alloc, current: alloc.find((a) => !a.end_date) ?? null, bills, txns, notifications: notesOut, messageHistory, settings: settings[0], templates,
      outstanding: l.outstanding, credit: l.credit, depositHeld: l.depositHeld, oldestDue: l.oldestDue,
      deposit: depositStatus(num(r.deposit_agreed), l.depositReceived),
      breakdown: billBreakdown(l.bills.map((b) => ({ ...b, lines: lines.filter((x) => x.bill_id === b.id) })), monthStart()),
      nextChargeMonth: await chargeMonth() };
  });

export const onboardResident = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; mobile: string; altMobile?: string; bedId: string; joiningDate: string; monthlyRent: number; depositAgreed: number; depositPaid: number; method: string; dueDay?: number | null; notes?: string; idem: string; guardianName?: string; guardianRelation?: string; guardianPhone?: string; idMethod?: string | null; idType?: string | null; idNumber?: string | null }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "bed", data.bedId);
    const mobile = req(data.mobile, "Mobile required").replace(/\D/g, "");
    if (mobile.length < 10) throw new Error("Enter a valid mobile number.");
    if (!isDate(data.joiningDate)) throw new Error("Enter the joining date.");
    if (data.joiningDate > new Date().toISOString().slice(0, 10)) {
      // allowed: advance booking still allocates from that date
    }
    const rent = paise(data.monthlyRent, "Enter the monthly rent."), dep = paise(data.depositAgreed), depPaid = paise(data.depositPaid);
    const due = data.dueDay ? Number(data.dueDay) : null;
    if (due !== null && !(due >= 1 && due <= 28)) throw new Error("Due day must be 1–28.");
    const bed = (await q<any>(`select r.branch_id from beds b join rooms r on r.id=b.room_id where b.id=$1 and b.is_active`, [data.bedId]))[0];
    if (!bed) throw new Error("Choose a bed.");
    const id = crypto.randomUUID();
    const g = guardian(data);
    const idp = normalizeIdProof({ method: data.idMethod, type: data.idType, number: data.idNumber });
    if (idp.id_method === "upload") throw new Error(UPLOAD_UNAVAILABLE);
    const stmts = [
      { text: `insert into residents (id, name, mobile, alt_mobile, branch_id, joining_date, due_day_override, deposit_agreed, notes, guardian_name, guardian_relation, guardian_phone, id_method, id_type, id_number)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        params: [id, req(data.name, "Name required"), mobile, data.altMobile ?? "", bed.branch_id, data.joiningDate, due, dep, data.notes ?? "", g.name, g.relation, g.phone, idp.id_method, idp.id_type, idp.id_number] },
      { text: `insert into allocations (resident_id, bed_id, start_date, monthly_rent) values ($1,$2,$3,$4)`, params: [id, data.bedId, data.joiningDate, rent] },
    ];
    if (depPaid > 0)
      stmts.push({ text: `insert into money_txns (resident_id, direction, account, purpose, amount, method, txn_date, idempotency_key, created_by) values ($1,'in','deposit','deposit_receipt',$2,$3,$4,$5,$6)`,
        params: [id, depPaid, data.method || "cash", data.joiningDate, data.idem + ":dep", u.id] });
    try { await tx(stmts); } catch (e: any) {
      if (String(e?.message).includes("alloc_one_per_bed")) throw new Error("That bed was just taken. Pick another bed.");
      throw e;
    }
    const jm = data.joiningDate.slice(0, 8) + "01";
    if (jm <= monthStart()) await ensureBillsFor(jm, branchScope(u));
    return { id };
  });

const UPLOAD_UNAVAILABLE = "ID image upload isn't available yet (no private file storage is set up). Use manual ID entry.";
function guardian(d: { guardianName?: string; guardianRelation?: string; guardianPhone?: string }) {
  const phone = String(d.guardianPhone ?? "").replace(/\D/g, "");
  if (phone && phone.length < 10) throw new Error("Enter a valid guardian contact number.");
  return { name: String(d.guardianName ?? "").trim(), relation: String(d.guardianRelation ?? "").trim(), phone };
}

export const updateResident = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; name: string; mobile: string; altMobile?: string; depositAgreed: number; notes?: string; guardianName?: string; guardianRelation?: string; guardianPhone?: string; idMethod?: string | null; idType?: string | null; idNumber?: string | null; idVerification?: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "resident", data.id);
    const mobile = req(data.mobile, "Mobile required").replace(/\D/g, "");
    if (mobile.length < 10) throw new Error("Enter a valid mobile number.");
    const g = guardian(data);
    const cur = (await q<any>(`select id_method, id_type, id_number, id_doc_key from residents where id=$1`, [data.id]))[0];
    if (!cur) throw new Error("Resident not found.");
    // Keep the saved (masked) number when the same manual ID is left unchanged.
    const unchanged = data.idMethod === cur.id_method && data.idType === cur.id_type && data.idNumber === cur.id_number;
    const idp = unchanged ? { id_method: cur.id_method, id_type: cur.id_type, id_number: cur.id_number } : normalizeIdProof({ method: data.idMethod, type: data.idType, number: data.idNumber });
    if (idp.id_method === "upload" && !cur.id_doc_key) throw new Error("Upload the ID from the resident document section first.");
    if (cur.id_doc_key && idp.id_method !== "upload") throw new Error("Delete the private document before changing the ID proof method.");
    const ver = ["pending", "verified", "rejected"].includes(data.idVerification ?? "") ? data.idVerification : "pending";
    if (u.role !== "owner") {
      const prev = (await q<any>(`select id_verification from residents where id=$1`, [data.id]))[0]?.id_verification;
      if (prev !== ver) throw new Error("Only the owner can change ID verification.");
    }
    await q(`update residents set name=$2, mobile=$3, alt_mobile=$4, deposit_agreed=$5, notes=$6, guardian_name=$7, guardian_relation=$8, guardian_phone=$9,
               id_method=$10, id_type=$11, id_number=$12, id_verification=$13 where id=$1`,
      [data.id, req(data.name, "Name required"), mobile, data.altMobile ?? "", paise(data.depositAgreed), data.notes ?? "", g.name, g.relation, g.phone,
       idp.id_method, idp.id_type, idp.id_number, unchanged || idp.id_method ? ver : "pending"]);
    return { ok: true };
  });

export const changeRoom = createServerFn({ method: "POST" })
  .inputValidator((d: { residentId: string; bedId: string; date: string; monthlyRent: number }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "resident", data.residentId); await requireEntityAccess(u, "bed", data.bedId);
    if (!isDate(data.date)) throw new Error("Enter the move date.");
    const cur = (await q<any>(`select id, start_date::text from allocations where resident_id=$1 and end_date is null`, [data.residentId]))[0];
    if (!cur) throw new Error("Resident has no current bed.");
    if (data.date < cur.start_date) throw new Error("Move date can't be before the current bed's start date.");
    const bed = (await q<any>(`select r.branch_id from beds b join rooms r on r.id=b.room_id where b.id=$1`, [data.bedId]))[0];
    if (!bed) throw new Error("Choose a bed.");
    try {
      await tx([
        { text: `update allocations set end_date=$2 where id=$1`, params: [cur.id, data.date] },
        { text: `insert into allocations (resident_id, bed_id, start_date, monthly_rent) values ($1,$2,$3,$4)`, params: [data.residentId, data.bedId, data.date, paise(data.monthlyRent)] },
        { text: `update residents set branch_id=$2 where id=$1`, params: [data.residentId, bed.branch_id] },
      ]);
    } catch (e: any) {
      if (String(e?.message).includes("alloc_one_per_bed")) throw new Error("That bed is occupied.");
      throw e;
    }
    return { ok: true };
  });

/* ---------------- Charges & discounts ---------------- */
async function billIdFor(residentId: string, month: string) {
  await q(
    `insert into bills (resident_id, branch_id, billing_month, due_date)
     select r.id, r.branch_id, $2::date, ${dueSql('$2', 'r.joining_date')}
     from residents r join branches br on br.id=r.branch_id cross join settings s where r.id=$1
     on conflict (resident_id, billing_month) do nothing`, [residentId, month]);
  return (await q<any>(`select id from bills where resident_id=$1 and billing_month=$2`, [residentId, month]))[0].id;
}

export const addCharges = createServerFn({ method: "POST" })
  .inputValidator((d: { residentIds: string[]; month?: string; description: string; amount: number; mode: "each" | "split"; kind?: "extra_charge" | "discount" | "adjustment"; reason?: string; category?: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    for (const id of data.residentIds ?? []) await requireEntityAccess(u, "resident", id);
    // No month given: the PG's due rule decides (after the 1st week, charges go on next month's bill).
    const month = data.month || (await chargeMonth());
    if (!isMonth(month)) throw new Error("Choose a month.");
    const ids = [...new Set(data.residentIds ?? [])];
    if (!ids.length) throw new Error("Select at least one resident.");
    const amt = paise(data.amount);
    if (amt <= 0) throw new Error("Amount must be more than zero.");
    const kind = data.kind ?? "extra_charge";
    const entry = todayPg();
    const cat = kind === "extra_charge" && (CATEGORIES as readonly string[]).includes(data.category ?? "") ? data.category! : null;
    if (kind !== "extra_charge" && !data.reason?.trim()) throw new Error("A reason is required.");
    const parts = data.mode === "split" ? splitEqual(amt, ids.length) : ids.map(() => amt);
    const sign = kind === "discount" ? -1 : 1;
    if (month <= monthStart()) await ensureBillsFor(month, branchScope(u));
    const billIds: string[] = [];
    for (const id of ids) billIds.push(await billIdFor(id, month));
    if (sign < 0) {
      const pay = await q<any>(`select coalesce(sum(amount),0) p from bill_lines where bill_id=$1`, [billIds[0]]);
      if (num(pay[0].p) - (parts[0] ?? 0) < 0) throw new Error("A discount can't be larger than the bill.");
    }
    await tx(ids.map((_, i) => ({
      text: `insert into bill_lines (bill_id, kind, description, amount, reason, created_by, entry_date, service_month, category) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      params: [billIds[i], kind, req(data.description, "Description required"), sign * (parts[i] ?? 0), data.reason ?? "", u.id, entry, monthOf(entry), cat],
    })));
    return { count: ids.length, total: parts.reduce((a, b) => a + b, 0), month };
  });

export const reverseLine = createServerFn({ method: "POST" })
  .inputValidator((d: { lineId: string; reason: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "line", data.lineId);
    const l = (await q<any>(`select * from bill_lines where id=$1`, [data.lineId]))[0];
    if (!l) throw new Error("Line not found.");
    if (l.kind === "reversal") throw new Error("A reversal can't be reversed.");
    if (l.kind === "rent" && u.role !== "owner") throw new Error("Only the owner can reverse rent.");
    try {
      await q(`insert into bill_lines (bill_id, kind, description, amount, reason, reverses_line_id, created_by) values ($1,'reversal',$2,$3,$4,$5,$6)`,
        [l.bill_id, "Reversal: " + l.description, -num(l.amount), req(data.reason, "A reason is required."), l.id, u.id]);
    } catch (e: any) {
      if (String(e?.message).includes("reverses_line_id")) throw new Error("Already reversed.");
      throw e;
    }
    return { ok: true };
  });

/* ---------------- Money ---------------- */
export const collectPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { residentId: string; account: "rent" | "deposit"; amount: number; method: string; reference?: string; date: string; idem: string }) => paymentInput.parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "resident", data.residentId);
    const amt = paise(data.amount);
    if (amt <= 0) throw new Error("Amount must be more than zero.");
    if (!["cash", "upi", "bank"].includes(data.method)) throw new Error("Choose a payment method.");
    if (!isDate(data.date)) throw new Error("Enter the payment date.");
    const rows = await q<any>(
      `insert into money_txns (resident_id, direction, account, purpose, amount, method, reference, txn_date, idempotency_key, created_by)
       values ($1,'in',$2,$3,$4,$5,$6,$7,$8,$9) on conflict (idempotency_key) do nothing returning id`,
      [data.residentId, data.account, data.account === "rent" ? "rent_payment" : "deposit_receipt", amt, data.method, data.reference ?? "", data.date, data.idem, u.id]);
    return { ok: true, duplicate: rows.length === 0 };
  });

export const reverseTxn = createServerFn({ method: "POST" })
  .inputValidator((d: { txnId: string; reason: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "txn", data.txnId);
    if (u.role !== "owner" && !u.can_reverse) throw new Error("You don't have permission to reverse payments.");
    const t = (await q<any>(`select * from money_txns where id=$1`, [data.txnId]))[0];
    if (!t) throw new Error("Payment not found.");
    if (t.purpose === "reversal") throw new Error("A reversal can't be reversed.");
    if (t.account === "deposit" && t.direction === "in") {
      const L = (await ledgers([t.resident_id])).get(t.resident_id)!;
      if (L.depositHeld - num(t.amount) < 0) throw new Error("This deposit was already used or refunded.");
    }
    try {
      await q(`insert into money_txns (resident_id, direction, account, purpose, amount, method, note, txn_date, reverses_txn_id, created_by)
               values ($1,$2,$3,'reversal',$4,$5,$6,${sqlDate(todayPg())},$7,$8)`,
        [t.resident_id, t.direction === "in" ? "out" : "in", t.account, t.amount, t.method, req(data.reason, "A reason is required."), t.id, u.id]);
    } catch (e: any) {
      if (String(e?.message).includes("reverses_txn_id")) throw new Error("Already reversed.");
      throw e;
    }
    return { ok: true };
  });

export const checkoutResident = createServerFn({ method: "POST" })
  .inputValidator((d: { residentId: string; date: string; deductions: { amount: number; reason: string }[]; applyDeposit: boolean }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "resident", data.residentId);
    if (!isDate(data.date)) throw new Error("Enter the checkout date.");
    const r = (await q<any>(`select status from residents where id=$1`, [data.residentId]))[0];
    if (!r || r.status !== "active") throw new Error("Resident is not active.");
    const cur = (await q<any>(`select id, start_date::text from allocations where resident_id=$1 and end_date is null`, [data.residentId]))[0];
    if (cur && data.date < cur.start_date) throw new Error("Checkout date is before the bed start date.");
    const cm = data.date.slice(0, 8) + "01";
    if (cm <= monthStart()) await ensureBillsFor(cm, branchScope(u));
    const L = (await ledgers([data.residentId])).get(data.residentId)!;
    let held = L.depositHeld;
    const stmts: { text: string; params: unknown[] }[] = [];
    for (const d of data.deductions ?? []) {
      const a = paise(d.amount);
      if (a <= 0) continue;
      if (!d.reason?.trim()) throw new Error("Each deduction needs a reason.");
      if (a > held) throw new Error("Deductions are more than the deposit held.");
      held -= a;
      stmts.push({ text: `insert into money_txns (resident_id, direction, account, purpose, amount, method, note, txn_date, created_by) values ($1,'out','deposit','deposit_deduction',$2,'internal',$3,$4,$5)`,
        params: [data.residentId, a, d.reason.trim(), data.date, u.id] });
    }
    const apply = data.applyDeposit ? Math.min(held, L.outstanding) : 0;
    if (apply > 0) {
      stmts.push({ text: `insert into money_txns (resident_id, direction, account, purpose, amount, method, note, txn_date, created_by) values ($1,'out','deposit','deposit_to_dues',$2,'internal','Deposit used for dues',$3,$4)`, params: [data.residentId, apply, data.date, u.id] });
      stmts.push({ text: `insert into money_txns (resident_id, direction, account, purpose, amount, method, note, txn_date, created_by) values ($1,'in','rent','deposit_to_dues',$2,'internal','Paid from deposit',$3,$4)`, params: [data.residentId, apply, data.date, u.id] });
    }
    if (cur) stmts.push({ text: `update allocations set end_date=$2 where id=$1`, params: [cur.id, data.date] });
    stmts.push({ text: `update residents set status='checked_out', checkout_date=$2 where id=$1`, params: [data.residentId, data.date] });
    await tx(stmts);
    return { ok: true };
  });

export const recordRefund = createServerFn({ method: "POST" })
  .inputValidator((d: { residentId: string; account: "deposit" | "rent"; amount: number; method: string; reference?: string; date: string; idem: string }) => paymentInput.parse(d))
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "resident", data.residentId);
    const amt = paise(data.amount);
    if (amt <= 0) throw new Error("Amount must be more than zero.");
    const L = (await ledgers([data.residentId])).get(data.residentId)!;
    const max = data.account === "deposit" ? L.depositHeld : L.credit;
    if (amt > max) throw new Error(`You can refund at most ₹${(max / 100).toFixed(2)}.`);
    await q(`insert into money_txns (resident_id, direction, account, purpose, amount, method, reference, txn_date, idempotency_key, created_by)
             values ($1,'out',$2,$3,$4,$5,$6,$7,$8,$9) on conflict (idempotency_key) do nothing`,
      [data.residentId, data.account, data.account === "deposit" ? "deposit_refund" : "credit_refund", amt, data.method, data.reference ?? "", data.date, data.idem, u.id]);
    return { ok: true };
  });

export const listTxns = createServerFn({ method: "GET" })
  .inputValidator((d: { month?: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    const m = data.month || monthStart();
    return q<any>(
      `select t.id, t.txn_date::text as txn_date, t.direction, t.account, t.purpose, t.amount, t.method, t.reference, t.note,
         r.name as resident_name, r.code, r.id as resident_id, u.full_name as by_name
       from money_txns t join residents r on r.id=t.resident_id left join app_users u on u.id=t.created_by
       where ($2::uuid[] is null or r.branch_id = any($2)) and ${historyScope("r", 2)} and t.txn_date >= $1::date and t.txn_date < ($1::date + interval '1 month') order by t.txn_date desc, t.created_at desc limit 2000`, [m, branchScope(u)]);
  });

/* ---------------- WhatsApp log ---------------- */
export const markSent = createServerFn({ method: "POST" })
  .inputValidator((d: { residentId: string; templateId: string; month?: string; amount?: number; message: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireUser();
    await requireEntityAccess(u, "resident", data.residentId);
    if (!canSendMessages(u)) throw new Error("You don't have permission to send messages.");
    const t = (await q<any>(`select id, title, body, category from wa_templates where id=$1 and status='active'`, [data.templateId]))[0];
    if (!t) throw new Error("Choose an active template.");
    const type = logTypeForCategory(t.category);
    let billId: string | null = null;
    if (type === "bill") {
      billId = (await q<any>(`select id from bills where resident_id=$1 and billing_month=$2`, [data.residentId, data.month || monthStart()]))[0]?.id ?? null;
    }
    if (isGapLimited(type)) {
      const s = (await q<any>(`select overdue_cooldown_days d from settings where id=1`))[0];
      const last = (await q<any>(`select max(marked_at) m from notification_log where resident_id=$1 and type='overdue'`, [data.residentId]))[0]?.m;
      if (last && Date.now() - new Date(last).getTime() < num(s.d) * 86400000)
        throw new Error(`A reminder was already sent in the last ${s.d} days.`);
    }
    await q(`insert into notification_log (resident_id, bill_id, type, amount, message_text, marked_by, template_id, template_title) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [data.residentId, billId, type, data.amount ?? null, data.message, u.id, t.id, t.title]);
    return { ok: true, type };
  });

/* ---------------- Dashboard ---------------- */
export const getDashboard = createServerFn({ method: "GET" })
  .inputValidator((d: { branchId?: string | null } | undefined) => d ?? {})
  .handler(async ({ data }) => {
  const u = await requireUser();
  const m = monthStart();
  const bid = data.branchId || null;
  if (bid) assertBranchAccess(u, bid);
  const scope = branchScope(u);
  await ensureBillsFor(m, branchScope(u));
  const [beds, coll, billed, settings, trend] = await Promise.all([
    q<any>(`select count(*) total, count(a.id) occupied from beds b join rooms r on r.id=b.room_id join branches br on br.id=r.branch_id
            left join allocations a on a.bed_id=b.id and a.end_date is null where b.is_active and r.is_active and br.is_active and ($1::uuid is null or br.id=$1) and ($2::uuid[] is null or br.id = any($2))`, [bid, scope]),
    q<any>(`select coalesce(sum(case when direction='in' then amount else -amount end) filter (where account='rent' and purpose in ('rent_payment','reversal')),0) rent,
              coalesce(sum(case when direction='in' then amount else -amount end) filter (where account='deposit' and purpose in ('deposit_receipt','reversal')),0) dep
            from money_txns t where txn_date >= $1::date and txn_date < ($1::date + interval '1 month')
              and exists (select 1 from residents x where x.id=t.resident_id and ($2::uuid is null or x.branch_id=$2) and ($3::uuid[] is null or x.branch_id = any($3)) and ${historyScope("x", 3)})`, [m, bid, scope]),
    q<any>(`select coalesce(sum(l.amount),0) s from bill_lines l join bills b on b.id=l.bill_id where b.billing_month=$1 and ($2::uuid is null or b.branch_id=$2) and ($3::uuid[] is null or b.branch_id = any($3))`, [m, bid, scope]),
    q<any>(`select pg_name from settings where id=1`),
    q<any>(`select to_char(date_trunc('month', txn_date),'Mon') label, date_trunc('month', txn_date) mm,
              sum(case when direction='in' then amount else -amount end) amt
            from money_txns t where account='rent' and purpose in ('rent_payment','reversal') and txn_date >= ($1::date - interval '5 months')
              and exists (select 1 from residents x where x.id=t.resident_id and ($2::uuid is null or x.branch_id=$2) and ($3::uuid[] is null or x.branch_id = any($3)) and ${historyScope("x", 3)})
            group by 1,2 order by 2`, [m, bid, scope]),
  ]);
  const active = await q<any>(`select r.id, r.name, r.mobile, r.code, br.name as branch_name from residents r join branches br on br.id=r.branch_id where r.status='active' and ($1::uuid is null or r.branch_id=$1) and ($2::uuid[] is null or r.branch_id = any($2)) and ${historyScope("r", 2)}`, [bid, scope]);
  const L = await ledgers(active.map((r) => r.id));
  const t = todayPg();
  let outstanding = 0;
  const overdue: any[] = [];
  for (const r of active) {
    const l = L.get(r.id);
    if (!l) continue;
    outstanding += l.outstanding;
    if (l.outstanding > 0 && l.oldestDue && l.oldestDue < t) overdue.push({ ...r, outstanding: l.outstanding, oldestDue: l.oldestDue });
  }
  overdue.sort((a, b) => b.outstanding - a.outstanding);
  return {
    user: u, pgName: settings[0]?.pg_name ?? "",
    beds: { total: num(beds[0].total), occupied: num(beds[0].occupied) },
    activeResidents: active.length,
    billedThisMonth: num(billed[0].s), collectedThisMonth: num(coll[0].rent), depositsThisMonth: num(coll[0].dep),
    outstanding, overdue: overdue.slice(0, 50), overdueCount: overdue.length,
    trend: trend.map((x) => ({ label: x.label, amount: num(x.amt) / 100 })),
  };
});

/* ================= WhatsApp Message Center (Phase 2) ================= */
// Manual sharing only. Existing API records remain read-only history.
async function requireSender() {
  const u: any = await requireUser();
  if (!canSendMessages(u)) throw new Error("You don't have permission to send messages.");
    return u;
}

export const listWaTemplates = createServerFn({ method: "GET" })
  .inputValidator((d: { includeArchived?: boolean } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    await requireSender();
    return q<any>(`select id, title, body, category, status, created_at, updated_at from wa_templates
                   where ($1 or status <> 'archived') order by status, title`, [!!data.includeArchived]);
  });

export const saveWaTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; title: string; body: string; category: string; status?: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireOwner();
    const t = validateTemplate(data);
    const status = ["active", "inactive", "archived"].includes(data.status ?? "") ? data.status! : "active";
    const id = data.id || crypto.randomUUID();
    await tx([
      data.id
        ? { text: `update wa_templates set title=$2, body=$3, category=$4, status=$5, updated_by=$6, updated_at=now() where id=$1`, params: [id, t.title, t.body, t.category, status, u.id] }
        : { text: `insert into wa_templates (id, title, body, category, status, created_by, updated_by) values ($1,$2,$3,$4,$5,$6,$6)`, params: [id, t.title, t.body, t.category, status, u.id] },
      { text: `insert into wa_template_audit (template_id, action, title, body, status, by_user) values ($1,$2,$3,$4,$5,$6)`, params: [id, data.id ? "updated" : "created", t.title, t.body, status, u.id] },
    ]);
    return { id };
  });

export const setWaTemplateStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: "active" | "inactive" | "archived" }) => d)
  .handler(async ({ data }) => {
    const u = await requireOwner();
    if (!["active", "inactive", "archived"].includes(data.status)) throw new Error("Invalid status.");
    const t = (await q<any>(`select * from wa_templates where id=$1`, [data.id]))[0];
    if (!t) throw new Error("Template not found.");
    await tx([
      { text: `update wa_templates set status=$2, updated_by=$3, updated_at=now() where id=$1`, params: [data.id, data.status, u.id] },
      { text: `insert into wa_template_audit (template_id, action, title, body, status, by_user) values ($1,$2,$3,$4,$5,$6)`, params: [data.id, data.status, t.title, t.body, data.status, u.id] },
    ]);
    return { ok: true };
  });

type RecipientFilter = { month: string; branchId?: string | null; roomId?: string | null; category: string; templateId: string; method?: string };

async function buildRecipients(f: RecipientFilter, u: SessionUser) {
  if (f.branchId) assertBranchAccess(u, f.branchId);
  if (f.roomId) await requireEntityAccess(u, "room", f.roomId);
  if (!isMonth(f.month)) throw new Error("Choose a billing month.");
  if (!(RECIPIENT_CATEGORIES as readonly string[]).includes(f.category)) throw new Error("Choose a recipient category.");
  const tpl = (await q<any>(`select * from wa_templates where id=$1`, [f.templateId]))[0];
  if (!tpl || tpl.status !== "active") throw new Error("Choose an active template.");
  if (f.method && f.method !== "MANUAL_WHATSAPP") throw new Error("Only manual WhatsApp sharing is available.");
  if (f.month <= monthStart()) await ensureBillsFor(f.month, branchScope(u));
  const rows = await q<any>(
    `select r.id, r.code, r.name, r.mobile, r.status, r.joining_date::text as joining_date, r.deposit_agreed, r.branch_id, br.name as branch_name,
       a.monthly_rent, rm.id as room_id, rm.room_number, bd.label as bed_label
     from residents r join branches br on br.id=r.branch_id
     left join allocations a on a.resident_id=r.id and a.end_date is null
     left join beds bd on bd.id=a.bed_id left join rooms rm on rm.id=bd.room_id
     where r.status='active' and ($1::uuid is null or r.branch_id=$1) and ($2::uuid is null or rm.id=$2) and ($3::uuid[] is null or r.branch_id = any($3)) and ${historyScope("r", 3)}
     order by br.name, rm.room_number nulls last, bd.label, r.name limit 2000`, [f.branchId || null, f.roomId || null, branchScope(u)]);
  const ids = rows.map((r) => r.id);
  const L = await ledgers(ids);
  const lines = ids.length ? await q<any>(`select l.bill_id, l.kind, l.description, l.amount, l.category from bill_lines l join bills b on b.id=l.bill_id where b.resident_id = any($1)`, [ids]) : [];
  const s = (await q<any>(`select pg_name from settings where id=1`))[0];
  const hist = ids.length ? await q<any>(
    `select rc.resident_id, ss.template_id, ss.billing_month::text as billing_month, rc.outstanding from wa_send_recipients rc join wa_send_sessions ss on ss.id=rc.session_id
     where rc.status in ('sent','accepted','delivered','read') and rc.resident_id = any($1)`, [ids]) : [];
  const today = todayPg();
  const out = rows.map((r) => {
    const l = L.get(r.id)!;
    const bills = l.bills.map((b) => ({ ...b, lines: lines.filter((x) => x.bill_id === b.id).map((x) => ({ ...x, amount: num(x.amount) })) }));
    const bd = billBreakdown(bills, f.month);
    const dep = depositStatus(num(r.deposit_agreed), l.depositReceived);
    const due = bd.dueDate ? new Date(bd.dueDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
    const vars: Record<string, string> = {
      name: r.name, pg: s?.pg_name || r.branch_name, room: r.room_number ?? "", bed: r.bed_label ?? "", rent: r.monthly_rent != null ? inr(r.monthly_rent) : "",
      balance: inr(bd.totalOutstanding), current_balance: inr(Math.max(0, bd.thisBill - bd.paymentsReceived)), previous_balance: inr(bd.previousOutstanding),
      deposit_balance: inr(dep.balance), month: new Date(f.month + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      due_date: due, bill_breakdown: breakdownText(bd, due),
    };
    const wa = waNumber(r.mobile);
    let reason = wa ? "" : "No valid WhatsApp number";
    const message = renderTemplate(tpl.body, vars);
    const cand = { status: r.status, joining_date: r.joining_date, bills, depositBalance: dep.balance };
    return {
      id: r.id, code: r.code, name: r.name, branch_name: r.branch_name, room: r.room_number ? `${r.room_number}-${r.bed_label}` : "—", mobile: r.mobile,
      waNumber: wa, eligible: !reason, reason,
      payStatus: payStatus(bills, f.month), overdue: isOverdue(bills, today), outstanding: bd.totalOutstanding,
      message, matches: matchesCategory(cand, f.category as any, f.month, today),
    };
  }).filter((r) => r.matches);
  const dups = findDuplicates(out.map((r) => ({ id: r.id, outstanding: r.outstanding })), hist, tpl.id, f.month);
  const dm = new Map(dups.map((d) => [d.id, d]));
  return { template: tpl, rows: out.map(({ matches, ...r }) => ({ ...r, duplicate: dm.get(r.id) ?? null })) };
}

export const previewWaRecipients = createServerFn({ method: "POST" })
  .inputValidator((d: RecipientFilter) => d)
  .handler(async ({ data }) => { const u = await requireSender(); return buildRecipients(data, u); });

export const createWaSession = createServerFn({ method: "POST" })
  .inputValidator((d: RecipientFilter & { residentIds: string[]; method: string; idem: string; confirmResend?: boolean; confirmApi?: boolean; expectedCount?: number }) => d)
  .handler(async ({ data }) => {
    const u = await requireSender();
    const err = methodError(data.method);
    if (err) throw new Error(err);
    if (!data.idem) throw new Error("Missing request key.");
    const existing = (await q<any>(`select id from wa_send_sessions where idempotency_key=$1`, [data.idem]))[0];
    if (existing) { await requireSessionAccess(u, existing.id); return { id: existing.id, duplicate: true }; }
    const { template, rows } = await buildRecipients(data, u);
    const pick = new Set(data.residentIds ?? []);
    const chosen = rows.filter((r) => pick.has(r.id));
    if (!chosen.length) throw new Error("Select at least one resident.");
    const bad = chosen.filter((r) => !r.eligible);
    if (bad.length) throw new Error(`${bad.length} selected resident(s) have no valid WhatsApp number.`);
    const dup = chosen.filter((r) => r.duplicate);
    if (dup.length && !data.confirmResend) throw new Error(`This message was already sent to ${dup.length} selected resident(s) for this month. Confirm resend to continue.`);
    const id = crypto.randomUUID();
    try {
      await tx([
        { text: `insert into wa_send_sessions (id, template_id, template_title, billing_month, branch_id, recipient_category, filters, method, idempotency_key, created_by)
                 values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          params: [id, template.id, template.title, data.month, data.branchId || null, data.category, JSON.stringify({ roomId: data.roomId || null, resend: dup.length }), data.method, data.idem, u.id] },
        ...chosen.map((r, i) => ({ text: `insert into wa_send_recipients (session_id, resident_id, position, wa_number, message_text, outstanding, status) values ($1,$2,$3,$4,$5,$6,$7)`,
          params: [id, r.id, i + 1, r.waNumber, r.message, r.outstanding, "pending"] })),
      ]);
    } catch (e: any) {
      if (String(e?.message).includes("idempotency_key")) {
        const again = (await q<any>(`select id from wa_send_sessions where idempotency_key=$1`, [data.idem]))[0];
        if (again) { await requireSessionAccess(u, again.id); return { id: again.id, duplicate: true }; }
      }
      throw e;
    }
    return { id, duplicate: false };
  });

export const getWaSession = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireSender();
    await requireSessionAccess(u, data.id);
    const ss = (await q<any>(`select ss.*, ss.billing_month::text as billing_month, br.name as branch_name, u.full_name as by_name from wa_send_sessions ss
      left join branches br on br.id=ss.branch_id left join app_users u on u.id=ss.created_by where ss.id=$1`, [data.id]))[0];
    if (!ss) throw new Error("Session not found.");
    const recipients = await q<any>(`select rc.id, rc.resident_id, rc.position, rc.wa_number, rc.message_text, rc.outstanding, rc.status, rc.updated_at, rc.sent_at, rc.error, rc.provider_message_id,
        r.name, r.code, u.full_name as by_name from wa_send_recipients rc join residents r on r.id=rc.resident_id left join app_users u on u.id=rc.updated_by
      where rc.session_id=$1 order by rc.position`, [data.id]);
    const manual = ss.method === "MANUAL_WHATSAPP";
    const cnt = (f: (s: string) => boolean) => recipients.filter((r) => f(r.status)).length;
    return { session: ss, recipients, progress: manual ? progress(recipients.map((r) => r.status)) : {
      total: recipients.length, queued: cnt((x) => x === "queued" || x === "submitted"), accepted: cnt((x) => x === "accepted" || x === "sent"),
      delivered: cnt((x) => x === "delivered"), read: cnt((x) => x === "read"), failed: cnt((x) => x === "failed"),
      processed: cnt((x) => !["queued", "submitted"].includes(x)) } as any };
  });

export const updateWaRecipient = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: RecipientStatus }) => d)
  .handler(async ({ data }) => {
    const u = await requireSender();
    await requireRecipientAccess(u, data.id);
    const rc = (await q<any>(`select rc.status, ss.method, ss.status as session_status, ss.id as session_id from wa_send_recipients rc join wa_send_sessions ss on ss.id=rc.session_id where rc.id=$1`, [data.id]))[0];
    if (!rc) throw new Error("Recipient not found.");
    if (rc.method !== "MANUAL_WHATSAPP") throw new Error("Historical automated messages are read-only.");
    if (rc.session_status !== "active") throw new Error(rc.session_status === "paused" ? "Resume the session first." : "This session is finished.");
    const to = nextStatus(rc.status, data.status);
    // Guarded update: only applies if nobody changed it meanwhile (two tabs / double clicks).
    const upd = await q(`update wa_send_recipients set status=$2, updated_by=$3, updated_at=now(), sent_at = case when $2='sent' then now() else sent_at end
                         where id=$1 and status=$4 returning id`, [data.id, to, u.id, rc.status]);
    if (!upd.length) throw new Error("This recipient was just updated. Refresh.");
    const left = (await q<any>(`select count(*) n from wa_send_recipients where session_id=$1 and status in ('pending','opened')`, [rc.session_id]))[0];
    if (num(left.n) === 0) await q(`update wa_send_sessions set status='completed' where id=$1`, [rc.session_id]);
    return { ok: true };
  });

export const setWaSessionStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; action: "pause" | "resume" }) => d)
  .handler(async ({ data }) => {
    const u = await requireSender();
    await requireSessionAccess(u, data.id);
    const ss = (await q<any>(`select status, method from wa_send_sessions where id=$1`, [data.id]))[0];
    if (!ss) throw new Error("Session not found.");
    if (ss.method !== "MANUAL_WHATSAPP") throw new Error("Historical automated messages are read-only.");
    const left = (await q<any>(`select count(*) n from wa_send_recipients where session_id=$1 and status in ('pending','opened')`, [data.id]))[0];
    const st = sessionAfter(ss.status, data.action, num(left.n) === 0);
    await q(`update wa_send_sessions set status=$2 where id=$1`, [data.id, st]);
    return { status: st };
  });

export const listWaSessions = createServerFn({ method: "POST" })
  .inputValidator((d: { from?: string; to?: string; branchId?: string; templateId?: string; residentId?: string; status?: string; method?: string }) => d)
  .handler(async ({ data }) => {
    const u = await requireSender();
    if (data.branchId) assertBranchAccess(u, data.branchId);
    return q<any>(
      `select ss.id, ss.created_at, ss.template_title, ss.billing_month::text as billing_month, ss.recipient_category, ss.method, ss.status, br.name as branch_name, u.full_name as by_name,
         count(rc.id) total, count(*) filter (where rc.status in ('sent','accepted','delivered','read')) sent, count(*) filter (where rc.status in ('pending','opened','queued','submitted')) pending,
         count(*) filter (where rc.status='skipped') skipped, count(*) filter (where rc.status='failed') failed
       from wa_send_sessions ss left join branches br on br.id=ss.branch_id left join app_users u on u.id=ss.created_by
       left join wa_send_recipients rc on rc.session_id=ss.id
       where ($8::uuid[] is null or ((ss.branch_id is null or ss.branch_id = any($8)) and exists (select 1 from wa_send_recipients x where x.session_id=ss.id) and not exists (select 1 from wa_send_recipients x join residents r on r.id=x.resident_id where x.session_id=ss.id and (not (r.branch_id = any($8)) or not ${historyScope("r", 8)}))))
         and ($1::date is null or ss.created_at >= $1::date) and ($2::date is null or ss.created_at < $2::date + 1)
         and ($3::uuid is null or ss.branch_id=$3) and ($4::uuid is null or ss.template_id=$4) and ($6::text is null or ss.method=$6)
         and ($5::uuid is null or exists (select 1 from wa_send_recipients x where x.session_id=ss.id and x.resident_id=$5))
         and ($7::text is null or exists (select 1 from wa_send_recipients x where x.session_id=ss.id and x.status=$7))
       group by ss.id, br.name, u.full_name order by ss.created_at desc limit 200`,
      [data.from || null, data.to || null, data.branchId || null, data.templateId || null, data.residentId || null, data.method || null, data.status || null, branchScope(u)]);
  });

export const getWaSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireSender();
  const s = (await q<any>("select overdue_cooldown_days from settings where id=1"))[0];
  return { manual: "available", reminderGapDays: num(s?.overdue_cooldown_days) };
});
