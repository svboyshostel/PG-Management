// Client-safe WhatsApp Message Center rules (Phase 2). Shared by manual sending now and the Cloud API later.
import { inr } from "./money";

export const SEND_METHODS = ["MANUAL_WHATSAPP"] as const;
export type SendMethod = (typeof SEND_METHODS)[number];
export const API_NOT_CONNECTED = "Only manual WhatsApp sharing is available.";
export function methodError(method: string, _legacyConnected = false): string | null {
  return method === "MANUAL_WHATSAPP" ? null : API_NOT_CONNECTED;
}

/* ---------- Templates ---------- */
export const VARIABLES = ["name", "pg", "room", "bed", "rent", "balance", "current_balance", "previous_balance", "deposit_balance", "month", "due_date", "bill_breakdown"] as const;
export const TEMPLATE_CATEGORIES = ["rent", "overdue", "deposit", "payment", "announcement", "maintenance", "custom"] as const;
export const CATEGORY_LABEL: Record<string, string> = { rent: "Rent", overdue: "Overdue", deposit: "Deposit", payment: "Payment", announcement: "Announcement", maintenance: "Maintenance", custom: "Custom" };

/** Resident-page quick sends log under one of these types. */
export const LOG_TYPES = ["welcome", "bill", "overdue", "other"] as const;
export type LogType = (typeof LOG_TYPES)[number];
/** One template list serves bulk sending and the per-resident quick send: a template's category decides how it is logged. */
export function logTypeForCategory(category: string): LogType {
  if (category === "overdue") return "overdue";
  if (category === "rent" || category === "payment") return "bill";
  if (category === "deposit") return "welcome";
  return "other";
}
/** Only overdue sends are rate-limited by the reminder gap. */
export const isGapLimited = (t: LogType) => t === "overdue";

export function placeholders(body: string): string[] {
  return [...new Set([...body.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]!))];
}
/** Rejects empty text, unknown {placeholders} and stray braces. */
export function validateTemplate(t: { title: string; body: string; category: string }) {
  const title = t.title?.trim(), body = t.body?.trim();
  if (!title) throw new Error("Template title is required.");
  if (title.length > 80) throw new Error("Title must be 80 characters or fewer.");
  if (!body) throw new Error("Message content is required.");
  if (body.length > 4000) throw new Error("Message must be 4000 characters or fewer.");
  if (!(TEMPLATE_CATEGORIES as readonly string[]).includes(t.category)) throw new Error("Choose a template category.");
  const unknown = placeholders(body).filter((p) => !(VARIABLES as readonly string[]).includes(p));
  if (unknown.length) throw new Error(`Unknown variable(s): ${unknown.map((u) => `{${u}}`).join(", ")}`);
  const stripped = body.replace(/\{[a-z_]+\}/g, "");
  if (/[{}]/.test(stripped)) throw new Error("Message has an unmatched { or }.");
  return { title, body, category: t.category };
}
export const renderTemplate = (body: string, vars: Record<string, string>) => body.replace(/\{([a-z_]+)\}/g, (m, k) => vars[k] ?? m);

/* ---------- Bill breakdown text ---------- */
export type Breakdown = { rent: number; electricity: number; water: number; cleaning: number; maintenance: number; other: number; discountsAndAdjustments: number;
  thisBill: number; previousOutstanding: number; paymentsReceived: number; totalOutstanding: number; dueDate: string | null };
export function breakdownText(b: Breakdown, dueLabel: string) {
  const rows: [string, number][] = [["Monthly Rent", b.rent], ["Electricity", b.electricity], ["Water", b.water], ["Cleaning", b.cleaning],
    ["Maintenance", b.maintenance], ["Other Charges", b.other], ["Discounts/Adjustments", b.discountsAndAdjustments]];
  const lines = rows.filter(([k, v]) => v !== 0 || k === "Monthly Rent").map(([k, v]) => `${k}: ${inr(v)}`);
  lines.push("", `Total Charges: ${inr(b.thisBill)}`);
  if (b.previousOutstanding) lines.push(`Previous Outstanding: ${inr(b.previousOutstanding)}`);
  lines.push(`Payments Received: ${inr(b.paymentsReceived)}`, "", `Total Outstanding: ${inr(b.totalOutstanding)}`);
  if (b.dueDate) lines.push("", `Due Date: ${dueLabel}`);
  return lines.join("\n");
}

