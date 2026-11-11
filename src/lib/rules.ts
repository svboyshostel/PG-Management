// Pure, client-safe business rules (Phase 1). Money is integer paise; dates are "YYYY-MM-DD".

/** Today's date in the PG's timezone, e.g. "2026-11-03". */
export function pgToday(tz = "Asia/Kolkata", now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
export const monthOf = (d: string) => d.slice(0, 8) + "01";
export function addMonths(month: string, n: number): string {
  const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
}
export const clampDueDay = (d: unknown) => {
  const n = Math.trunc(Number(d));
  if (!(n >= 1 && n <= 28)) throw new Error("Due day must be between 1 and 28.");
  return n;
};
/** The due date of a billing month, e.g. ("2026-11-01", 7) → "2026-11-07". */
export const dueDateFor = (month: string, dueDay: number) => month.slice(0, 8) + String(dueDay).padStart(2, "0");

/** Due date for a bill. Someone who starts after that month's due date is due on next month's due date (never overdue on day one). */
export function billDueDate(month: string, dueDay: number, startedOn?: string | null): string {
  const due = dueDateFor(month, dueDay);
  return startedOn && startedOn > due ? dueDateFor(addMonths(month, 1), dueDay) : due;
}

/** Which bill a new extra charge goes on: on/before this month's due date → this month, after → next month. */
export function chargeMonthFor(today: string, dueDay: number): string {
  const m = monthOf(today);
  return today <= dueDateFor(m, dueDay) ? m : addMonths(m, 1);
}

/* ---------- Rooms ---------- */
export const MAX_SHARING = 12;
export const bedLabel = (i: number) => String.fromCharCode(65 + i);
type BedLite = { id: string; label: string; occupied: boolean };
/** Plan a sharing-capacity change. Adds new labels, or removes the highest-labelled VACANT beds. Throws if occupied beds would be lost. */
export function planCapacity(beds: BedLite[], newCap: number): { add: string[]; remove: string[] } {
  if (!Number.isInteger(newCap) || newCap < 1 || newCap > MAX_SHARING) throw new Error(`Sharing must be 1–${MAX_SHARING}.`);
  if (newCap === beds.length) return { add: [], remove: [] };
  if (newCap > beds.length) {
    const used = new Set(beds.map((b) => b.label));
    const add: string[] = [];
    for (let i = 0; add.length < newCap - beds.length; i++) if (!used.has(bedLabel(i))) add.push(bedLabel(i));
    return { add, remove: [] };
  }
  const need = beds.length - newCap;
  const vacant = beds.filter((b) => !b.occupied).sort((a, b) => b.label.localeCompare(a.label));
  if (vacant.length < need) throw new Error(`Only ${vacant.length} bed(s) are vacant. Move residents out before reducing to ${newCap} sharing.`);
  return { add: [], remove: vacant.slice(0, need).map((b) => b.id) };
}

/* ---------- Deposit ---------- */
export type DepositStatus = "none" | "pending" | "partial" | "paid";
export function depositStatus(agreed: number, received: number) {
  const balance = Math.max(0, agreed - received);
  const status: DepositStatus = agreed <= 0 ? "none" : received <= 0 ? "pending" : balance > 0 ? "partial" : "paid";
  return { agreed, received, balance, status };
}
export const depositLabel: Record<DepositStatus, string> = { none: "No deposit", pending: "Pending", partial: "Partially Paid", paid: "Fully Paid" };

/* ---------- ID proof ---------- */
export const ID_TYPES = ["aadhaar", "pan", "driving_licence", "passport", "voter_id", "other"] as const;
export const ID_TYPE_LABEL: Record<string, string> = { aadhaar: "Aadhaar", pan: "PAN", driving_licence: "Driving licence", passport: "Passport", voter_id: "Voter ID", other: "Other" };
export const ID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ID_IMAGE_MAX = 4 * 1024 * 1024;
export function validateIdImage(file: { type: string; size: number }) {
  if (!ID_IMAGE_TYPES.includes(file.type)) throw new Error("ID image must be JPG, PNG or WebP.");
  if (file.size > ID_IMAGE_MAX) throw new Error("ID image must be 4 MB or smaller.");
  return true;
}
/** Aadhaar is never stored in full: only the last 4 digits, masked. */
export const maskAadhaar = (digits: string) => "XXXX XXXX " + digits.slice(-4);

export type IdInput = { method?: string | null | undefined; type?: string | null | undefined; number?: string | null | undefined; hasImage?: boolean | undefined };
/** The two ID methods are mutually exclusive. Returns what may be stored. */
export function normalizeIdProof(i: IdInput): { id_method: "manual" | "upload" | null; id_type: string | null; id_number: string | null } {
  const method = i.method || null;
  if (!method) {
    if (i.number || i.hasImage) throw new Error("Choose how the ID proof is given.");
    return { id_method: null, id_type: null, id_number: null };
  }
  const type = i.type && (ID_TYPES as readonly string[]).includes(i.type) ? i.type : null;
  if (!type) throw new Error("Choose the ID proof type.");
  if (method === "manual") {
    if (i.hasImage) throw new Error("Manual entry can't include an image. Remove the image or switch to upload.");
    const raw = String(i.number ?? "").trim();
    if (!raw) throw new Error("Enter the ID number.");
    if (type === "aadhaar") {
      const d = raw.replace(/\D/g, "");
      if (d.length !== 12) throw new Error("Aadhaar must have 12 digits. Only the last 4 are saved.");
      return { id_method: "manual", id_type: type, id_number: maskAadhaar(d) };
    }
    if (raw.length > 30) throw new Error("ID number is too long.");
    return { id_method: "manual", id_type: type, id_number: raw.toUpperCase() };
  }
  if (method === "upload") {
    if (i.number) throw new Error("Upload doesn't take an ID number. Clear it or switch to manual entry.");
    return { id_method: "upload", id_type: type, id_number: null };
  }
  throw new Error("Unknown ID method.");
}

/* ---------- Itemized bill ---------- */
export const CATEGORIES = ["electricity", "water", "cleaning", "maintenance", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export function chargeCategory(description: string, category?: string | null): Category {
  if (category && (CATEGORIES as readonly string[]).includes(category)) return category as Category;
  const d = description.toLowerCase();
  if (/electric|current|power|eb\b/.test(d)) return "electricity";
  if (/water/.test(d)) return "water";
  if (/clean/.test(d)) return "cleaning";
  if (/mainten|repair/.test(d)) return "maintenance";
  return "other";
}

type Line = { kind: string; description: string; amount: number; category?: string | null };
type BillIn = { billing_month: string; due_date: string; payable: number; paid: number; lines: Line[] };
/** Breakdown of one month's bill plus everything still unpaid from earlier months. */
export function billBreakdown(bills: BillIn[], month: string) {
  const b = bills.find((x) => x.billing_month === month);
  const items = { rent: 0, electricity: 0, water: 0, cleaning: 0, maintenance: 0, other: 0, discountsAndAdjustments: 0 };
  for (const l of b?.lines ?? []) {
    const a = Number(l.amount);
    if (l.kind === "rent") items.rent += a;
    else if (l.kind === "extra_charge") items[chargeCategory(l.description, l.category)] += a;
    else items.discountsAndAdjustments += a; // discount, adjustment, reversal
  }
  const previousOutstanding = bills.filter((x) => x.billing_month < month).reduce((s, x) => s + Math.max(0, x.payable - x.paid), 0);
  const thisBill = b?.payable ?? 0;
  const paymentsReceived = b?.paid ?? 0;
  return {
    month, dueDate: b?.due_date ?? null, ...items, thisBill, previousOutstanding, paymentsReceived,
    totalOutstanding: previousOutstanding + Math.max(0, thisBill - paymentsReceived),
  };
}
