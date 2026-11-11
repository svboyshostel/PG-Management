import { describe, expect, it } from "vitest";
import { applyFifo } from "./money";
import { billBreakdown } from "./rules";
import { findDuplicates, breakdownText, matchesCategory } from "./wa";

describe("Isolated representative resident computations (not Neon latency)", () => {
  for (const count of [50, 100, 300, 500]) it(`calculates ${count} residents with 24 months of history`, () => {
    const started = performance.now();
    const results = Array.from({ length: count }, (_, index) => {
      const bills = Array.from({ length: 24 }, (_, month) => ({ id: `${index}-${month}`, billing_month: `${2025 + Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, "0")}-01`, due_date: `${2025 + Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, "0")}-01`, payable: 500000, lines: [{ kind: "rent", description: "Rent", amount: 500000 }] }));
      const { paid } = applyFifo(bills, 11500000);
      const withPaid = bills.map((b) => ({ ...b, paid: paid[b.id] ?? 0 }));
      const breakdown = billBreakdown(withPaid, "2026-12-01");
      return { id: String(index), outstanding: breakdown.totalOutstanding, text: breakdownText(breakdown, "1 Dec 2026"), eligible: matchesCategory({ status: "active", joining_date: "2025-01-01", bills: withPaid, depositBalance: 0 }, "overdue", "2026-12-01", "2026-12-04") };
    });
    const history = results.map((r) => ({ resident_id: r.id, template_id: "rent", billing_month: "2026-12-01", outstanding: r.outstanding }));
    expect(results.reduce((n, r) => n + r.outstanding, 0)).toBe(count * 500000);
    expect(results.every((r) => r.eligible)).toBe(true);
    expect(findDuplicates(results, history, "rent", "2026-12-01")).toHaveLength(count);
    console.info(`SIMULATED ${count} residents / 24 bills: ${(performance.now() - started).toFixed(1)} ms`);
  });
});