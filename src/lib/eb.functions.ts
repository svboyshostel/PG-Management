import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { q, tx } from "./db.server";
import { requireOwner } from "./auth.server";
import { requireEntityAccess } from "./access.server";
import { calculateEb, reconcileEb, type Occupancy } from "./eb";
import { calendarMonth } from "./validation";
import { chargeMonthFor, pgToday } from "./rules";

const selection = z.object({ roomId: z.string().uuid(), month: calendarMonth });
async function ready() {
  if (!(await q<{ ok: boolean }>("select to_regclass('public.room_eb_bills') is not null as ok"))[0]?.ok) throw new Error("Room electricity billing needs the prepared database update. Ask the owner to apply it.");
}
async function occupancy(roomId: string, month: string) {
  return q<Occupancy>(`select a.id, a.resident_id, r.name, a.start_date::text, a.end_date::text, r.status from allocations a
    join beds b on b.id=a.bed_id join residents r on r.id=a.resident_id where b.room_id=$1 and a.start_date<$2::date+interval '1 month'
    and (a.end_date is null or a.end_date>=$2::date) order by a.id`, [roomId, month]);
}
export const getRoomEb = createServerFn({ method: "GET" }).inputValidator((d) => selection.parse(d)).handler(async ({ data }) => {
  const u = await requireOwner(); await requireEntityAccess(u, "room", data.roomId); await ready();
  const bill = (await q<any>("select *,billing_month::text from room_eb_bills where room_id=$1 and billing_month=$2", [data.roomId, data.month]))[0] ?? null;
  const history = await q<any>("select id,billing_month::text,status,total from room_eb_bills where room_id=$1 order by billing_month desc", [data.roomId]);
  const liabilities = bill ? await q<any>("select l.*,r.name from room_eb_liabilities l join residents r on r.id=l.resident_id where eb_id=$1", [bill.id]) : [];
  return { bill, history, liabilities };
});
export const previewRoomEb = createServerFn({ method: "POST" }).inputValidator((d) => selection.extend({ total: z.number().int().nonnegative().safe() }).parse(d)).handler(async ({ data }) => {
  const u = await requireOwner(); await requireEntityAccess(u, "room", data.roomId);
  return calculateEb(data.month, data.total, await occupancy(data.roomId, data.month));
});
const draftInput = selection.extend({ total: z.number().int().nonnegative().safe(), version: z.number().int().nonnegative(),
  shares: z.array(z.object({ residentId: z.string().uuid(), final: z.number().int().nonnegative().safe() })), ownerAccepted: z.boolean() });
