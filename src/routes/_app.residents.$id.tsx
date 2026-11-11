import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { ResidentDocuments } from "@/components/app/resident-documents";
import { getResident, collectPayment, addCharges, reverseLine, reverseTxn, changeRoom, vacantBeds, checkoutResident, recordRefund, markSent, updateResident } from "@/lib/pg.functions";
import { inr, toPaise, today, monthStart, monthLabel, dateLabel, waLink } from "@/lib/money";
import { renderTemplate, breakdownText, logTypeForCategory, isGapLimited, canSendMessages } from "@/lib/wa";
import { PageHeader, Stat, Empty, useAction, newKey } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuardianIdFields, type GuardianId } from "@/components/app/guardian-id";
import { depositLabel, ID_TYPE_LABEL, CATEGORIES } from "@/lib/rules";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/residents/$id")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Resident — PG Manager" }, { name: "description", content: "Resident bills, payments, deposit and messages." },
    { property: "og:title", content: "Resident — PG Manager" }, { property: "og:description", content: "Resident bills, payments, deposit and messages." }] }),
  component: ResidentPage,
});

type D = Awaited<ReturnType<typeof getResident>>;
const Sel = (p: any) => <select {...p} className="h-9 w-full rounded-md border bg-card px-2 text-sm" />;
const Field = ({ label, children }: { label: string; children: ReactNode }) => <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;

