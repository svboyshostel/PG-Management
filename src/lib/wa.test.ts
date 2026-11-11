import { describe, it, expect } from "vitest";
import { applyFifo } from "./money";
import { billBreakdown } from "./rules";
import { validateTemplate, renderTemplate, breakdownText, payStatus, isOverdue, matchesCategory, waNumber, findDuplicates, nextStatus, sessionAfter, progress,
  methodError, API_NOT_CONNECTED, canManageTemplates, canSendMessages, logTypeForCategory, isGapLimited } from "./wa";

describe("templates", () => {
  it("accepts known variables and rejects unknown placeholders", () => {
    expect(validateTemplate({ title: "Rent Reminder", body: "Hi {name}, pay {balance} by {due_date}", category: "rent" }).title).toBe("Rent Reminder");
    expect(() => validateTemplate({ title: "X", body: "Hi {nmae}", category: "rent" })).toThrow(/\{nmae\}/);
    expect(() => validateTemplate({ title: "X", body: "Hi {name", category: "rent" })).toThrow(/unmatched/);
    expect(() => validateTemplate({ title: "", body: "Hi", category: "rent" })).toThrow();
    expect(() => validateTemplate({ title: "X", body: "Hi", category: "spam" })).toThrow();
  });
  it("replaces variables", () => {
    expect(renderTemplate("Hi {name} of {pg}, room {room}-{bed}", { name: "Ramesh", pg: "ABC PG", room: "101", bed: "A" })).toBe("Hi Ramesh of ABC PG, room 101-A");
  });
});

describe("itemized message (example from brief)", () => {
  // Oct rent 5000; Nov: rent 5000 + elec 600 + water 200 + cleaning 100 = 5900. Payments are applied oldest bill first.
  const bills = [
    { id: "oct", billing_month: "2026-10-01", due_date: "2026-10-07", payable: 500000, lines: [{ kind: "rent", description: "Rent", amount: 500000 }] },
    { id: "nov", billing_month: "2026-11-01", due_date: "2026-11-07", payable: 590000, lines: [
      { kind: "rent", description: "Rent", amount: 500000 }, { kind: "extra_charge", description: "Electricity", amount: 60000 },
      { kind: "extra_charge", description: "Water", amount: 20000 }, { kind: "extra_charge", description: "Cleaning", amount: 10000 }] },
  ];
  const at = (total: number) => { const { paid } = applyFifo(bills, total); return billBreakdown(bills.map((x) => ({ ...x, paid: paid[x.id] ?? 0 })), "2026-11-01"); };
  it("previous unpaid shown separately when October is only partly paid (paid 4500)", () => {
    const b = at(450000);
    expect(b.previousOutstanding).toBe(50000);
    expect(b.paymentsReceived).toBe(0);
    expect(b.totalOutstanding).toBe(640000);
  });
  it("partial payment on the current bill after October is cleared (paid 7000)", () => {
    const b = at(700000);
    expect(b.previousOutstanding).toBe(0);
    expect(b.paymentsReceived).toBe(200000);
    expect(b.totalOutstanding).toBe(390000);
    const txt = breakdownText(at(450000), "7 November 2026");
    expect(txt).toContain("Electricity: ₹600");
    expect(txt).toContain("Total Charges: ₹5,900");
    expect(txt).toContain("Previous Outstanding: ₹500");
    expect(txt).not.toContain("Maintenance");
  });
});

describe("recipient categories", () => {
  const month = "2026-11-01", today = "2026-11-10";
  const mk = (payable: number, paid: number, extra: Partial<any> = {}) => ({ status: "active", joining_date: "2026-09-01", depositBalance: 0,
    bills: [{ billing_month: month, due_date: "2026-11-07", payable, paid }], ...extra });
  it("classifies from ledger figures", () => {
    expect(payStatus(mk(500000, 0).bills, month)).toBe("no_payment");
    expect(payStatus(mk(500000, 100).bills, month)).toBe("partial");
    expect(payStatus(mk(500000, 500000).bills, month)).toBe("paid");
    expect(matchesCategory(mk(500000, 100), "unpaid", month, today)).toBe(true);
    expect(matchesCategory(mk(500000, 0), "unpaid", month, today)).toBe(true);
    expect(matchesCategory(mk(500000, 500000), "unpaid", month, today)).toBe(false);
    expect(matchesCategory(mk(0, 0, { depositBalance: 100 }), "deposit_pending", month, today)).toBe(true);
    expect(matchesCategory(mk(0, 0, { joining_date: "2026-11-04" }), "joined_this_month", month, today)).toBe(true);
  });
  it("not overdue until the saved due date has passed", () => {
    expect(isOverdue(mk(500000, 0).bills, "2026-11-07")).toBe(false);
    expect(isOverdue(mk(500000, 0).bills, "2026-11-08")).toBe(true);
  });
  it("excludes checked-out residents", () => {
    expect(matchesCategory(mk(500000, 0, { status: "checked_out" }), "all", month, today)).toBe(false);
  });
  it("rejects missing or invalid WhatsApp numbers", () => {
    expect(waNumber("98765 43210")).toBe("919876543210");
    expect(waNumber("+91 98765 43210")).toBe("919876543210");
    expect(waNumber("12345")).toBeNull();
    expect(waNumber("")).toBeNull();
    expect(waNumber("1234567890")).toBeNull();
  });
});