export const saveRoomEb = createServerFn({ method: "POST" }).inputValidator((d) => draftInput.parse(d)).handler(async ({ data }) => {
  const u = await requireOwner(); await requireEntityAccess(u, "room", data.roomId); await ready();
  const history = await occupancy(data.roomId, data.month), calculated = calculateEb(data.month, data.total, history);
  const edits = new Map(data.shares.map((s) => [s.residentId, s.final]));
  if (edits.size !== calculated.shares.length || data.shares.length !== edits.size || calculated.shares.some((s) => !edits.has(s.residentId))) throw new Error("Occupancy changed. Calculate EB again.");
  const shares = calculated.shares.map((s) => ({ ...s, final: edits.get(s.residentId) ?? s.final }));
  // Drafts can be unbalanced; finalization cannot.
  const owner = Math.max(0, data.total - shares.reduce((a, s) => a + s.final, 0));
  const id = crypto.randomUUID();
  const result = await tx([{ text: `insert into room_eb_bills(id,room_id,billing_month,total,owner_amount,owner_accepted,occupancy,shares,created_by,updated_by)
    select $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$9 where $10=0 or exists(select 1 from room_eb_bills where room_id=$2 and billing_month=$3 and version=$10 and status='draft')
    on conflict(room_id,billing_month) do update set total=$4,owner_amount=$5,owner_accepted=$6,occupancy=$7::jsonb,shares=$8::jsonb,
    version=room_eb_bills.version+1,updated_by=$9,updated_at=now() where room_eb_bills.status='draft' and room_eb_bills.version=$10 returning id,version`,
    params: [id, data.roomId, data.month, data.total, owner, data.ownerAccepted, JSON.stringify(history), JSON.stringify(shares), u.id, data.version] },
    { text: `insert into room_eb_audit(eb_id,action,snapshot,by_user) select id,'draft_saved',to_jsonb(b),$3 from room_eb_bills b where room_id=$1 and billing_month=$2 and status='draft' and version=$4`, params: [data.roomId, data.month, u.id, data.version + 1] }]);
  if (!result[0]?.length) throw new Error("Draft changed or already finalized. Reload it.");
  return result[0][0] as { id: string; version: number };
});
export const finalizeRoomEb = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ id: z.string().uuid(), version: z.number().int() }).parse(d)).handler(async ({ data }) => {
  const u = await requireOwner(); await ready();
  const bill = (await q<any>("select * from room_eb_bills where id=$1", [data.id]))[0];
  if (!bill) throw new Error("Bill not found."); await requireEntityAccess(u, "room", bill.room_id);
  reconcileEb(Number(bill.total), bill.shares, bill.owner_accepted);
  const s = (await q<any>("select timezone,default_due_day from settings where id=1"))[0];
  const today = pgToday(s.timezone), month = chargeMonthFor(today, s.default_due_day);
  await q("select finalize_room_eb($1,$2,$3,$4,$5,$6)", [data.id,data.version,u.id,month,today,s.default_due_day]);
  return { ok: true };
});
export const reconcileEbLiability = createServerFn({ method: "POST" }).inputValidator((d) => z.object({ id: z.string().uuid(), action: z.enum(["post","owner_borne"]), reason: z.string().trim().min(5).max(500) }).parse(d)).handler(async ({ data }) => {
  const u = await requireOwner(); await ready();
  // Dedicated post-checkout adjustment; no deposit, refund, historical bill or receipt is changed.
  const s = (await q<any>("select timezone,default_due_day from settings where id=1"))[0];
  const today = pgToday(s.timezone), month = chargeMonthFor(today,s.default_due_day);
  await tx([{ text: "select id from room_eb_liabilities where id=$1 for update", params: [data.id] },
    { text: `insert into bills(resident_id,branch_id,billing_month,due_date) select l.resident_id,rm.branch_id,$2::date,$2::date+($3::int-1)
      from room_eb_liabilities l join room_eb_bills eb on eb.id=l.eb_id join rooms rm on rm.id=eb.room_id where l.id=$1 and l.state='pending' and $4='post'
      on conflict(resident_id,billing_month) do nothing`, params:[data.id,month,s.default_due_day,data.action] },
    { text: `with posted as (insert into bill_lines(bill_id,kind,description,amount,reason,created_by,entry_date,service_month,category)
      select b.id,'extra_charge','Post-checkout EB adjustment',l.amount,$3,$4,$5,eb.billing_month,'electricity'
      from room_eb_liabilities l join room_eb_bills eb on eb.id=l.eb_id join bills b on b.resident_id=l.resident_id and b.billing_month=$2
      where l.id=$1 and l.state='pending' and $6='post' returning id)
      update room_eb_liabilities set state=case when $6='post' then 'posted' else 'owner_borne' end,line_id=(select id from posted),reason=$3,resolved_by=$4,resolved_at=now() where id=$1 and state='pending'`, params:[data.id,month,data.reason,u.id,today,data.action] },
    { text: `insert into room_eb_audit(eb_id,action,snapshot,by_user) select eb_id,'checkout_reconciled',to_jsonb(l),$2 from room_eb_liabilities l where id=$1`,params:[data.id,u.id] }]);
  return { ok: true };
});