import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { onboardResident, vacantBeds } from "@/lib/pg.functions";
import { inr, toPaise, today } from "@/lib/money";
import { PageHeader, Empty, useAction, newKey } from "@/components/app/bits";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GuardianIdFields, blankGuardianId, type GuardianId } from "@/components/app/guardian-id";

export const Route = createFileRoute("/_app/residents/new")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Add resident — PG Manager" }, { name: "description", content: "Onboard a new resident to a bed." },
    { property: "og:title", content: "Add resident — PG Manager" }, { property: "og:description", content: "Onboard a new resident to a bed." }] }),
  component: NewResident,
});

function NewResident() {
  const nav = useNavigate();
  const { data: beds, isLoading } = useQuery({ queryKey: ["vacant"], queryFn: () => vacantBeds() });
  const [idem] = useState(newKey);
  const [f, setF] = useState({ name: "", mobile: "", altMobile: "", bedId: "", joiningDate: today(), rent: "", depositAgreed: "", depositPaid: "", method: "cash", dueDay: "", notes: "" });
  const [g, setG] = useState<GuardianId>(blankGuardianId);
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }));
  const m = useAction((v: any) => onboardResident({ data: v }), "Resident added");

  const multiBranch = new Set((beds ?? []).map((b) => b.branch_id)).size > 1;
  if (!isLoading && (beds ?? []).length === 0)
    return <Empty title="No vacant beds">Add a branch and rooms first.<Button asChild><Link to="/rooms">Go to rooms</Link></Button></Empty>;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Add resident" />
      <Card className="p-6">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
          e.preventDefault();
          m.mutate({ name: f.name, mobile: f.mobile, altMobile: f.altMobile, bedId: f.bedId, joiningDate: f.joiningDate, monthlyRent: toPaise(f.rent),
            depositAgreed: toPaise(f.depositAgreed || 0), depositPaid: toPaise(f.depositPaid || 0), method: f.method, notes: f.notes, idem, ...g, idMethod: g.idMethod || null, idType: g.idType || null, idNumber: g.idNumber || null },
            { onSuccess: (r: any) => nav({ to: "/residents/$id", params: { id: r.id } }) });
        }}>
          <div className="space-y-1.5 sm:col-span-2"><Label>Full name</Label><Input required value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Mobile (WhatsApp)</Label><Input required inputMode="tel" value={f.mobile} onChange={(e) => set("mobile", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Alternate mobile</Label><Input inputMode="tel" value={f.altMobile} onChange={(e) => set("altMobile", e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Bed</Label>
            <select required className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={f.bedId} onChange={(e) => {
              const b = beds?.find((x) => x.bed_id === e.target.value); set("bedId", e.target.value); if (b) set("rent", String(Number(b.bed_rent) / 100));
            }}>
              <option value="">Choose a vacant bed</option>
              {Object.entries(groupBeds(beds ?? [])).map(([br, list]) => {
                const opts = list.map((b) => <option key={b.bed_id} value={b.bed_id}>{b.room_number} · {Number(b.sharing) === 1 ? "Single" : `${b.sharing} sharing`} {b.is_ac ? "AC" : "Non-AC"} — {inr(b.bed_rent)}</option>);
                return multiBranch ? <optgroup key={br} label={br}>{opts}</optgroup> : opts;
              })}
            </select></div>
          <div className="space-y-1.5"><Label>Joining date</Label><Input type="date" required value={f.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Monthly rent (₹)</Label><Input required inputMode="decimal" value={f.rent} onChange={(e) => set("rent", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Deposit agreed (₹)</Label><Input inputMode="decimal" value={f.depositAgreed} onChange={(e) => set("depositAgreed", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Deposit paid now (₹)</Label><Input inputMode="decimal" value={f.depositPaid} onChange={(e) => set("depositPaid", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Payment method</Label>
            <select className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={f.method} onChange={(e) => set("method", e.target.value)}>
              <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option></select></div>
          <GuardianIdFields v={g} set={(p) => setG((o) => ({ ...o, ...p }))} />
          <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          <div className="sm:col-span-2"><Button disabled={m.isPending} className="w-full">{m.isPending ? "Saving…" : "Add resident"}</Button></div>
        </form>
      </Card>
    </div>
  );
}

// One option per room + rent (any vacant bed in that room is equivalent), grouped by branch.
function groupBeds<T extends { branch_name: string; room_number: string; bed_rent: string }>(beds: T[]) {
  const seen = new Set<string>(); const out: Record<string, T[]> = {};
  for (const b of beds) { const k = `${b.branch_name}|${b.room_number}|${b.bed_rent}`; if (seen.has(k)) continue; seen.add(k); (out[b.branch_name] ??= []).push(b); }
  return out;
}
