import { calendarMonth, calendarDate } from "./validation";

export type Occupancy = { id: string; resident_id: string; name: string; start_date: string; end_date: string | null; status: string };
export type EbShare = { residentId: string; name: string; days: number; calculated: number; final: number; checkedOut: boolean };
const gcd = (a: bigint, b: bigint): bigint => b === 0n ? a : gcd(b, a % b);

/** Exact rational daily shares; round once using largest remainders, including vacant days. */
export function calculateEb(month: string, total: number, history: Occupancy[]) {
  calendarMonth.parse(month);
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("Enter a valid electricity amount.");
  for (const a of history) { calendarDate.parse(a.start_date); if (a.end_date) calendarDate.parse(a.end_date); }
  const [year, mm] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year ?? 0, mm ?? 0, 0)).getUTCDate();
  const residents = new Map<string, { name: string; days: number; checkedOut: boolean }>();
  const daily: string[][] = [];
  let divisor = BigInt(days);
  for (let d = 1; d <= days; d++) {
    const date = month.slice(0, 8) + String(d).padStart(2, "0");
    const present = [...new Set(history.filter((a) => a.start_date <= date && (!a.end_date || a.end_date >= date)).map((a) => a.resident_id))].sort();
    daily.push(present);
    const denominator = BigInt(days * Math.max(1, present.length));
    divisor = divisor / gcd(divisor, denominator) * denominator;
    for (const id of present) {
      const a = history.find((x) => x.resident_id === id);
      const r = residents.get(id) ?? { name: a?.name ?? "Resident", days: 0, checkedOut: a?.status === "checked_out" };
      r.days++; residents.set(id, r);
    }
  }
  const weights = new Map<string, bigint>();
  for (const present of daily) {
    const targets = present.length ? present : ["~owner"];
    const part = BigInt(total) * (divisor / BigInt(days * targets.length));
    for (const id of targets) weights.set(id, (weights.get(id) ?? 0n) + part);
  }
  const rounded = [...weights].map(([id, w]) => ({ id, amount: Number(w / divisor), remainder: w % divisor }));
  let remainder = total - rounded.reduce((s, r) => s + r.amount, 0);
  rounded.sort((a, b) => a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1);
  for (const r of rounded) if (remainder > 0) { r.amount++; remainder--; }
  const amounts = new Map(rounded.map((r) => [r.id, r.amount]));
  const shares: EbShare[] = [...residents].sort(([a], [b]) => a.localeCompare(b)).map(([id, r]) => ({ residentId: id, ...r, calculated: amounts.get(id) ?? 0, final: amounts.get(id) ?? 0 }));
  return { days, shares, ownerCalculated: amounts.get("~owner") ?? 0 };
}

export function reconcileEb(total: number, shares: Pick<EbShare, "final">[], ownerAccepted: boolean) {
  if (!Number.isSafeInteger(total) || total < 0 || shares.some((s) => !Number.isSafeInteger(s.final) || s.final < 0)) throw new Error("Amounts must be nonnegative whole paise.");
  const allocated = shares.reduce((s, r) => s + r.final, 0);
  if (allocated > total) throw new Error("Allocated charges exceed the room bill. Reconcile the difference.");
  const owner = total - allocated;
  if (owner > 0 && !ownerAccepted) throw new Error("Confirm the remaining amount as owner-borne before finalizing.");
  return { allocated, owner };
}