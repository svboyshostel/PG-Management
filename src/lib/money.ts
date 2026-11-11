// Client-safe helpers. All money is integer paise.
export const toPaise = (rupees: string | number) => {
  const n = typeof rupees === "number" ? rupees : parseFloat(String(rupees).replace(/,/g, ""));
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
};

export const inr = (paise: number | string | null | undefined) => {
  const p = Number(paise ?? 0);
  return "₹" + (p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 });
};

export const monthStart = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const monthLabel = (m: string) =>
  new Date(m.slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
export const dateLabel = (d: string | null | undefined) =>
  d ? new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Split total paise across n people: equal parts, first (total mod n) get +1 paisa. Sum is exact. */
export function splitEqual(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Allocate payments oldest-bill-first. Returns paid per bill and leftover credit. */
export function applyFifo(bills: { id: string; payable: number }[], totalPaid: number) {
  let left = Math.max(0, totalPaid);
  const paid: Record<string, number> = {};
  for (const b of bills) {
    const p = Math.min(Math.max(b.payable, 0), left);
    paid[b.id] = p;
    left -= p;
  }
  return { paid, credit: left };
}

export function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

export const waLink = (mobile: string, text: string) => {
  const digits = mobile.replace(/\D/g, "");
  const num = digits.length === 10 ? "91" + digits : digits;
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
};
