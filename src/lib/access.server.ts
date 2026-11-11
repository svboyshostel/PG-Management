import { q } from "./db.server";
import { assertBranchAccess } from "./access";
import type { SessionUser } from "./auth.server";

export async function requireEntityAccess(user: SessionUser, kind: "resident" | "room" | "bed" | "line" | "txn", id: string | undefined) {
  if (!id) throw new Error("Choose a record.");
  const statements = {
    resident: "select branch_id from residents where id=$1",
    room: "select branch_id from rooms where id=$1",
    bed: "select r.branch_id from beds b join rooms r on r.id=b.room_id where b.id=$1",
    line: "select b.branch_id, b.resident_id from bill_lines l join bills b on b.id=l.bill_id where l.id=$1",
    txn: "select r.branch_id, r.id as resident_id from money_txns t join residents r on r.id=t.resident_id where t.id=$1",
  };
  const record = (await q<{ branch_id: string; resident_id?: string }>(statements[kind], [id]))[0];
  assertBranchAccess(user, record?.branch_id);
  if (record?.resident_id) await requireEntityAccess(user, "resident", record.resident_id);
  if (kind === "resident" && user.role !== "owner") {
    const outside = await q(`select 1 from bills where resident_id=$1 and not (branch_id = any($2::uuid[]))
      union all select 1 from allocations a join beds b on b.id=a.bed_id join rooms r on r.id=b.room_id
      where a.resident_id=$1 and not (r.branch_id = any($2::uuid[])) limit 1`, [id, user.branch_ids ?? []]);
    if (outside.length) throw new Error("This resident has history in another branch. Ask the owner for access.");
  }
}

/** A mixed-branch session is never disclosed to staff with incomplete access. */
export async function requireSessionAccess(user: SessionUser, id: string) {
  if (user.role === "owner") return;
  const allowed = await q(`select ss.id from wa_send_sessions ss where ss.id=$1
    and (ss.branch_id is null or ss.branch_id = any($2::uuid[]))
    and exists (select 1 from wa_send_recipients rc where rc.session_id=ss.id)
    and not exists (select 1 from wa_send_recipients rc join residents r on r.id=rc.resident_id
      where rc.session_id=ss.id and (not (r.branch_id = any($2::uuid[]))
        or exists (select 1 from bills b where b.resident_id=r.id and not (b.branch_id = any($2::uuid[])))
        or exists (select 1 from allocations a join beds bd on bd.id=a.bed_id join rooms rm on rm.id=bd.room_id
          where a.resident_id=r.id and not (rm.branch_id = any($2::uuid[])))))`, [id, user.branch_ids ?? []]);
  if (!allowed.length) throw new Error("You don't have access to this message session.");
}

export async function requireRecipientAccess(user: SessionUser, id: string) {
  const row = (await q<{ session_id: string; resident_id: string }>("select session_id, resident_id from wa_send_recipients where id=$1", [id]))[0];
  if (!row) throw new Error("Recipient not found.");
  await requireEntityAccess(user, "resident", row.resident_id);
  await requireSessionAccess(user, row.session_id);
}