describe("duplicates", () => {
  const hist = [{ resident_id: "a", template_id: "t", billing_month: "2026-11-01", outstanding: 500000 }];
  it("warns for same template + month, flags a changed balance as a follow-up", () => {
    expect(findDuplicates([{ id: "a", outstanding: 500000 }], hist, "t", "2026-11-01")).toEqual([{ id: "a", balanceChanged: false }]);
    expect(findDuplicates([{ id: "a", outstanding: 200000 }], hist, "t", "2026-11-01")).toEqual([{ id: "a", balanceChanged: true }]);
    expect(findDuplicates([{ id: "a", outstanding: 500000 }], hist, "t", "2026-12-01")).toEqual([]);
    expect(findDuplicates([{ id: "a", outstanding: 500000 }], hist, "other", "2026-11-01")).toEqual([]);
  });
});

describe("manual queue", () => {
  it("sent requires WhatsApp to have been opened, and is final", () => {
    expect(() => nextStatus("pending", "sent")).toThrow();
    expect(nextStatus("opened", "sent")).toBe("sent");
    expect(() => nextStatus("sent", "skipped")).toThrow();
    expect(nextStatus("skipped", "pending")).toBe("pending");
    expect(nextStatus("failed", "opened")).toBe("opened");
  });
  it("pause and resume", () => {
    expect(sessionAfter("active", "pause", false)).toBe("paused");
    expect(sessionAfter("paused", "resume", false)).toBe("active");
    expect(sessionAfter("paused", "resume", true)).toBe("completed");
    expect(() => sessionAfter("completed", "resume", true)).toThrow();
  });
  it("progress counts each recipient separately (no bulk 'sent')", () => {
    const p = progress(["sent", "pending", "skipped", "opened", "failed"]);
    expect(p).toMatchObject({ total: 5, processed: 3, sent: 1, done: false });
  });
});

describe("API not connected + permissions", () => {
  it("manual works; API is refused with the not-connected message", () => {
    expect(methodError("MANUAL_WHATSAPP")).toBeNull();
    expect(methodError("WHATSAPP_CLOUD_API", false)).toBe(API_NOT_CONNECTED);
  });
  it("only the owner manages templates; staff send unless switched off", () => {
    expect(canManageTemplates({ role: "staff" })).toBe(false);
    expect(canManageTemplates({ role: "owner" })).toBe(true);
    expect(canSendMessages({ role: "staff", can_message: false })).toBe(false);
    expect(canSendMessages({ role: "staff", can_message: true })).toBe(true);
  });
});

import { mergeHistory, visibleHistory, historyStatusLabel, canViewFullMessage, type HistoryEntry } from "./wa";
describe("resident message history", () => {
  const base = { method: "MANUAL_WHATSAPP" as const, status: "sent" };
  const center: HistoryEntry = { ...base, id: "c1", source: "center", at: "2026-11-02T10:00:00Z", template: "Rent Reminder", text: "Hi Ravi, pay ₹5,000" };
  const sameLog: HistoryEntry = { ...base, id: "n1", source: "resident", at: "2026-11-02T10:03:00Z", template: "Overdue", text: "Hi Ravi,  pay ₹5,000 " };
  const oldLog: HistoryEntry = { ...base, id: "n2", source: "resident", at: "2026-10-01T09:00:00Z", template: "Welcome", text: "Welcome Ravi" };
  it("shows messages from both the Message Center and resident-level records, newest first", () => {
    const h = mergeHistory([oldLog, center]);
    expect(h.map((e) => e.id)).toEqual(["c1", "n2"]);
  });
  it("removes the duplicate when the same message exists in both tables", () => {
    const h = mergeHistory([sameLog, center, oldLog, center]);
    expect(h.map((e) => e.id)).toEqual(["c1", "n2"]);
  });
  it("keeps same text sent at different times as separate messages", () => {
    const later = { ...sameLog, id: "n3", at: "2026-11-05T10:00:00Z" };
    expect(mergeHistory([center, later])).toHaveLength(2);
  });
  it("distinguishes manual confirmation from API delivery", () => {
    expect(historyStatusLabel({ method: "MANUAL_WHATSAPP", status: "sent" })).toBe("Manually Confirmed Sent");
    expect(historyStatusLabel({ method: "WHATSAPP_CLOUD_API", status: "delivered" })).toBe("Delivered (WhatsApp API)");
    expect(historyStatusLabel({ method: "MANUAL_WHATSAPP", status: "sent" })).not.toMatch(/deliver/i);
  });
  it("only the owner sees full message content", () => {
    const long: HistoryEntry = { ...center, text: "x".repeat(200) };
    expect(canViewFullMessage({ role: "owner" })).toBe(true);
    expect(visibleHistory([long], { role: "owner" })[0]!.text).toHaveLength(200);
    const staff = visibleHistory([long], { role: "staff" })[0]!;
    expect(staff.fullText).toBe(false);
    expect(staff.text.length).toBeLessThan(100);
  });
});

describe("quick-send logging", () => {
  it("maps a shared template's category to the resident message log", () => {
    expect(logTypeForCategory("overdue")).toBe("overdue");
    expect(logTypeForCategory("rent")).toBe("bill");
    expect(logTypeForCategory("payment")).toBe("bill");
    expect(logTypeForCategory("deposit")).toBe("welcome");
    expect(logTypeForCategory("announcement")).toBe("other");
    expect(logTypeForCategory("custom")).toBe("other");
    expect(logTypeForCategory("nonsense")).toBe("other");
  });
  it("only overdue sends are held back by the reminder gap", () => {
    expect(isGapLimited("overdue")).toBe(true);
    expect(isGapLimited("bill")).toBe(false);
    expect(isGapLimited("welcome")).toBe(false);
    expect(isGapLimited("other")).toBe(false);
  });
});