function ResidentPage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["resident", id], queryFn: () => getResident({ data: { id } }) });
  const [dlg, setDlg] = useState<string | null>(null);
  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !data) return <Empty title="Couldn't load resident"><Button onClick={() => refetch()}>Retry</Button></Empty>;
  const r = data.resident;
  const active = r.status === "active";
  const close = () => setDlg(null);
  const canReverse = user.role === "owner" || user.can_reverse;

  return (
    <div>
      <PageHeader title={r.name} sub={`${r.code} · ${r.mobile} · ${r.branch_name}${data.current ? ` · Room ${data.current.room_number}-${data.current.label}` : ""}`}
        actions={<>
          {active && <Button onClick={() => setDlg("pay")}>Collect payment</Button>}
          <Button variant="outline" onClick={() => setDlg("charge")}>Charge / discount</Button>
          {canSendMessages(user) && <Button variant="outline" onClick={() => setDlg("wa")}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>}
          <Button variant="outline" onClick={() => setDlg("edit")}>Edit</Button>
          {active && <Button variant="outline" onClick={() => setDlg("move")}>Change room</Button>}
          {active ? <Button variant="destructive" onClick={() => setDlg("checkout")}>Checkout</Button>
            : (data.depositHeld > 0 || data.credit > 0) && <Button onClick={() => setDlg("refund")}>Record refund</Button>}
        </>} />
      {!active && <div className="mb-4"><Badge variant="secondary">Checked out on {dateLabel(r.checkout_date)}</Badge></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pending" value={inr(data.outstanding)} tone={data.outstanding ? "bad" : "good"} hint={data.oldestDue ? `oldest due ${dateLabel(data.oldestDue)}` : "All clear"} />
        <Stat label="Advance / credit" value={inr(data.credit)} />
        <Stat label={`Deposit · ${depositLabel[data.deposit.status]}`} value={inr(data.deposit.received)} tone={data.deposit.status === "pending" || data.deposit.status === "partial" ? "bad" : "good"}
          hint={`Agreed ${inr(data.deposit.agreed)} · balance ${inr(data.deposit.balance)} · held now ${inr(data.depositHeld)}`} />
        <Stat label="Monthly rent" value={data.current ? inr(data.current.monthly_rent) : "—"} hint={`Joined ${dateLabel(r.joining_date)}`} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Card className="p-4 text-sm"><div className="mb-2 font-display font-semibold">This month's bill · {monthLabel(data.breakdown.month)}</div>
          {([["Monthly rent", data.breakdown.rent], ["Electricity", data.breakdown.electricity], ["Water", data.breakdown.water], ["Cleaning", data.breakdown.cleaning],
            ["Maintenance", data.breakdown.maintenance], ["Other charges", data.breakdown.other], ["Discounts & adjustments", data.breakdown.discountsAndAdjustments]] as [string, number][])
            .filter(([k, v]) => v !== 0 || k === "Monthly rent").map(([k, v]) => <div key={k} className="flex justify-between py-0.5"><span>{k}</span><span>{inr(v)}</span></div>)}
          <div className="mt-1 flex justify-between border-t pt-1"><span>Previous unpaid</span><span>{inr(data.breakdown.previousOutstanding)}</span></div>
          <div className="flex justify-between"><span>Paid towards this bill</span><span>−{inr(data.breakdown.paymentsReceived)}</span></div>
          <div className="flex justify-between font-semibold"><span>Total outstanding</span><span>{inr(data.breakdown.totalOutstanding)}</span></div>
          <div className="text-xs text-muted-foreground">Due {dateLabel(data.breakdown.dueDate)}</div></Card>
        <Card className="p-4 text-sm"><div className="mb-2 font-display font-semibold">Guardian & ID</div>
          <div>{r.guardian_name || "—"}{r.guardian_relation && ` (${r.guardian_relation})`}{r.guardian_phone && ` · ${r.guardian_phone}`}</div>
          <div className="mt-1">{r.id_method === "manual" ? `${ID_TYPE_LABEL[r.id_type] ?? r.id_type}: ${r.id_number}` : r.id_method === "upload" || r.id_doc_key ? `${r.id_type ? (ID_TYPE_LABEL[r.id_type] ?? r.id_type) : "ID"}: Private document uploaded` : "ID not collected"}
            {(r.id_method || r.id_doc_key) && <Badge variant={r.id_verification === "verified" ? "default" : r.id_verification === "rejected" ? "destructive" : "secondary"} className="ml-2 capitalize">{r.id_verification}</Badge>}</div>
          <ResidentDocuments residentId={r.id} /></Card>
      </div>

      <Tabs defaultValue="bills" className="mt-6">
        <TabsList><TabsTrigger value="bills">Bills</TabsTrigger><TabsTrigger value="money">Payments</TabsTrigger><TabsTrigger value="rooms">Room history</TabsTrigger><TabsTrigger value="msg">Messages</TabsTrigger></TabsList>
        <TabsContent value="bills" className="space-y-3">
          {data.bills.length === 0 && <p className="text-sm text-muted-foreground">No bills yet.</p>}
          {data.bills.map((b: any) => (
            <Card key={b.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-display font-semibold">{monthLabel(b.billing_month)} <span className="text-xs font-normal text-muted-foreground">due {dateLabel(b.due_date)}</span></div>
                <div className="text-sm">{inr(b.payable)} · paid {inr(b.paid)} {b.outstanding > 0 ? <Badge variant="destructive" className="ml-1">{inr(b.outstanding)} due</Badge> : <Badge className="ml-1 bg-success text-primary-foreground">Paid</Badge>}</div>
              </div>
              <div className="mt-2 divide-y text-sm">
                {b.lines.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between py-1.5">
                    <div className={l.reversed ? "text-muted-foreground line-through" : ""}>{l.description}{l.reason && <span className="text-xs text-muted-foreground"> — {l.reason}</span>}</div>
                    <div className="flex items-center gap-2"><span className={Number(l.amount) < 0 ? "text-success" : ""}>{inr(l.amount)}</span>
                      {!l.reversed && l.kind !== "reversal" && (l.kind !== "rent" || user.role === "owner") && <ReverseBtn kind="line" id={l.id} />}</div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="money">
          <Card className="divide-y">
            {data.txns.length === 0 && <p className="p-4 text-sm text-muted-foreground">No payments yet.</p>}
            {data.txns.map((t: any) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div><div className={t.reversed ? "line-through text-muted-foreground" : "font-medium"}>{t.purpose.replace(/_/g, " ")} · {t.account}</div>
                  <div className="text-xs text-muted-foreground">{dateLabel(t.txn_date)} · {t.method}{t.reference && ` · ${t.reference}`}{t.note && ` · ${t.note}`} · by {t.by_name ?? "—"}</div></div>
                <div className="flex items-center gap-2"><span className={t.direction === "in" ? "text-success font-semibold" : "text-destructive font-semibold"}>{t.direction === "in" ? "+" : "−"}{inr(t.amount)}</span>
                  {canReverse && !t.reversed && t.purpose !== "reversal" && t.method !== "internal" && <ReverseBtn kind="txn" id={t.id} />}</div>
              </div>
            ))}
          </Card>
        </TabsContent>
        <TabsContent value="rooms">
          <Card className="divide-y">{data.allocations.map((a: any) => (
            <div key={a.id} className="flex justify-between p-3 text-sm"><div>{a.branch_name} · Room {a.room_number}-{a.label}</div>
              <div className="text-muted-foreground">{dateLabel(a.start_date)} → {a.end_date ? dateLabel(a.end_date) : "now"} · {inr(a.monthly_rent)}</div></div>))}</Card>
        </TabsContent>
        <TabsContent value="msg">
          <Card className="divide-y">{data.messageHistory.length === 0 && <p className="p-4 text-sm text-muted-foreground">No WhatsApp messages yet.</p>}
            {data.messageHistory.map((m: any) => (
              <details key={m.source + m.id} className="p-3 text-sm">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                  <span className="font-medium">{m.template}</span>
                  <Badge variant={m.method === "MANUAL_WHATSAPP" ? "outline" : "default"}>{m.statusLabel}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(m.at).toLocaleString("en-IN")} · {m.method === "MANUAL_WHATSAPP" ? "Manual WhatsApp" : "Historical automated message"}{m.by ? ` · by ${m.by}` : ""}</span>
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{m.text}</p>
                {m.providerId && <p className="mt-1 break-all text-xs text-muted-foreground">Meta message ID: {m.providerId}</p>}
                {m.error && <p className="mt-1 text-xs text-destructive">{m.error}</p>}
                {m.events?.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Meta updates: {m.events.map((e: any) => `${e.status} ${new Date(e.at).toLocaleString("en-IN")}`).join(" → ")}</p>}
                {!m.fullText && <p className="mt-1 text-xs italic text-muted-foreground">Only the owner can view the full message.</p>}
              </details>))}</Card>
        </TabsContent>
      </Tabs>

      {dlg === "pay" && <PayDialog d={data} onClose={close} />}
      {dlg === "charge" && <ChargeDialog d={data} onClose={close} />}
      {dlg === "move" && <MoveDialog d={data} onClose={close} />}
      {dlg === "checkout" && <CheckoutDialog d={data} onClose={close} />}
      {dlg === "refund" && <RefundDialog d={data} onClose={close} />}
      {dlg === "wa" && <WaDialog d={data} onClose={close} />}
      {dlg === "edit" && <EditDialog d={data} onClose={close} />}
    </div>
  );
}

function ReverseBtn({ kind, id }: { kind: "line" | "txn"; id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const m = useAction((v: any) => (kind === "line" ? reverseLine({ data: { lineId: id, reason: v } }) : reverseTxn({ data: { txnId: id, reason: v } })), "Reversed", () => setOpen(false));
  return (<>
    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>Reverse</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent>
      <DialogHeader><DialogTitle>Reverse this {kind === "line" ? "charge" : "payment"}?</DialogTitle><DialogDescription>Records are never deleted; a matching reversal entry is added.</DialogDescription></DialogHeader>
      <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <DialogFooter><Button variant="destructive" disabled={!reason.trim() || m.isPending} onClick={() => m.mutate(reason)}>Confirm reversal</Button></DialogFooter>
    </DialogContent></Dialog>
  </>);
}

function Shell({ title, desc, onClose, children, footer }: { title: string; desc?: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  return <Dialog open onOpenChange={(v) => !v && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto">
    <DialogHeader><DialogTitle>{title}</DialogTitle>{desc && <DialogDescription>{desc}</DialogDescription>}</DialogHeader>
    <div className="space-y-3">{children}</div><DialogFooter>{footer}</DialogFooter></DialogContent></Dialog>;
}

function PayDialog({ d, onClose }: { d: D; onClose: () => void }) {
  const [idem] = useState(newKey);
  const [f, setF] = useState({ account: "rent", amount: d.outstanding ? String(d.outstanding / 100) : "", method: "upi", reference: "", date: today() });
  const m = useAction((v: any) => collectPayment({ data: v }), "Payment recorded", onClose);
  const p = toPaise(f.amount);
  return <Shell title="Collect payment" desc={`Pending rent: ${inr(d.outstanding)}. Rent is applied to the oldest bill first; extra becomes advance.`} onClose={onClose}
    footer={<Button disabled={!(p > 0) || m.isPending} onClick={() => m.mutate({ residentId: d.resident.id, ...f, amount: p, idem })}>{m.isPending ? "Saving…" : `Record ${p > 0 ? inr(p) : ""}`}</Button>}>
    <Field label="For"><Sel value={f.account} onChange={(e: any) => setF({ ...f, account: e.target.value })}><option value="rent">Rent & charges</option><option value="deposit">Security deposit</option></Sel></Field>
    <Field label="Amount (₹)"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
    <Field label="Method"><Sel value={f.method} onChange={(e: any) => setF({ ...f, method: e.target.value })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option></Sel></Field>
    <Field label="Reference (optional)"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
    <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
  </Shell>;
}

function ChargeDialog({ d, onClose }: { d: D; onClose: () => void }) {
  const [f, setF] = useState({ kind: "extra_charge", category: "other", description: "", amount: "", reason: "", month: monthStart().slice(0, 7) });
  const m = useAction((v: any) => addCharges({ data: v }), "Saved", onClose);
  const p = toPaise(f.amount);
  return <Shell title="Add charge, discount or adjustment" onClose={onClose}
    footer={<Button disabled={!(p > 0) || !f.description || m.isPending} onClick={() => m.mutate({ residentIds: [d.resident.id], month: f.kind === "extra_charge" ? undefined : f.month + "-01", description: f.description, amount: p, mode: "each", kind: f.kind, reason: f.reason, category: f.category })}>Save</Button>}>
    <Field label="Type"><Sel value={f.kind} onChange={(e: any) => setF({ ...f, kind: e.target.value })}><option value="extra_charge">Extra charge</option><option value="discount">Discount</option><option value="adjustment">Adjustment (added to bill)</option></Sel></Field>
    {f.kind === "extra_charge" ? <><Field label="Category"><Sel value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c[0]!.toUpperCase() + c.slice(1)}</option>)}</Sel></Field>
      <p className="text-xs text-muted-foreground">Goes on the {monthLabel(d.nextChargeMonth)} bill (on or before the due day it's this month's bill; after it, next month's).</p></>
      : <Field label="Month"><Input type="month" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} /></Field>}
    <Field label="Description"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Electricity, laundry…" /></Field>
    <Field label="Amount (₹)"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
    {f.kind !== "extra_charge" && <Field label="Reason (required)"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>}
  </Shell>;
}

function MoveDialog({ d, onClose }: { d: D; onClose: () => void }) {
  const { data: beds } = useQuery({ queryKey: ["vacant"], queryFn: () => vacantBeds() });
  const [f, setF] = useState({ bedId: "", date: today(), rent: d.current ? String(Number(d.current.monthly_rent) / 100) : "" });
  const m = useAction((v: any) => changeRoom({ data: v }), "Room changed", onClose);
  return <Shell title="Change room" desc="This month's bill stays as is. Add an adjustment if needed. New rent applies from next month." onClose={onClose}
    footer={<Button disabled={!f.bedId || m.isPending} onClick={() => m.mutate({ residentId: d.resident.id, bedId: f.bedId, date: f.date, monthlyRent: toPaise(f.rent) })}>Move</Button>}>
    <Field label="New bed"><Sel value={f.bedId} onChange={(e: any) => { const b = beds?.find((x) => x.bed_id === e.target.value); setF({ ...f, bedId: e.target.value, rent: b ? String(Number(b.bed_rent) / 100) : f.rent }); }}>
      <option value="">Choose</option>{(beds ?? []).map((b) => <option key={b.bed_id} value={b.bed_id}>{b.branch_name} · {b.room_number}-{b.label} — {inr(b.bed_rent)}</option>)}</Sel></Field>
    <Field label="Move date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
    <Field label="New monthly rent (₹)"><Input inputMode="decimal" value={f.rent} onChange={(e) => setF({ ...f, rent: e.target.value })} /></Field>
  </Shell>;
}

function CheckoutDialog({ d, onClose }: { d: D; onClose: () => void }) {
  const [date, setDate] = useState(today());
  const [ded, setDed] = useState<{ amount: string; reason: string }[]>([]);
  const [apply, setApply] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const m = useAction((v: any) => checkoutResident({ data: v }), "Checked out", onClose);
  const dedTotal = ded.reduce((s, x) => s + (toPaise(x.amount) || 0), 0);
  const afterDed = d.depositHeld - dedTotal;
  const applied = apply ? Math.min(Math.max(afterDed, 0), d.outstanding) : 0;
  const refund = Math.max(afterDed - applied, 0) + d.credit;
  const owed = d.outstanding - applied;
  return <Shell title={`Checkout ${d.resident.name}`} onClose={onClose}
    footer={<Button variant="destructive" disabled={!confirm || afterDed < 0 || m.isPending}
      onClick={() => m.mutate({ residentId: d.resident.id, date, applyDeposit: apply, deductions: ded.map((x) => ({ amount: toPaise(x.amount) || 0, reason: x.reason })) })}>Confirm checkout</Button>}>
    <Field label="Checkout date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
    <p className="text-xs text-muted-foreground">No proration: add a discount first if you want to refund unused days.</p>
    <div className="space-y-2"><Label>Deposit deductions</Label>
      {ded.map((x, i) => <div key={i} className="flex gap-2"><Input placeholder="₹" className="w-28" value={x.amount} onChange={(e) => setDed(ded.map((y, j) => j === i ? { ...y, amount: e.target.value } : y))} />
        <Input placeholder="Reason (damage, cleaning…)" value={x.reason} onChange={(e) => setDed(ded.map((y, j) => j === i ? { ...y, reason: e.target.value } : y))} /></div>)}
      <Button size="sm" variant="outline" onClick={() => setDed([...ded, { amount: "", reason: "" }])}>+ Add deduction</Button></div>
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={apply} onCheckedChange={(v) => setApply(!!v)} /> Use deposit to clear pending dues</label>
    <Card className="space-y-1 bg-muted/50 p-3 text-sm">
      <div className="flex justify-between"><span>Deposit held</span><b>{inr(d.depositHeld)}</b></div>
      <div className="flex justify-between"><span>Deductions</span><b>−{inr(dedTotal)}</b></div>
      <div className="flex justify-between"><span>Pending dues</span><b>{inr(d.outstanding)}</b></div>
      <div className="flex justify-between"><span>Deposit used for dues</span><b>−{inr(applied)}</b></div>
      <div className="flex justify-between border-t pt-1"><span>Refund to resident</span><b className="text-success">{inr(refund)}</b></div>
      {owed > 0 && <div className="flex justify-between"><span>Still owed by resident</span><b className="text-destructive">{inr(owed)}</b></div>}
      {afterDed < 0 && <div className="text-destructive">Deductions are more than the deposit.</div>}
    </Card>
    <label className="flex items-center gap-2 text-sm"><Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(!!v)} /> I confirm these amounts. The bed will be freed.</label>
  </Shell>;
}

function RefundDialog({ d, onClose }: { d: D; onClose: () => void }) {
  const [idem] = useState(newKey);
  const [f, setF] = useState({ account: d.depositHeld > 0 ? "deposit" : "rent", amount: "", method: "upi", reference: "", date: today() });
  const max = f.account === "deposit" ? d.depositHeld : d.credit;
  const m = useAction((v: any) => recordRefund({ data: v }), "Refund recorded", onClose);
  const p = toPaise(f.amount);
  return <Shell title="Record refund" desc={`Deposit held ${inr(d.depositHeld)} · advance ${inr(d.credit)}`} onClose={onClose}
    footer={<Button disabled={!(p > 0) || p > max || m.isPending} onClick={() => m.mutate({ residentId: d.resident.id, ...f, amount: p, idem })}>Record {p > 0 && inr(p)}</Button>}>
    <Field label="From"><Sel value={f.account} onChange={(e: any) => setF({ ...f, account: e.target.value })}><option value="deposit">Deposit</option><option value="rent">Advance / credit</option></Sel></Field>
    <Field label={`Amount (max ${inr(max)})`}><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
    <Field label="Method"><Sel value={f.method} onChange={(e: any) => setF({ ...f, method: e.target.value })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option></Sel></Field>
    <Field label="Reference"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
    <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
  </Shell>;
}

function WaDialog({ d, onClose }: { d: D; onClose: () => void }) {
  const s = d.settings;
  const cur = d.bills.find((b: any) => b.billing_month === monthStart());
  const due = dateLabel(d.breakdown.dueDate ?? d.oldestDue ?? today());
  const [tplId, setTplId] = useState(d.templates[0]?.id ?? "");
  const t = d.templates.find((x: any) => x.id === tplId) ?? d.templates[0];
  const vars = {
    name: d.resident.name, pg: s.pg_name, room: d.current?.room_number ?? "", bed: d.current?.label ?? "",
    rent: d.current ? inr(d.current.monthly_rent) : "", balance: inr(d.outstanding),
    current_balance: inr(d.breakdown.thisBill), previous_balance: inr(d.breakdown.previousOutstanding),
    deposit_balance: inr(d.deposit.balance), month: monthLabel(monthStart()), due_date: due,
    bill_breakdown: breakdownText(d.breakdown, due),
  };
  const [text, setText] = useState(() => (t ? renderTemplate(t.body, vars) : ""));
  const [opened, setOpened] = useState(false);
  const limited = t ? isGapLimited(logTypeForCategory(t.category)) : false;
  const lastOver = d.notifications.find((n: any) => n.type === "overdue");
  const coolLeft = lastOver ? Number(s.overdue_cooldown_days) - (Date.now() - new Date(lastOver.marked_at).getTime()) / 86400000 : 0;
  const m = useAction((v: any) => markSent({ data: v }), "Marked as sent", onClose);
  return <Shell title="Send on WhatsApp" desc="Opens WhatsApp with the message. After sending, tap Mark as sent." onClose={onClose}
    footer={<div className="flex w-full flex-wrap justify-end gap-2">
      <Button variant="outline" asChild><a href={waLink(d.resident.mobile, text)} target="_blank" rel="noreferrer" onClick={() => setOpened(true)}>Open WhatsApp</a></Button>
      <Button disabled={!opened || !t || m.isPending || (limited && coolLeft > 0)} onClick={() => m.mutate({ residentId: d.resident.id, templateId: t.id, month: monthStart(), amount: cur?.outstanding ?? d.outstanding, message: text })}>Mark as sent</Button></div>}>
    {d.templates.length === 0 && <p className="text-sm text-muted-foreground">No message templates yet. Add one in the WhatsApp menu, then come back here.</p>}
    {d.templates.length > 0 && <Field label="Template (the same list as in the WhatsApp menu)"><Sel value={tplId} onChange={(e: any) => { setTplId(e.target.value); const x = d.templates.find((y: any) => y.id === e.target.value); setText(x ? renderTemplate(x.body, vars) : ""); setOpened(false); }}>
      {d.templates.map((x: any) => <option key={x.id} value={x.id}>{x.title}</option>)}</Sel></Field>}
    {limited && coolLeft > 0 && <p className="text-sm text-warning">Last reminder was recent. Next allowed in {Math.ceil(coolLeft)} day(s).</p>}
    <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
  </Shell>;
}

function EditDialog({ d, onClose }: { d: D; onClose: () => void }) {
  const { user } = Route.useRouteContext();
  const r = d.resident;
  const [f, setF] = useState({ name: r.name, mobile: r.mobile, altMobile: r.alt_mobile ?? "", deposit: String(Number(r.deposit_agreed) / 100), notes: r.notes ?? "", idVerification: r.id_verification ?? "pending" });
  const [g, setG] = useState<GuardianId>({ guardianName: r.guardian_name ?? "", guardianRelation: r.guardian_relation ?? "", guardianPhone: r.guardian_phone ?? "", idMethod: r.id_method ?? "", idType: r.id_type ?? "", idNumber: r.id_number ?? "" });
  const m = useAction((v: any) => updateResident({ data: v }), "Saved", onClose);
  return <Shell title="Edit resident" onClose={onClose}
    footer={<Button disabled={m.isPending} onClick={() => m.mutate({ id: r.id, name: f.name, mobile: f.mobile, altMobile: f.altMobile, depositAgreed: toPaise(f.deposit || 0), notes: f.notes,
      ...g, idMethod: g.idMethod || null, idType: g.idType || null, idNumber: g.idNumber || null, idVerification: f.idVerification })}>Save</Button>}>
    <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
    <Field label="Mobile"><Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></Field>
    <Field label="Alternate mobile"><Input value={f.altMobile} onChange={(e) => setF({ ...f, altMobile: e.target.value })} /></Field>
    <Field label="Deposit agreed (₹)"><Input value={f.deposit} onChange={(e) => setF({ ...f, deposit: e.target.value })} /></Field>
    <GuardianIdFields v={g} set={(p) => setG((o) => ({ ...o, ...p }))} />
    {g.idMethod && <Field label="ID verification">{user.role === "owner"
      ? <Sel value={f.idVerification} onChange={(e: any) => setF({ ...f, idVerification: e.target.value })}><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></Sel>
      : <p className="text-sm capitalize">{f.idVerification} <span className="text-xs text-muted-foreground">(owner changes this)</span></p>}</Field>}
    <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
    <Link to="/residents" className="text-xs text-muted-foreground underline">Back to residents</Link>
  </Shell>;
}
