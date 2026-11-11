import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getSettings, saveSettings, listBranches, saveBranch, listStaff, saveStaff } from "@/lib/pg.functions";
import { upgradeSchema, getRecoveryStatus, createRecoveryCode } from "@/lib/auth.functions";
import { RecoveryCodeNotice } from "@/components/app/RecoveryCodeNotice";
import { PageHeader, Empty, useAction } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Settings — PG Manager" }, { name: "description", content: "Branches, staff, due dates and WhatsApp templates." },
    { property: "og:title", content: "Settings — PG Manager" }, { property: "og:description", content: "Branches, staff, due dates and WhatsApp templates." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  if (user.role !== "owner") return <Empty title="Only the owner can change settings" />;
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <Tabs defaultValue="branches">
        <TabsList><TabsTrigger value="branches">Branches</TabsTrigger><TabsTrigger value="general">General</TabsTrigger><TabsTrigger value="staff">Staff</TabsTrigger><TabsTrigger value="security">Security</TabsTrigger></TabsList>
        <TabsContent value="branches"><Branches /></TabsContent>
        <TabsContent value="general"><General /></TabsContent>
        <TabsContent value="staff"><Staff /></TabsContent>
        <TabsContent value="security"><Recovery /></TabsContent>
      </Tabs>
    </div>
  );
}

