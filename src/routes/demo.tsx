import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, BedDouble, CreditCard, Eye, FileText, IndianRupee, Lock, MessageSquare, ShieldCheck, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { getDemoStatus } from "@/lib/demo.functions";
import {
  DEMO_BRANCHES,
  DEMO_EB_BILLS,
  DEMO_MONTHLY_CHART,
  DEMO_PAYMENTS,
  DEMO_PG_NAME,
  DEMO_RESIDENTS,
  DEMO_ROOMS,
  DEMO_WHATSAPP_PREVIEW,
  type DemoResident,
} from "@/lib/demo-data";
import { dateLabel, inr } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PwaInstallControl } from "@/components/app/pwa-install";

export const Route = createFileRoute("/demo")({
  loader: () => getDemoStatus(),
  component: DemoPreviewPage,
});

type DemoSection = "dashboard" | "rooms" | "residents" | "payments" | "whatsapp";

const SECTIONS: { id: DemoSection; label: string; icon: typeof Building2 }[] = [
  { id: "dashboard", label: "Dashboard", icon: Building2 },
  { id: "rooms", label: "Rooms & EB", icon: BedDouble },
  { id: "residents", label: "Residents", icon: Users },
  { id: "payments", label: "Payments & Reports", icon: IndianRupee },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
];

function notifyReadOnly() {
  toast.info("Demo Preview is read-only. Complete setup and sign in to modify real data.");
}