/* ---------- Recipients ---------- */
export const RECIPIENT_CATEGORIES = ["all", "unpaid", "no_payment", "partial", "paid", "overdue", "deposit_pending", "joined_this_month"] as const;
export type RecipientCategory = (typeof RECIPIENT_CATEGORIES)[number];
export const RECIPIENT_LABEL: Record<RecipientCategory, string> = {
  all: "All active residents", unpaid: "Rent unpaid (incl. partial)", no_payment: "No rent payment received", partial: "Partially paid rent",
  paid: "Fully paid rent", overdue: "Overdue rent", deposit_pending: "Pending security deposit", joined_this_month: "Joined this month",
};
export type PayStatus = "no_bill" | "no_payment" | "partial" | "paid";
export const PAY_LABEL: Record<PayStatus, string> = { no_bill: "No bill", no_payment: "Unpaid", partial: "Partly paid", paid: "Paid" };

type BillLite = { billing_month: string; due_date: string; payable: number; paid: number };
/** Payment status for the selected month, from ledger figures only. */
export function payStatus(bills: BillLite[], month: string): PayStatus {
  const b = bills.find((x) => x.billing_month === month);
  if (!b || b.payable <= 0) return b ? "paid" : "no_bill";
  if (b.paid >= b.payable) return "paid";
  return b.paid > 0 ? "partial" : "no_payment";
}
/** Overdue only after a bill's SAVED due date has passed and it still has money owing. */
export const isOverdue = (bills: BillLite[], today: string) => bills.some((b) => b.payable - b.paid > 0 && b.due_date < today);

export type Candidate = { status: string; joining_date: string; bills: BillLite[]; depositBalance: number };
export function matchesCategory(r: Candidate, cat: RecipientCategory, month: string, today: string) {
  if (r.status !== "active") return false;
  const ps = payStatus(r.bills, month);
  switch (cat) {
    case "all": return true;
    case "unpaid": return ps === "no_payment" || ps === "partial";
    case "no_payment": return ps === "no_payment";
    case "partial": return ps === "partial";
    case "paid": return ps === "paid";
    case "overdue": return isOverdue(r.bills, today);
    case "deposit_pending": return r.depositBalance > 0;
    case "joined_this_month": return r.joining_date.slice(0, 7) === month.slice(0, 7);
  }
}

/** Indian mobile for WhatsApp: 10 digits starting 6–9, optionally with 91. Returns the wa.me number or null. */
export function waNumber(mobile: string | null | undefined): string | null {
  const d = String(mobile ?? "").replace(/\D/g, "");
  const ten = d.length === 12 && d.startsWith("91") ? d.slice(2) : d.length === 11 && d.startsWith("0") ? d.slice(1) : d;
  return /^[6-9]\d{9}$/.test(ten) ? "91" + ten : null;
}
export const waUrl = (num: string, text: string) => `https://wa.me/${num}?text=${encodeURIComponent(text)}`;

/* ---------- Duplicates ---------- */
export type SentRecord = { resident_id: string; template_id: string | null; billing_month: string | null; outstanding: number | null };
/** Residents already manually marked sent for the same template + month. balanceChanged = legit follow-up. */
export function findDuplicates(ids: { id: string; outstanding: number }[], history: SentRecord[], templateId: string, month: string) {
  const out: { id: string; balanceChanged: boolean }[] = [];
  for (const r of ids) {
    const prev = history.filter((h) => h.resident_id === r.id && h.template_id === templateId && h.billing_month === month);
    if (prev.length) out.push({ id: r.id, balanceChanged: !prev.some((p) => Number(p.outstanding ?? -1) === r.outstanding) });
  }
  return out;
}