function Branches() {
  const { data } = useQuery({ queryKey: ["branches"], queryFn: () => listBranches() });
  const blank = { id: "", name: "", address: "" };
  const [f, setF] = useState(blank);
  const m = useAction((v: any) => saveBranch({ data: v }), "Saved", () => setF(blank));
  const payload = (x: any) => ({ id: x.id || undefined, name: x.name, address: x.address, is_active: x.is_active, due_window: null, due_day: null });
  return (
    <div className="space-y-4">
      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <Input placeholder="Branch name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input placeholder="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        <div className="flex gap-2">
          <Button className="flex-1" disabled={!f.name || m.isPending} onClick={() => m.mutate(payload(f))}>{f.id ? "Save branch" : "Add branch"}</Button>
          {f.id && <Button variant="outline" onClick={() => setF(blank)}>Cancel</Button>}
        </div>
      </Card>
      <Card className="divide-y">
        {(data ?? []).map((b: any) => (
          <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div><div className="font-medium">{b.name}</div><div className="text-xs text-muted-foreground">{b.address || "—"}</div></div>
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => setF({ id: b.id, name: b.name, address: b.address ?? "" })}>Edit</Button>
              <label className="flex items-center gap-2 text-xs">Active <Switch checked={b.is_active} onCheckedChange={(v) => m.mutate(payload({ ...b, is_active: v }))} /></label>
            </div>
          </div>
        ))}
        {(data ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">No branches yet. Add your first one above.</p>}
      </Card>
    </div>
  );
}

function General() {
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const [f, setF] = useState<any>(null);
  useEffect(() => { if (data) setF(data); }, [data]);
  const m = useAction((v: any) => saveSettings({ data: v }), "Settings saved");
  const up = useAction(() => upgradeSchema(), "Database is up to date");
  if (!f) return null;
  const I = (k: string, label: string, type = "text") => <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;
  return (
    <Card className="space-y-4 p-5">
        {I("pg_name", "PG name")}{I("phone", "Phone")}{I("address", "Address")}<div className="space-y-1.5"><Label>Monthly rent due day</Label>
          <select aria-label="Monthly rent due day" className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={String(f.default_due_day ?? 7)} onChange={(e) => setF({ ...f, default_due_day: Number(e.target.value) })}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d} of every month</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Example with day 7: November rent is due 7 November. Extra charges added on or before the 7th go on that month's bill; after the 7th they go on next month's bill. Unpaid amounts show overdue after the due date. Changing this only affects bills created from now on.</p></div>
        <div className="space-y-1.5"><Label>Timezone</Label>
          <select aria-label="Timezone" className="h-9 w-full rounded-md border bg-card px-2 text-sm" value={f.timezone ?? "Asia/Kolkata"} onChange={(e) => setF({ ...f, timezone: e.target.value })}>
            {["Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "UTC"].map((z) => <option key={z} value={z}>{z}</option>)}
          </select></div>
        <div className="border-t pt-4"><Button variant="outline" size="sm" disabled={up.isPending} onClick={() => up.mutate(undefined as any)}>Update database structure</Button>
          <p className="mt-1 text-xs text-muted-foreground">Run once after installing an app update. Safe to repeat.</p></div>
            <Button disabled={m.isPending} onClick={() => m.mutate(f)}>Save</Button>
    </Card>
  );
}

function Staff() {
  const { data } = useQuery({ queryKey: ["staff"], queryFn: () => listStaff() });
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => listBranches() });
  const blank = { full_name: "", email: "", password: "", branchIds: [] as string[], can_message: false };
  const [f, setF] = useState(blank);
  const m = useAction((v: any) => saveStaff({ data: v }), "Saved", () => setF(blank));
  return (
    <div className="space-y-4">
      <Card className="grid gap-3 p-4 sm:grid-cols-4">
        <Input placeholder="Name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        <Input placeholder="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Input placeholder="Password (min 8)" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <Button disabled={m.isPending} onClick={() => m.mutate(f)}>Add staff</Button>
        <div className="flex flex-wrap gap-3 sm:col-span-4">
          {(branches ?? []).map((b: any) => <label key={b.id} className="flex items-center gap-2 text-xs"><Checkbox checked={f.branchIds.includes(b.id)} onCheckedChange={(v) => setF({ ...f, branchIds: v ? [...f.branchIds, b.id] : f.branchIds.filter((id) => id !== b.id) })} />{b.name}</label>)}
          <label className="flex items-center gap-2 text-xs"><Switch checked={f.can_message} onCheckedChange={(v) => setF({ ...f, can_message: v })} />Can send WhatsApp</label>
        </div>
      </Card>
      <Card className="divide-y">
        {(data ?? []).map((s: any) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <div><div className="font-medium">{s.full_name} <span className="text-xs capitalize text-muted-foreground">{s.role}</span></div><div className="text-xs text-muted-foreground">{s.email}</div></div>
            {s.role === "staff" && <div className="flex flex-wrap items-center gap-4">
              <div className="flex w-full flex-wrap gap-3">
                {(branches ?? []).map((b: any) => <label key={b.id} className="flex items-center gap-2 text-xs"><Checkbox disabled={m.isPending} checked={(s.branch_ids ?? []).includes(b.id)} onCheckedChange={(v) => m.mutate({ id: s.id, branchIds: v ? [...(s.branch_ids ?? []), b.id] : (s.branch_ids ?? []).filter((id: string) => id !== b.id) })} />{b.name}</label>)}
                {!s.branch_ids?.length && <span className="text-xs text-muted-foreground">No branches assigned</span>}
              </div>
              <label className="flex items-center gap-2 text-xs">Can send WhatsApp <Switch checked={s.can_message === true} onCheckedChange={(v) => m.mutate({ id: s.id, can_message: v })} /></label>
              <label className="flex items-center gap-2 text-xs">Can reverse payments <Switch checked={s.can_reverse} onCheckedChange={(v) => m.mutate({ id: s.id, can_reverse: v })} /></label>
              <label className="flex items-center gap-2 text-xs">Active <Switch checked={s.is_active} onCheckedChange={(v) => m.mutate({ id: s.id, is_active: v })} /></label>
              <Button size="sm" variant="outline" onClick={() => { const p = prompt("New password (min 8)"); if (p) m.mutate({ id: s.id, password: p }); }}>Reset password</Button>
            </div>}
          </div>
        ))}
      </Card>
    </div>
  );
}

function Recovery() {
  const { data, refetch } = useQuery({ queryKey: ["recovery"], queryFn: () => getRecoveryStatus() });
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  return (
    <Card className="space-y-4 p-5">
      <div>
        <div className="font-medium">Password recovery code</div>
        <p className="mt-1 text-sm text-muted-foreground">
          If you forget your password, use this code on the sign-in screen under "Forgot password?".
          {data?.hasCode
            ? ` A code was created on ${new Date(data.createdAt!).toLocaleDateString()}. Making a new one stops the old one working.`
            : " You don't have a recovery code yet — create one now."}
        </p>
      </div>
      {code ? (
        <RecoveryCodeNotice code={code} doneLabel="Done" onDone={() => { setCode(null); refetch(); }} />
      ) : (
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          try { const r = await createRecoveryCode({ data: { password: pw } }); setPw(""); setCode(r.recoveryCode); }
          catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
        }}>
          <div className="space-y-1.5">
            <Label htmlFor="rc-pw">Your current password</Label>
            <Input id="rc-pw" type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <Button disabled={busy}>{data?.hasCode ? "Create a new recovery code" : "Create recovery code"}</Button>
        </form>
      )}
    </Card>
  );
}
