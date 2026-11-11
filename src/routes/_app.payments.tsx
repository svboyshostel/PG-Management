import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listTxns, generateBills } from "@/lib/pg.functions";
import { inr, monthStart, dateLabel } from "@/lib/money";
import { PageHeader, Stat, useAction } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { csvCell } from "@/lib/export";

export const Route = createFileRoute("/_app/payments")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { title: "Payments — PG Manager" }, { name: "description", content: "All money in and out for the month, with CSV export." },
    { property: "og:title", content: "Payments — PG Manager" }, { property: "og:description", content: "All money in and out for the month." }] }),
  component: Payments,
});

function Payments() {
  const [month, setMonth] = useState(monthStart().slice(0, 7));
  const { data, isLoading } = useQuery({ queryKey: ["txns", month], queryFn: () => listTxns({ data: { month: month + "-01" } }) });
  const gen = useAction(() => generateBills({ data: { month: month + "-01" } }));
  const rows = data ?? [];
  const sum = (f: (t: any) => boolean) => rows.filter(f).reduce((s: number, t: any) => s + (t.direction === "in" ? 1 : -1) * Number(t.amount), 0);
  const csv = () => {
    const head = "Date,Resident,ID,Direction,Account,Purpose,Amount (₹),Method,Reference,By\n";
    const body = rows.map((t: any) => [t.txn_date, t.resident_name, t.code, t.direction, t.account, t.purpose, Number(t.amount) / 100, t.method, t.reference, t.by_name].map(csvCell).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
    a.download = `payments-${month}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div>
      <PageHeader title="Payments" actions={<>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        <Button variant="outline" onClick={csv} disabled={!rows.length}>Export CSV</Button>
        <Button variant="outline" disabled={gen.isPending} onClick={() => gen.mutate(undefined as any, { onSuccess: (r: any) => alert(`${r.created} new bill(s) created.`) })}>Generate bills</Button></>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Rent collected (net)" value={inr(sum((t) => t.account === "rent" && ["rent_payment", "reversal"].includes(t.purpose)))} tone="good" />
        <Stat label="Deposits (net)" value={inr(sum((t) => t.account === "deposit" && ["deposit_receipt", "reversal"].includes(t.purpose)))} />
        <Stat label="Refunds paid" value={inr(-sum((t) => ["deposit_refund", "credit_refund"].includes(t.purpose)))} />
      </div>
      {isLoading ? <Skeleton className="h-64" /> : (
        <Card className="divide-y">
          {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">No transactions this month.</p>}
          {rows.map((t: any) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div><Link to="/residents/$id" params={{ id: t.resident_id }} className="font-medium hover:underline">{t.resident_name}</Link> <span className="text-xs text-muted-foreground">{t.code}</span>
                <div className="text-xs text-muted-foreground">{dateLabel(t.txn_date)} · {t.purpose.replace(/_/g, " ")} · {t.method}{t.reference && ` · ${t.reference}`} · {t.by_name}</div></div>
              <div className={`font-semibold ${t.direction === "in" ? "text-success" : "text-destructive"}`}>{t.direction === "in" ? "+" : "−"}{inr(t.amount)}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
