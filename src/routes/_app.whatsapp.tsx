import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listBranches, listRooms, listWaTemplates, saveWaTemplate, setWaTemplateStatus, previewWaRecipients, createWaSession,
  getWaSession, updateWaRecipient, setWaSessionStatus, listWaSessions, getWaSettings, saveWaReminderGap } from "@/lib/pg.functions";
import { inr, monthStart, monthLabel } from "@/lib/money";
import { VARIABLES, TEMPLATE_CATEGORIES, CATEGORY_LABEL, RECIPIENT_CATEGORIES, RECIPIENT_LABEL, PAY_LABEL, STATUS_LABEL, historyStatusLabel,
   validateTemplate, waUrl, canSendMessages, type RecipientStatus } from "@/lib/wa";
import { PageHeader, Empty, useAction, newKey } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/whatsapp")({
  validateSearch: (s: Record<string, unknown>): { session?: string; tab?: string } => ({
    ...(typeof s['session'] === "string" ? { session: s['session'] } : {}), ...(typeof s['tab'] === "string" ? { tab: s['tab'] } : {}),
  }),
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "WhatsApp — PG Manager" }, { name: "description", content: "Send personalised WhatsApp messages to residents, manage templates and review history." },
    { property: "og:title", content: "WhatsApp — PG Manager" }, { property: "og:description", content: "Send personalised WhatsApp messages to residents, manage templates and review history." }] }),
  component: WhatsAppPage,
});

const Sel = (p: any) => <select {...p} className="h-9 w-full rounded-md border bg-card px-2 text-sm" />;
const Field = ({ label, children }: { label: string; children: ReactNode }) => <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;