/* ---------- Manual queue ---------- */
export const RECIPIENT_STATUSES = ["pending", "opened", "sent", "skipped", "failed"] as const;
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];
export const STATUS_LABEL: Record<RecipientStatus, string> = { pending: "Pending", opened: "Opened in WhatsApp", sent: "Manually confirmed sent", skipped: "Skipped", failed: "Failed to open" };
const ALLOWED: Record<RecipientStatus, RecipientStatus[]> = {
  pending: ["opened", "skipped", "failed"],
  opened: ["opened", "sent", "skipped", "failed"],
  failed: ["opened", "skipped"],
  skipped: ["pending", "opened"],
  sent: [],
};
/** One recipient at a time; "sent" requires having opened WhatsApp first and is final. */
export function nextStatus(cur: RecipientStatus, to: RecipientStatus): RecipientStatus {
  if (!ALLOWED[cur].includes(to)) throw new Error(`Can't change "${STATUS_LABEL[cur]}" to "${STATUS_LABEL[to]}".`);
  return to;
}
export type SessionStatus = "active" | "paused" | "completed";
export function sessionAfter(cur: SessionStatus, action: "pause" | "resume", allDone: boolean): SessionStatus {
  if (cur === "completed") throw new Error("This session is already finished.");
  if (action === "pause") return "paused";
  return allDone ? "completed" : "active";
}
export function progress(statuses: RecipientStatus[]) {
  const c = { pending: 0, opened: 0, sent: 0, skipped: 0, failed: 0 } as Record<RecipientStatus, number>;
  for (const s of statuses) c[s]++;
  return { ...c, total: statuses.length, processed: c.sent + c.skipped + c.failed, done: c.pending + c.opened === 0 };
}

/* ---------- Permissions ---------- */
type U = { role: string; can_message?: boolean | null };
export const canManageTemplates = (u: U) => u.role === "owner";
export const canSendMessages = (u: U) => u.role === "owner" || (u.role === "staff" && u.can_message === true);

/* ---------- Resident message history (merges notification_log + Message Center) ---------- */
export type HistorySource = "resident" | "center";
export type HistoryEntry = {
  id: string; source: HistorySource; at: string; template: string; text: string;
  method: "MANUAL_WHATSAPP" | "WHATSAPP_CLOUD_API"; status: string; by?: string | null; providerId?: string | null;
  error?: string | null; events?: { status: string; at: string }[];
};
/** Plain-language status. Manual sends are only ever "confirmed by staff", never "delivered". */
export function historyStatusLabel(e: Pick<HistoryEntry, "method" | "status" | "providerId">) {
  if (e.method === "MANUAL_WHATSAPP") {
    return ({ sent: "Manually Confirmed Sent", opened: "Opened in WhatsApp (not confirmed)", pending: "Queued", skipped: "Skipped", failed: "Failed" } as Record<string, string>)[e.status] ?? e.status;
  }
  return ({ queued: "Queued for API", submitted: "Submitting to Meta", accepted: "Accepted by Meta", sent: "Sent (Meta)", delivered: "Delivered (WhatsApp API)", read: "Read (WhatsApp API)", failed: "API delivery failed" } as Record<string, string>)[e.status] ?? e.status;
}
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
/** Same text marked within 10 minutes in both places = one message. Center entry wins (has template + method). */
export function mergeHistory(entries: HistoryEntry[], windowMs = 10 * 60 * 1000): HistoryEntry[] {
  const sorted = [...entries].sort((a, b) => (a.source === b.source ? 0 : a.source === "center" ? -1 : 1));
  const kept: HistoryEntry[] = [];
  const seen = new Set<string>();
  for (const e of sorted) {
    const key = `${e.source}:${e.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // API messages carry a stable Meta message ID and are never merged by text.
    const dup = e.source === "resident" && kept.some((k) => k.source === "center" && k.method === "MANUAL_WHATSAPP" && norm(k.text) === norm(e.text)
      && Math.abs(new Date(k.at).getTime() - new Date(e.at).getTime()) <= windowMs);
    if (!dup) kept.push(e);
  }
  return kept.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
/** Owner sees full message text; others see a short preview. */
export const canViewFullMessage = (u: U) => u.role === "owner";
export function visibleHistory(entries: HistoryEntry[], u: U, previewLen = 80) {
  const full = canViewFullMessage(u);
  return entries.map((e) => ({ ...e, statusLabel: historyStatusLabel(e), fullText: full,
    text: full || e.text.length <= previewLen ? e.text : e.text.slice(0, previewLen) + "…" }));
}