function DemoPreviewPage() {
  const { enabled } = Route.useLoaderData();
  const [section, setSection] = useState<DemoSection>("dashboard");
  const [branchId, setBranchId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedResident, setSelectedResident] = useState<DemoResident | null>(DEMO_RESIDENTS[0] ?? null);

  if (!enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md space-y-4 p-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-xl font-bold">Demo Preview is disabled</h1>
            <p className="text-sm text-muted-foreground">
              Preview mode is turned off in production. Sign in with your PG Manager account or finish owner setup.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/setup">Owner setup</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const branches = branchId === "all" ? DEMO_BRANCHES : DEMO_BRANCHES.filter((b) => b.id === branchId);
  const rooms = branchId === "all" ? DEMO_ROOMS : DEMO_ROOMS.filter((r) => r.branchId === branchId);
  const ebBills = branchId === "all" ? DEMO_EB_BILLS : DEMO_EB_BILLS.filter((b) => b.branchId === branchId);
  const payments = branchId === "all" ? DEMO_PAYMENTS : DEMO_PAYMENTS.filter((p) => p.branchId === branchId);

  const residents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DEMO_RESIDENTS.filter((r) => {
      if (branchId !== "all" && r.branchId !== branchId) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.roomNumber.toLowerCase().includes(q);
    });
  }, [branchId, search]);

  const occupiedBeds = branches.reduce((sum, b) => sum + b.occupiedBeds, 0);
  const totalBeds = branches.reduce((sum, b) => sum + b.totalBeds, 0);
  const totalCollectedPaise = payments.reduce((sum, p) => sum + p.amountPaise, 0);
  const totalOutstandingPaise = residents.reduce((sum, r) => sum + r.outstandingPaise, 0);
  const totalDepositsPaise = residents.reduce((sum, r) => sum + r.depositHeldPaise, 0);
  const totalEbPaise = ebBills.reduce((sum, b) => sum + b.totalPaise, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Persistent Read-Only Banner */}
      <div className="sticky top-0 z-30 border-b bg-amber-50/95 px-4 py-2.5 text-amber-950 backdrop-blur dark:bg-amber-950/90 dark:text-amber-100">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-700 text-white hover:bg-amber-700">Demo Preview</Badge>
            <span className="font-medium">
              Synthetic sample data only — database writes, file uploads, payments & WhatsApp actions are disabled.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PwaInstallControl variant="outline" />
            <Button asChild size="sm" variant="outline" className="bg-background">
              <Link to="/setup">Go to Setup</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:flex-row md:p-6">
        {/* Sidebar / Navigation */}
        <aside className="w-full shrink-0 space-y-4 md:w-60">
          <Card className="p-4">
            <div className="flex items-center gap-2.5">
              <img src="/icon.svg" alt="PG Manager" className="h-8 w-8 rounded-lg" />
              <div>
                <div className="font-display text-sm font-bold leading-tight">PG Manager</div>
                <div className="text-xs text-muted-foreground">{DEMO_PG_NAME}</div>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="demo-branch-select">
                Sample branch filter
              </label>
              <select
                id="demo-branch-select"
                className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-sm"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="all">All Sample Branches</option>
                {DEMO_BRANCHES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <nav className="mt-4 flex flex-wrap gap-1 md:flex-col">
              {SECTIONS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "ghost"}
                    className="justify-start gap-2"
                    onClick={() => setSection(item.id)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </Card>

          <Card className="space-y-2 p-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Preview Isolation
            </div>
            <p>
              This screen runs purely on local synthetic sample data. Real Neon databases, Supabase buckets, and
              protected server endpoints remain isolated and inaccessible until setup and authentication are completed.
            </p>
          </Card>
        </aside>

        {/* Main Preview Workspace */}
        <main className="min-w-0 flex-1 space-y-5">
          {section === "dashboard" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="font-display text-2xl font-bold">Dashboard · Demo Preview</h1>
                  <p className="text-sm text-muted-foreground">Sample property snapshot across branches, dues & EB</p>
                </div>
                <Badge variant="secondary">November 2026 (Sample)</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Occupied beds</div>
                  <div className="mt-1 font-display text-2xl font-bold">
                    {occupiedBeds} / {totalBeds}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{branches.length} sample branch(es)</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Sample collections</div>
                  <div className="mt-1 font-display text-2xl font-bold">{inr(totalCollectedPaise)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{payments.length} recorded sample txns</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Pending dues</div>
                  <div className="mt-1 font-display text-2xl font-bold text-destructive">{inr(totalOutstandingPaise)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Rent & EB balances</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Deposits held & EB billed</div>
                  <div className="mt-1 font-display text-2xl font-bold">{inr(totalDepositsPaise)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Room EB sample: {inr(totalEbPaise)}</div>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                <Card className="p-4 lg:col-span-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-display font-semibold">6-Month Billed vs Collected (Sample ₹)</h2>
                    <Badge variant="outline">Synthetic data</Badge>
                  </div>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={DEMO_MONTHLY_CHART}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="billed" name="Billed (₹)" fill="#0F766E" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="collected" name="Collected (₹)" fill="#5EEAD4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="space-y-3 p-4 lg:col-span-2">
                  <h2 className="font-display font-semibold">Branches (Sample)</h2>
                  {branches.map((b) => (
                    <div key={b.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between font-medium">
                        <span>{b.name}</span>
                        <Badge variant="secondary">
                          {b.occupiedBeds}/{b.totalBeds} beds
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {b.city} · {b.rooms} sample rooms
                      </div>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" className="w-full" onClick={notifyReadOnly}>
                    Add branch (disabled in preview)
                  </Button>
                </Card>
              </div>

              <Card className="p-4">
                <h2 className="mb-3 font-display font-semibold">Sample Accounts with Pending Balances</h2>
                <div className="divide-y text-sm">
                  {residents
                    .filter((r) => r.outstandingPaise > 0)
                    .map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div>
                          <div className="font-medium">
                            {r.name} · Room {r.roomNumber} ({r.bedLabel})
                          </div>
                          <div className="text-xs text-muted-foreground">{r.lastPaymentNote}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-destructive">{inr(r.outstandingPaise)}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedResident(r);
                              setSection("residents");
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" /> Inspect
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </>
          )}

          {section === "rooms" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="font-display text-2xl font-bold">Rooms & Room-Wise EB · Demo Preview</h1>
                  <p className="text-sm text-muted-foreground">
                    Sample room capacity and daily-occupancy EB cost sharing (pure calculation preview)
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={notifyReadOnly}>
                  New EB draft (read-only)
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {rooms.map((rm) => (
                  <Card key={rm.id} className="space-y-2 p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-semibold">Room {rm.number}</span>
                      <Badge variant={rm.occupied === rm.sharing ? "default" : "secondary"}>
                        {rm.occupied}/{rm.sharing} occupied
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {rm.branchName} · {rm.floor} floor · Rent {inr(rm.monthlyRentPaise)}/bed
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {rm.occupants.map((occ) => (
                        <Badge key={occ} variant="outline">
                          {occ}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="space-y-3">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Zap className="h-4 w-4 text-primary" /> Sample Room-Wise EB Bills ({ebBills.length})
                </h2>
                {ebBills.map((eb) => (
                  <Card key={eb.id} className="space-y-3 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-display font-semibold">
                          Room {eb.roomNumber} · {eb.monthLabel}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {eb.branchName} · {eb.meterReading} · {eb.daysInMonth} billing days
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={eb.status === "finalized" ? "default" : "secondary"} className="capitalize">
                          {eb.status}
                        </Badge>
                        <span className="font-display text-base font-bold">{inr(eb.totalPaise)}</span>
                      </div>
                    </div>

                    <div className="divide-y rounded-md border">
                      {eb.shares.map((share) => (
                        <div key={share.residentId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{share.name}</span>
                            <span className="text-xs text-muted-foreground">{share.days} days</span>
                            {share.checkedOut && <Badge variant="secondary">Checked out</Badge>}
                          </div>
                          <span className="font-medium">{inr(share.final)}</span>
                        </div>
                      ))}
                      {eb.ownerPaise > 0 && (
                        <div className="flex items-center justify-between bg-muted/40 px-3 py-2 text-xs">
                          <span className="font-medium">Owner-borne vacant days share</span>
                          <span className="font-semibold">{inr(eb.ownerPaise)}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {section === "residents" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="font-display text-2xl font-bold">Residents · Demo Preview</h1>
                  <p className="text-sm text-muted-foreground">Synthetic resident roster, ID proof status & ledgers</p>
                </div>
                <Input
                  aria-label="Filter sample residents"
                  placeholder="Search sample resident or room..."
                  className="max-w-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-5">
                <Card className="divide-y p-2 lg:col-span-2">
                  {residents.map((r) => {
                    const isSelected = selectedResident?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedResident(r)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition hover:bg-muted ${
                          isSelected ? "bg-muted" : ""
                        }`}
                      >
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Room {r.roomNumber} · {r.branchName}
                          </div>
                        </div>
                        <Badge variant={r.outstandingPaise > 0 ? "destructive" : "secondary"}>
                          {r.outstandingPaise > 0 ? inr(r.outstandingPaise) : "Settled"}
                        </Badge>
                      </button>
                    );
                  })}
                  {!residents.length && (
                    <div className="p-4 text-center text-sm text-muted-foreground">No sample resident matches filter.</div>
                  )}
                </Card>

                <Card className="space-y-4 p-4 text-sm lg:col-span-3">
                  {selectedResident ? (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
                        <div>
                          <h2 className="font-display text-lg font-bold">{selectedResident.name}</h2>
                          <div className="text-xs text-muted-foreground">
                            {selectedResident.branchName} · Room {selectedResident.roomNumber} ({selectedResident.bedLabel}) ·{" "}
                            {selectedResident.phoneMasked}
                          </div>
                        </div>
                        <Badge variant={selectedResident.status === "active" ? "default" : "secondary"} className="capitalize">
                          {selectedResident.status.replace("_", " ")}
                        </Badge>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-md border p-3">
                          <div className="text-xs text-muted-foreground">Monthly rent</div>
                          <div className="mt-0.5 font-semibold">{inr(selectedResident.monthlyRentPaise)}</div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="text-xs text-muted-foreground">Deposit held / target</div>
                          <div className="mt-0.5 font-semibold">
                            {inr(selectedResident.depositHeldPaise)} / {inr(selectedResident.depositTargetPaise)}
                          </div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="text-xs text-muted-foreground">Current due</div>
                          <div className="mt-0.5 font-semibold text-destructive">
                            {inr(selectedResident.outstandingPaise)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 rounded-md border p-3">
                        <div className="flex items-center justify-between font-medium">
                          <span>ID proof (Read-only preview)</span>
                          <Badge variant={selectedResident.idVerification === "verified" ? "default" : "secondary"} className="capitalize">
                            {selectedResident.idVerification}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
                          {selectedResident.idTypeLabel}: {selectedResident.idSummary}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Joined {dateLabel(selectedResident.joiningDate)}
                          {selectedResident.checkoutDate ? ` · Checked out ${dateLabel(selectedResident.checkoutDate)}` : ""}
                        </div>
                      </div>

                      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                        Recent sample activity: {selectedResident.lastPaymentNote}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={notifyReadOnly}>
                          Record payment (disabled)
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={notifyReadOnly}>
                          Upload ID document (disabled)
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground">Select a sample resident to inspect details.</div>
                  )}
                </Card>
              </div>
            </>
          )}

          {section === "payments" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="font-display text-2xl font-bold">Payments & Reports · Demo Preview</h1>
                  <p className="text-sm text-muted-foreground">Synthetic rent/deposit receipts and monthly reports</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={notifyReadOnly}>
                  <FileText className="h-4 w-4" /> Export CSV (disabled in preview)
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Total sample receipts</div>
                  <div className="mt-1 font-display text-xl font-bold">{inr(totalCollectedPaise)}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Sample rent receipts</div>
                  <div className="mt-1 font-display text-xl font-bold">
                    {inr(payments.filter((p) => p.account === "rent").reduce((s, p) => s + p.amountPaise, 0))}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground">Sample deposit receipts</div>
                  <div className="mt-1 font-display text-xl font-bold">
                    {inr(payments.filter((p) => p.account === "deposit").reduce((s, p) => s + p.amountPaise, 0))}
                  </div>
                </Card>
              </div>

              <Card className="overflow-x-auto p-4">
                <h2 className="mb-3 flex items-center gap-2 font-display font-semibold">
                  <CreditCard className="h-4 w-4 text-primary" /> Sample Payment Ledger
                </h2>
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Resident</th>
                      <th className="py-2 pr-3">Branch / Room</th>
                      <th className="py-2 pr-3">Account</th>
                      <th className="py-2 pr-3">Method</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-3">{dateLabel(p.date)}</td>
                        <td className="py-2 pr-3 font-medium">{p.residentName}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {p.branchName} · {p.roomNumber}
                        </td>
                        <td className="py-2 pr-3 capitalize">{p.account}</td>
                        <td className="py-2 pr-3">{p.method}</td>
                        <td className="py-2 text-right font-medium">{inr(p.amountPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {section === "whatsapp" && (
            <Card className="space-y-4 p-5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="font-display text-xl font-bold">Manual WhatsApp Sharing · Demo Preview</h1>
                  <p className="text-xs text-muted-foreground">
                    Preview of template-rendered manual reminders (no messages or sessions created in demo mode)
                  </p>
                </div>
                <Badge variant="outline">Manual WhatsApp Only</Badge>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                <div className="text-xs font-medium text-muted-foreground">{DEMO_WHATSAPP_PREVIEW.templateTitle}</div>
                <p className="whitespace-pre-wrap text-sm">{DEMO_WHATSAPP_PREVIEW.renderedMessage}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={notifyReadOnly}>
                Open WhatsApp (disabled in demo preview)
              </Button>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