function WhatsAppPage() {
  const { session, tab } = Route.useSearch();
  const nav = useNavigate({ from: "/whatsapp" });
  const { user } = Route.useRouteContext();
  if (!canSendMessages(user)) return <Empty title="You don't have permission to send WhatsApp messages" />;
  if (session) return <Queue id={session} onExit={() => nav({ search: { tab: "history" } })} />;
  return (
    <div>
      <PageHeader title="WhatsApp" sub="Prepare personalised messages and send them from WhatsApp, one by one." />
      <Tabs value={tab ?? "send"} onValueChange={(v) => nav({ search: { tab: v } })}>
        <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="send">Send messages</TabsTrigger><TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger><TabsTrigger value="settings">WhatsApp settings</TabsTrigger></TabsList>
        <TabsContent value="send"><Send onStart={(id) => nav({ search: { session: id } })} /></TabsContent>
        <TabsContent value="templates"><Templates owner={user.role === "owner"} /></TabsContent>
        <TabsContent value="history"><History onOpen={(id) => nav({ search: { session: id } })} /></TabsContent>
        <TabsContent value="settings"><WaSettings /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Send ---------------- */
function Send({ onStart }: { onStart: (id: string) => void }) {
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => listBranches() });
  const { data: templates } = useQuery({ queryKey: ["wa-templates"], queryFn: () => listWaTemplates({ data: {} }) });
  const [f, setF] = useState({ month: monthStart().slice(0, 7), branchId: "", roomId: "", category: "all", templateId: "", method: "MANUAL_WHATSAPP" });
  const { data: rooms } = useQuery({ queryKey: ["rooms", f.branchId], queryFn: () => listRooms({ data: { branchId: f.branchId || undefined } }) });
  const active = (templates ?? []).filter((t: any) => t.status === "active");
  const [rows, setRows] = useState<any[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [full, setFull] = useState<any>(null);
  const [confirm, setConfirm] = useState(false);
  const [idem, setIdem] = useState(newKey);
  const filter = { month: f.month + "-01", branchId: f.branchId || null, roomId: f.roomId || null, category: f.category, templateId: f.templateId, method: f.method };
  const gen = useAction(() => previewWaRecipients({ data: filter }).then((r: any) => {
    setRows(r.rows); setSel(new Set(r.rows.filter((x: any) => x.eligible).map((x: any) => x.id))); setIdem(newKey());
  }));
  const start = useAction((resend: boolean) => createWaSession({ data: { ...filter, residentIds: [...sel], idem, confirmResend: resend } })
    .then((r: any) => onStart(r.id)), "Send queue created");
  const set = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setRows(null); };
  const chosen = (rows ?? []).filter((r) => sel.has(r.id));
  const dups = chosen.filter((r) => r.duplicate);
  const tplName = active.find((t: any) => t.id === f.templateId)?.title ?? "";

  return (
    <div className="space-y-4">
      <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="1. Billing month"><Input type="month" value={f.month} onChange={(e) => set({ month: e.target.value })} /></Field>
        <Field label="2. Branch"><Sel aria-label="Branch" value={f.branchId} onChange={(e: any) => set({ branchId: e.target.value, roomId: "" })}>
          <option value="">All branches</option>{(branches ?? []).filter((b: any) => b.is_active).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel></Field>
        <Field label="Room (optional)"><Sel aria-label="Room" value={f.roomId} onChange={(e: any) => set({ roomId: e.target.value })}>
          <option value="">All rooms</option>{(rooms ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.room_number}{f.branchId ? "" : ` · ${r.branch_name}`}</option>)}</Sel></Field>
        <Field label="Recipients"><Sel aria-label="Recipients" value={f.category} onChange={(e: any) => set({ category: e.target.value })}>
          {RECIPIENT_CATEGORIES.map((c) => <option key={c} value={c}>{RECIPIENT_LABEL[c]}</option>)}</Sel></Field>
        <Field label="3. Template"><Sel aria-label="Template" value={f.templateId} onChange={(e: any) => set({ templateId: e.target.value })}>
          <option value="">Choose</option>{active.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}</Sel></Field>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
          <Button disabled={!f.templateId || gen.isPending} onClick={() => gen.mutate(undefined as any)}>{gen.isPending ? "Finding…" : "4. Show matching residents"}</Button>
        </div>
      </Card>

      {rows && (rows.length === 0 ? <Empty title="No active residents match these filters" /> : <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm"><b>{chosen.length}</b> of {rows.length} selected · {rows.filter((r) => !r.eligible).length} can't be sent</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSel(new Set(rows.filter((r) => r.eligible).map((r) => r.id)))}>Select all</Button>
            <Button size="sm" variant="outline" onClick={() => setSel(new Set())}>Deselect all</Button>
          </div>
        </div>
        {dups.length > 0 && <Card className="border-warning p-3 text-sm">This message was already marked as sent to <b>{dups.length}</b> selected resident(s) for {monthLabel(f.month + "-01")}:
          {" "}{dups.map((d) => `${d.name}${d.duplicate.balanceChanged ? " (balance changed)" : ""}`).join(", ")}.</Card>}
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground"><tr>
              <th className="p-2"></th><th className="p-2">Resident</th><th className="p-2">Branch · Room</th><th className="p-2">WhatsApp</th>
              <th className="p-2">Rent status</th><th className="p-2 text-right">Outstanding</th><th className="p-2">Message</th><th className="p-2">Eligibility</th></tr></thead>
            <tbody className="divide-y">{rows.map((r) => (
              <tr key={r.id} className={r.eligible ? "" : "text-muted-foreground"}>
                <td className="p-2"><Checkbox aria-label={`Select ${r.name}`} disabled={!r.eligible} checked={sel.has(r.id)} onCheckedChange={(v) => {
                  const n = new Set(sel); v ? n.add(r.id) : n.delete(r.id); setSel(n); }} /></td>
                <td className="p-2"><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.code}</div></td>
                <td className="p-2">{r.branch_name} · {r.room}</td>
                <td className="p-2">{r.mobile}</td>
                <td className="p-2">{PAY_LABEL[r.payStatus as keyof typeof PAY_LABEL]}{r.overdue && <Badge variant="destructive" className="ml-1">Overdue</Badge>}</td>
                <td className="p-2 text-right">{inr(r.outstanding)}</td>
                <td className="p-2"><button className="max-w-56 truncate text-left text-xs underline-offset-2 hover:underline" onClick={() => setFull(r)}>{tplName}: {r.message.slice(0, 60)}…</button></td>
                <td className="p-2 text-xs">{r.eligible ? (r.duplicate ? <Badge variant="secondary">Sent before</Badge> : "Ready") : r.reason}</td>
              </tr>))}</tbody>
          </table>
        </Card>
        <div className="flex justify-end"><Button disabled={!chosen.length || start.isPending} onClick={() => setConfirm(true)}>5. Review & start sending ({chosen.length})</Button></div>
      </>)}

      {full && <Dialog open onOpenChange={() => setFull(null)}><DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Message for {full.name}</DialogTitle><DialogDescription>{`Message for ${full.mobile}`}</DialogDescription></DialogHeader>
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-sm">{full.message}</pre></DialogContent></Dialog>}

      {confirm && <ConfirmStart count={chosen.length} dups={dups.length} month={monthLabel(f.month + "-01")} pending={start.isPending}
        onClose={() => setConfirm(false)} onGo={(resend) => start.mutate(resend)} />}


    </div>
  );
}

