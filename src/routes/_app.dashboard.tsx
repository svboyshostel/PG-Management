import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { getDashboard, listBranches } from "@/lib/pg.functions";
import { useState } from "react";
import { inr, dateLabel, monthLabel, monthStart } from "@/lib/money";
import { PageHeader, Stat, Empty } from "@/components/app/bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Dashboard — PG Manager" }, { name: "description", content: "Occupancy, rent collected and overdue residents." },
    { property: "og:title", content: "Dashboard — PG Manager" }, { property: "og:description", content: "Occupancy, rent collected and overdue residents." }] }),
  component: Dashboard,
});

function Dashboard() {
  const [branch, setBranch] = useState("");
  const { data: branches } = useQuery({ queryKey: ["branches"], queryFn: () => listBranches() });
  const active = (branches ?? []).filter((b: any) => b.is_active);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["dashboard", branch], queryFn: () => getDashboard({ data: { branchId: branch || null } }) });
  const picker = active.length > 1 && (
    <select aria-label="Branch" className="h-9 rounded-md border bg-card px-2 text-sm" value={branch} onChange={(e) => setBranch(e.target.value)}>
      <option value="">All branches</option>{active.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>);
  if (isLoading) return <div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (error || !data) return <Empty title="Couldn't load dashboard"><Button onClick={() => refetch()}>Retry</Button></Empty>;
  const vacant = data.beds.total - data.beds.occupied;
  return (
    <div>
      <PageHeader title={data.pgName} sub={`${active.length === 1 ? active[0].name + " · " : ""}${monthLabel(monthStart())} at a glance`}
        actions={<>{picker}<Button asChild variant="outline"><Link to="/rooms">Rooms</Link></Button><Button asChild><Link to="/residents/new">Add resident</Link></Button></>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Occupancy" value={`${data.beds.occupied}/${data.beds.total}`} hint={`${vacant} beds vacant`} />
        <Stat label="Billed this month" value={inr(data.billedThisMonth)} />
        <Stat label="Rent collected" value={inr(data.collectedThisMonth)} tone="good" hint={`Deposits: ${inr(data.depositsThisMonth)}`} />
        <Stat label="Total pending" value={inr(data.outstanding)} tone={data.outstanding ? "bad" : undefined} hint={`${data.overdueCount} overdue`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="mb-3 font-display font-semibold">Overdue residents</div>
          {data.overdue.length === 0 ? <p className="text-sm text-muted-foreground">Nobody is overdue. 🎉</p> : (
            <div className="divide-y">
              {data.overdue.map((r: any) => (
                <Link key={r.id} to="/residents/$id" params={{ id: r.id }} className="flex items-center justify-between py-2.5 text-sm hover:bg-muted/50">
                  <div><div className="font-medium">{r.name} <span className="text-xs text-muted-foreground">{r.code}</span></div>
                    <div className="text-xs text-muted-foreground">{r.branch_name} · due since {dateLabel(r.oldestDue)}</div></div>
                  <div className="font-semibold text-destructive">{inr(r.outstanding)}</div>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 font-display font-semibold">Rent collected (6 months)</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trend}><XAxis dataKey="label" fontSize={12} /><Tooltip formatter={(v: number) => "₹" + v.toLocaleString("en-IN")} />
                <Bar dataKey="amount" fill="var(--color-primary)" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
