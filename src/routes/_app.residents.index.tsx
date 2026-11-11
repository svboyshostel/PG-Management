import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listResidents, listBranches, listRooms, addCharges } from "@/lib/pg.functions";
import { RoomEb } from "@/components/app/room-eb";
import { inr, toPaise, splitEqual } from "@/lib/money";
import { PageHeader, Empty, useAction } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/_app/residents/")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Residents — PG Manager" }, { name: "description", content: "Search residents, see dues and add charges." },
    { property: "og:title", content: "Residents — PG Manager" }, { property: "og:description", content: "Search residents, see dues and add charges." }] }),
  component: Residents,
});

function Residents() {
  const [status, setStatus] = useState("active");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");
  const [pay, setPay] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [ebRoomId, setEbRoomId] = useState("");
  const [ebOpen, setEbOpen] = useState(false);
  const { user } = Route.useRouteContext();
  const { data: ebRooms } = useQuery({ queryKey: ["rooms", branch], queryFn: () => listRooms({ data: { branchId: branch || undefined } }) });
  const ebRoom = ebRooms?.find((r: any) => r.id === ebRoomId);
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => listBranches() });
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["residents", status, branch], queryFn: () => listResidents({ data: { status: status || undefined, branchId: branch || undefined } }) });

  const rows = useMemo(() => (data ?? []).filter((r: any) => {
    const s = search.toLowerCase();
    if (s && !(r.name.toLowerCase().includes(s) || r.mobile.includes(s) || r.code.toLowerCase().includes(s) || (r.room_number ?? "").toLowerCase().includes(s))) return false;
    if (pay === "due" && !(r.outstanding > 0)) return false;
    if (pay === "paid" && r.outstanding > 0) return false;
    if (pay === "unshared" && r.bill_shared) return false;
    return true;
  }), [data, search, pay]);

  const sel_ = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const active = rows.filter((r: any) => r.status === "active");
  const [target, setTarget] = useState<any[]>([]);
  const openFor = (list: any[]) => { setTarget(list); setOpen(true); };

  return (
    <div>
      <PageHeader title="Residents" sub={`${rows.length} shown`} actions={<>
        {sel.size > 0 && <Button variant="outline" onClick={() => openFor((data ?? []).filter((r: any) => sel.has(r.id)))}>Add charge to {sel.size}</Button>}
        <Button asChild><Link to="/residents/new">Add resident</Link></Button></>} />
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="font-display font-semibold">Extra charge for everyone</div>
          <p className="text-sm text-muted-foreground">Enter a total (e.g. electricity) and split it equally among the {active.length} active residents shown below. It's added to their bills automatically.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Button disabled={active.length === 0} onClick={() => openFor(active)}>Split among {active.length} residents</Button>
        {user.role === "owner" && <><select aria-label="Electricity billing room" className="h-9 max-w-full rounded-md border bg-card px-2 text-sm" value={ebRoomId} onChange={e => setEbRoomId(e.target.value)}><option value="">Choose EB room</option>{ebRooms?.map((r: any) => <option key={r.id} value={r.id}>{r.branch_name} · {r.room_number}</option>)}</select><Button variant="outline" disabled={!ebRoom} onClick={() => setEbOpen(true)}>Room-wise EB</Button></>}</div>
      </Card>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Search name, mobile, ID, room" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select className="h-9 rounded-md border bg-card px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option><option value="checked_out">Checked out</option><option value="">All</option>
        </select>
        <select className="h-9 rounded-md border bg-card px-2 text-sm" value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="">All branches</option>{(branches ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-card px-2 text-sm" value={pay} onChange={(e) => setPay(e.target.value)}>
          <option value="">Any payment</option><option value="due">Has dues</option><option value="paid">Fully paid</option><option value="unshared">Bill not shared</option>
        </select>
      </div>
      {isLoading ? <Skeleton className="h-64" /> : error ? <Empty title="Couldn't load residents"><Button onClick={() => refetch()}>Retry</Button></Empty>
        : rows.length === 0 ? <Empty title="No residents found"><Button asChild><Link to="/residents/new">Add your first resident</Link></Button></Empty> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="w-8 p-3"><Checkbox checked={sel.size === rows.length} onCheckedChange={(v) => setSel(v ? new Set(rows.map((r: any) => r.id)) : new Set())} /></th>
                <th className="p-3">Resident</th><th className="p-3">Room</th><th className="p-3">Rent</th><th className="p-3">This month</th><th className="p-3 text-right">Pending</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="p-3"><Checkbox checked={sel.has(r.id)} onCheckedChange={() => sel_(r.id)} /></td>
                  <td className="p-3"><Link to="/residents/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.name}</Link>
                    <div className="text-xs text-muted-foreground">{r.code} · {r.mobile}</div></td>
                  <td className="p-3">{r.room_number ? `${r.room_number}-${r.bed_label}` : <Badge variant="secondary">Checked out</Badge>}<div className="text-xs text-muted-foreground">{r.branch_name}</div></td>
                  <td className="p-3">{r.monthly_rent ? inr(r.monthly_rent) : "—"}</td>
                  <td className="p-3">
                    {r.overdue ? <Badge variant="destructive">Overdue</Badge> : r.currentPaid === null ? <span className="text-muted-foreground">—</span> : r.currentPaid ? <Badge className="bg-success text-primary-foreground">Paid</Badge> : <Badge variant="outline">Unpaid</Badge>}
                    {!r.bill_shared && r.status === "active" && <span className="ml-1 text-[11px] text-muted-foreground">not shared</span>}
                  </td>
                  <td className={`p-3 text-right font-semibold ${r.outstanding > 0 ? "text-destructive" : ""}`}>{inr(r.outstanding)}
                    {r.credit > 0 && <div className="text-xs font-normal text-success">credit {inr(r.credit)}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <BulkCharge open={open} onOpenChange={setOpen} people={target} onDone={() => setSel(new Set())} />
      {ebOpen && ebRoom && <RoomEb room={ebRoom} onClose={() => setEbOpen(false)} />}
    </div>
  );
}

function BulkCharge({ open, onOpenChange, people, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; people: any[]; onDone: () => void }) {
  const [desc, setDesc] = useState("Electricity");
  const [amt, setAmt] = useState("");
  const [mode, setMode] = useState<"split" | "each">("split");
  const m = useAction((v: any) => addCharges({ data: v }), "Charges added to bills", () => { setAmt(""); onOpenChange(false); onDone(); });
  const p = toPaise(amt);
  const parts = p > 0 ? (mode === "split" ? splitEqual(p, people.length) : people.map(() => p)) : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add charge to {people.length} residents</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="split" /> Split total equally</label>
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="each" /> Same amount each</label>
          </RadioGroup>
          <div className="space-y-1.5"><Label>{mode === "split" ? "Total amount (₹)" : "Amount per resident (₹)"}</Label><Input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} /></div>
          {parts.length > 0 && <>
            <p className="text-sm text-muted-foreground">Total {inr(parts.reduce((a, b) => a + b, 0))} · added to each resident's current bill period.</p>
            <div className="max-h-48 divide-y overflow-y-auto rounded-md border text-sm">
              {people.map((r, i) => <div key={r.id} className="flex justify-between px-3 py-1.5"><span>{r.name} <span className="text-xs text-muted-foreground">{r.room_number ? `Room ${r.room_number}` : ""}</span></span><b>{inr(parts[i])}</b></div>)}
            </div>
          </>}
        </div>
        <DialogFooter><Button disabled={m.isPending || !(p > 0) || !desc.trim() || people.length === 0} onClick={() => m.mutate({ residentIds: people.map((r) => r.id), description: desc, amount: p, mode })}>
          {m.isPending ? "Adding…" : "Confirm and add"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