function ConfirmStart({ count, dups, month, pending, onClose, onGo }: { count: number; dups: number; month: string; pending: boolean; onClose: () => void; onGo: (resend: boolean) => void }) {
  const [ok, setOk] = useState(false);
  return <Dialog open onOpenChange={onClose}><DialogContent>
    <DialogHeader><DialogTitle>Start sharing with {count} resident(s)?</DialogTitle><DialogDescription>Nothing is sent automatically.</DialogDescription></DialogHeader>
    {dups > 0 && <label className="flex items-start gap-2 text-sm"><Checkbox checked={ok} onCheckedChange={(v) => setOk(!!v)} /><span>{dups} messages were already confirmed for {month}. Share again.</span></label>}
    <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || (dups > 0 && !ok)} onClick={() => onGo(dups > 0)}>Start</Button></DialogFooter>
  </DialogContent></Dialog>;
}

/* ---------------- Manual queue ---------------- */
function Queue({ id, onExit }: { id: string; onExit: () => void }) {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["wa-session", id], queryFn: () => getWaSession({ data: { id } }) });
  const upd = useAction((v: { id: string; status: RecipientStatus }) => updateWaRecipient({ data: v }));
  const ses = useAction((action: "pause" | "resume") => setWaSessionStatus({ data: { id, action } }));
  if (isLoading || !data) return <Skeleton className="h-96" />;
  if (data.session.method === "WHATSAPP_CLOUD_API") return <HistoricalSession data={data} onExit={onExit} />;
  const { session: s, recipients, progress: p } = data;
  const cur = recipients.find((r: any) => r.status === "opened") ?? recipients.find((r: any) => r.status === "pending");
  const paused = s.status === "paused", done = s.status === "completed";
  return (
    <div className="max-w-3xl">
      <PageHeader title={s.template_title} sub={`${s.billing_month ? monthLabel(s.billing_month) : ""}${s.branch_name ? ` · ${s.branch_name}` : ""} · Manual WhatsApp`}
        actions={<><Button variant="outline" onClick={onExit}>Back</Button>
          {!done && <Button variant="outline" disabled={ses.isPending} onClick={() => ses.mutate(paused ? "resume" : "pause")}>{paused ? "Resume" : "Pause"}</Button>}</>} />
      <Card className="p-4">
        <div className="flex justify-between text-sm"><span><b>{p.processed}</b> of {p.total} processed</span>
          <span className="text-muted-foreground">{p.sent} sent · {p.skipped} skipped · {p.failed} failed · {p.pending + p.opened} left</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${p.total ? (p.processed / p.total) * 100 : 0}%` }} /></div>
        <p className="mt-2 text-xs text-muted-foreground">"Sent" means you confirmed sending in WhatsApp. It is not a delivery receipt from WhatsApp. Progress is saved — you can close this page and continue later from History.</p>
      </Card>

      {done ? <Empty title="All done">Every recipient has been processed.<Button onClick={onExit}>View history</Button></Empty>
        : paused ? <Empty title="Paused"><Button onClick={() => ses.mutate("resume")}>Resume</Button></Empty>
        : cur && <Card className="mt-4 p-4">
          <div className="text-xs text-muted-foreground">Recipient {cur.position} of {p.total}</div>
          <div className="font-display text-lg font-semibold">{cur.name} <span className="text-sm font-normal text-muted-foreground">{cur.code} · +{cur.wa_number}</span></div>
          <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-sm">{cur.message_text}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild><a href={waUrl(cur.wa_number, cur.message_text)} target="_blank" rel="noreferrer"
              onClick={() => upd.mutate({ id: cur.id, status: "opened" })}>{cur.status === "opened" ? "Open again" : "Open WhatsApp"}</a></Button>
            <Button variant="outline" disabled={cur.status !== "opened" || upd.isPending} onClick={() => upd.mutate({ id: cur.id, status: "sent" })}>Mark as sent</Button>
            <Button variant="outline" disabled={upd.isPending} onClick={() => upd.mutate({ id: cur.id, status: "skipped" })}>Skip</Button>
            <Button variant="ghost" disabled={upd.isPending} onClick={() => upd.mutate({ id: cur.id, status: "failed" })}>Didn't open</Button>
          </div>
        </Card>}

      <Card className="mt-4 divide-y">
        {recipients.map((r: any) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div><span className="text-muted-foreground">{r.position}.</span> {r.name} <span className="text-xs text-muted-foreground">+{r.wa_number} · {inr(r.outstanding)}</span></div>
            <div className="flex items-center gap-2"><Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>{STATUS_LABEL[r.status as RecipientStatus]}</Badge>
              {!done && !paused && (r.status === "skipped" || r.status === "failed") && <Button size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => upd.mutate({ id: r.id, status: r.status === "skipped" ? "pending" : "opened" })}>Retry</Button>}</div>
          </div>))}
      </Card>
      <Button variant="ghost" size="sm" className="mt-2" onClick={() => refetch()}>Refresh</Button>
    </div>
  );
}

function HistoricalSession({ data, onExit }: { data: any; onExit: () => void }) {
  return <div><PageHeader title={data.session.template_title} sub="Historical automated messages · read-only" actions={<Button variant="outline" onClick={onExit}>Back</Button>} />
    <div className="divide-y">{data.recipients.map((r: any) => <details key={r.id} className="py-3"><summary>{r.name} · {historyStatusLabel({ method: "WHATSAPP_CLOUD_API", status: r.status })}</summary><p className="whitespace-pre-wrap text-sm">{r.message_text}</p></details>)}</div></div>;
}

/* ---------------- Templates ---------------- */
function Templates({ owner }: { owner: boolean }) {
  const { data } = useQuery({ queryKey: ["wa-templates", "all"], queryFn: () => listWaTemplates({ data: { includeArchived: true } }) });
  const [edit, setEdit] = useState<any>(null);
  const st = useAction((v: any) => setWaTemplateStatus({ data: v }), "Updated");
  return (
    <div className="space-y-3">
      {owner && <Button onClick={() => setEdit({ title: "", body: "", category: "rent", status: "active" })}>New template</Button>}
      {!owner && <p className="text-sm text-muted-foreground">Only the owner can change templates.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {(data ?? []).map((t: any) => (
          <Card key={t.id} className={`p-4 ${t.status === "archived" ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-display font-semibold">{t.title}</div>
                <div className="text-xs text-muted-foreground">{CATEGORY_LABEL[t.category] ?? t.category} · created {new Date(t.created_at).toLocaleDateString("en-IN")} · updated {new Date(t.updated_at).toLocaleDateString("en-IN")}</div></div>
              <Badge variant={t.status === "active" ? "default" : "secondary"} className="capitalize">{t.status}</Badge>
            </div>
            <pre className="mt-2 max-h-32 overflow-hidden whitespace-pre-wrap font-sans text-xs text-muted-foreground">{t.body}</pre>
            {owner && <div className="mt-3 flex flex-wrap gap-2">
              {t.status !== "archived" && <Button size="sm" variant="outline" onClick={() => setEdit(t)}>Edit</Button>}
              {t.status === "active" && <Button size="sm" variant="outline" onClick={() => st.mutate({ id: t.id, status: "inactive" })}>Deactivate</Button>}
              {t.status !== "active" && <Button size="sm" variant="outline" onClick={() => st.mutate({ id: t.id, status: "active" })}>{t.status === "archived" ? "Restore" : "Activate"}</Button>}
              {t.status !== "archived" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => st.mutate({ id: t.id, status: "archived" })}>Archive</Button>}
            </div>}
          </Card>))}
      </div>
      {edit && <TemplateDialog t={edit} onClose={() => setEdit(null)} />}

    </div>
  );
}

