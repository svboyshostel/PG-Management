import { describe, it, expect } from "vitest";
import { applyFifo } from "./money";
import { billDueDate, chargeMonthFor, planCapacity, depositStatus, normalizeIdProof, validateIdImage, billBreakdown, pgToday, clampDueDay } from "./rules";

describe("due day and charge month (due day 7)", () => {
  it("November rent is due November 7, December rent December 7", () => {
    expect(billDueDate("2026-11-01", 7)).toBe("2026-11-07");
    expect(billDueDate("2026-12-01", 7)).toBe("2026-12-07");
    expect(billDueDate("2027-01-01", 7)).toBe("2027-01-07");
  });
  it("charge on Nov 3 and on the due date (Nov 7) goes on the November bill", () => {
    expect(chargeMonthFor("2026-11-03", 7)).toBe("2026-11-01");
    expect(chargeMonthFor("2026-11-07", 7)).toBe("2026-11-01");
  });
  it("charge on Nov 9 goes on the December bill; Dec 30 goes to January", () => {
    expect(chargeMonthFor("2026-11-09", 7)).toBe("2026-12-01");
    expect(chargeMonthFor("2026-12-30", 7)).toBe("2027-01-01");
  });
  it("someone joining after the due date is due next month, not overdue on day one", () => {
    expect(billDueDate("2026-11-01", 7, "2026-11-20")).toBe("2026-12-07");
    expect(billDueDate("2026-11-01", 7, "2026-11-07")).toBe("2026-11-07");
  });
  it("due day must be 1–28", () => {
    expect(clampDueDay(28)).toBe(28);
    expect(() => clampDueDay(29)).toThrow();
    expect(() => clampDueDay(0)).toThrow();
  });
  it("uses the PG timezone (IST is ahead of UTC late at night)", () => {
    expect(pgToday("Asia/Kolkata", new Date("2026-11-30T20:00:00Z"))).toBe("2026-12-01");
  });
});

describe("itemized bill: rent 5000, cleaning 200 (Nov 3), electricity 600 (Nov 6), maintenance 300 (Nov 9)", () => {
  const bills = [
    { billing_month: "2026-11-01", due_date: "2026-11-07", payable: 580000, paid: 0, lines: [
      { kind: "rent", description: "Rent", amount: 500000 }, { kind: "extra_charge", description: "Cleaning", amount: 20000 },
      { kind: "extra_charge", description: "Electricity", amount: 60000 }] },
    { billing_month: "2026-12-01", due_date: "2026-12-07", payable: 530000, paid: 0, lines: [
      { kind: "rent", description: "Rent", amount: 500000 }, { kind: "extra_charge", description: "Maintenance", amount: 30000 }] },
  ];
  it("November bill = 5800 and December bill = 5300", () => {
    expect(billBreakdown(bills, "2026-11-01").thisBill).toBe(580000);
    expect(billBreakdown(bills, "2026-12-01").thisBill).toBe(530000);
    expect(billBreakdown(bills, "2026-11-01").electricity).toBe(60000);
  });
  it("partial payment and previous-month outstanding stay separately visible", () => {
    const { paid } = applyFifo(bills.map((b, i) => ({ id: String(i), payable: b.payable })), 300000);
    const withPaid = bills.map((b, i) => ({ ...b, paid: paid[String(i)] ?? 0 }));
    const dec = billBreakdown(withPaid, "2026-12-01");
    expect(dec.previousOutstanding).toBe(280000);
    expect(dec.paymentsReceived).toBe(0);
    expect(dec.totalOutstanding).toBe(810000);
  });
});

describe("room capacity", () => {
  const beds = [{ id: "a", label: "A", occupied: true }, { id: "b", label: "B", occupied: false }, { id: "c", label: "C", occupied: true }];
  it("adds beds when capacity increases", () => expect(planCapacity(beds, 5).add).toEqual(["D", "E"]));
  it("removes only vacant beds when reducing", () => expect(planCapacity(beds, 2).remove).toEqual(["b"]));
  it("refuses to reduce below the occupied beds", () => expect(() => planCapacity(beds, 1)).toThrow(/vacant/));
  it("allows 1 to 12 sharing only", () => expect(() => planCapacity(beds, 13)).toThrow());
});

describe("deposit status", () => {
  it("pending, partial, fully paid", () => {
    expect(depositStatus(1000000, 0).status).toBe("pending");
    expect(depositStatus(1000000, 400000)).toEqual({ agreed: 1000000, received: 400000, balance: 600000, status: "partial" });
    expect(depositStatus(1000000, 1000000).status).toBe("paid");
  });
});

describe("ID proof", () => {
  it("manual and upload are mutually exclusive", () => {
    expect(() => normalizeIdProof({ method: "manual", type: "pan", number: "ABCDE1234F", hasImage: true })).toThrow();
    expect(() => normalizeIdProof({ method: "upload", type: "pan", number: "ABCDE1234F" })).toThrow();
  });
  it("Aadhaar is stored masked, never in full", () => {
    expect(normalizeIdProof({ method: "manual", type: "aadhaar", number: "1234 5678 9012" }).id_number).toBe("XXXX XXXX 9012");
    expect(() => normalizeIdProof({ method: "manual", type: "aadhaar", number: "1234" })).toThrow();
  });
  it("image must be JPG/PNG/WebP and at most 4 MB", () => {
    expect(validateIdImage({ type: "image/png", size: 4 * 1024 * 1024 })).toBe(true);
    expect(() => validateIdImage({ type: "application/pdf", size: 10 })).toThrow();
    expect(() => validateIdImage({ type: "image/jpeg", size: 4 * 1024 * 1024 + 1 })).toThrow("4 MB");
  });
});