function TemplateDialog({ t, onClose }: { t: any; onClose: () => void }) {
  const [f, setF] = useState({ title: t.title, body: t.body, category: t.category, status: t.status === "inactive" ? "inactive" : "active" });
  const m = useAction((v: any) => saveWaTemplate({ data: v }), "Template saved", onClose);
  const err = useMemo(() => { try { validateTemplate(f); return ""; } catch (e: any) { return e.message; } }, [f]);
  return <Dialog open onOpenChange={onClose}><DialogContent className="max-h-[90vh] overflow-y-auto">
    <DialogHeader><DialogTitle>{t.id ? "Edit template" : "New template"}</DialogTitle>
      <DialogDescription>Earlier messages keep the text they were sent with.</DialogDescription></DialogHeader>
    <div className="space-y-3">
      <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Rent Reminder" /></Field>
      <Field label="Category"><Sel aria-label="Category" value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })}>
        {TEMPLATE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</Sel></Field>
      <Field label="Message"><Textarea rows={9} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
      <div className="flex flex-wrap gap-1">{VARIABLES.map((v) => <button key={v} type="button" className="rounded border px-1.5 py-0.5 text-xs hover:bg-muted"
        onClick={() => setF({ ...f, body: f.body + `{${v}}` })}>{`{${v}}`}</button>)}</div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.status === "active"} onCheckedChange={(v) => setF({ ...f, status: v ? "active" : "inactive" })} /> Active (shows in Send messages)</label>
      {err && <p className="text-sm text-destructive">{err}</p>}
    </div>
    <DialogFooter><Button disabled={!!err || m.isPending} onClick={() => m.mutate({ id: t.id, ...f })}>Save</Button></DialogFooter>
  </DialogContent></Dialog>;
}

/* ---------------- History ---------------- */
function History({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => listBranches() });
  const { data: templates } = useQuery({ queryKey: ["wa-templates", "all"], queryFn: () => listWaTemplates({ data: { includeArchived: true } }) });
  const [f, setF] = useState({ from: "", to: "", branchId: "", templateId: "", status: "", method: "" });
  const { data, isLoading } = useQuery({ queryKey: ["wa-sessions", f], queryFn: () => listWaSessions({ data: f }) });
  return (
    <div className="space-y-3">
      <Card className="grid gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
        <Input type="date" aria-label="From" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <Input type="date" aria-label="To" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <Sel aria-label="Branch filter" value={f.branchId} onChange={(e: any) => setF({ ...f, branchId: e.target.value })}><option value="">All branches</option>{(branches ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</Sel>
        <Sel aria-label="Template filter" value={f.templateId} onChange={(e: any) => setF({ ...f, templateId: e.target.value })}><option value="">All templates</option>{(templates ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}</Sel>
        <Sel aria-label="Status filter" value={f.status} onChange={(e: any) => setF({ ...f, status: e.target.value })}><option value="">Any status</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Sel>
        <Sel aria-label="Method filter" value={f.method} onChange={(e: any) => setF({ ...f, method: e.target.value })}><option value="">Any method</option><option value="MANUAL_WHATSAPP">Manual WhatsApp</option><option value="WHATSAPP_CLOUD_API">Historical automated</option></Sel>
      </Card>
      {isLoading ? <Skeleton className="h-40" /> : (data ?? []).length === 0 ? <Empty title="No messages sent yet" /> : (
        <Card className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground"><tr><th className="p-2">When</th><th className="p-2">Template</th><th className="p-2">Month · Branch</th><th className="p-2">Recipients</th>
            <th className="p-2 text-right">Total</th><th className="p-2 text-right">Sent</th><th className="p-2 text-right">Pending</th><th className="p-2 text-right">Skipped</th><th className="p-2 text-right">Failed</th><th className="p-2">By · Method</th><th className="p-2"></th></tr></thead>
          <tbody className="divide-y">{(data ?? []).map((s: any) => (
            <tr key={s.id}><td className="p-2">{new Date(s.created_at).toLocaleString("en-IN")}</td><td className="p-2">{s.template_title}</td>
              <td className="p-2">{s.billing_month ? monthLabel(s.billing_month) : "—"} · {s.branch_name ?? "All"}</td><td className="p-2">{RECIPIENT_LABEL[s.recipient_category as keyof typeof RECIPIENT_LABEL] ?? s.recipient_category}</td>
              <td className="p-2 text-right">{s.total}</td><td className="p-2 text-right">{s.sent}</td><td className="p-2 text-right">{s.pending}</td><td className="p-2 text-right">{s.skipped}</td><td className="p-2 text-right">{s.failed}</td>
              <td className="p-2 text-xs">{s.by_name} · {s.method === "MANUAL_WHATSAPP" ? "Manual" : "Historical automated"}</td>
              <td className="p-2"><Button size="sm" variant="outline" onClick={() => onOpen(s.id)}>{s.method !== "MANUAL_WHATSAPP" || s.status === "completed" ? "View" : "Continue"}</Button></td></tr>))}</tbody>
        </table></Card>)}
    </div>
  );
}

/* ---------------- Settings ---------------- */
function WaSettings() {
  const { data } = useQuery({ queryKey: ["wa-settings"], queryFn: () => getWaSettings() });
  const { user } = Route.useRouteContext();
  const [days, setDays] = useState("");
  useEffect(() => { if (data) setDays(String(data.reminderGapDays)); }, [data]);
  const gap = useAction((v: { days: number }) => saveWaReminderGap({ data: v }), "Reminder gap saved");
  return <div className="max-w-md space-y-3"><Field label="Minimum days between overdue reminders"><Input type="number" min={1} max={60} disabled={user.role !== "owner"} value={days} onChange={(e) => setDays(e.target.value)} /></Field>
    {user.role === "owner" && <Button disabled={gap.isPending || !days} onClick={() => gap.mutate({ days: Number(days) })}>Save</Button>}</div>;
}
