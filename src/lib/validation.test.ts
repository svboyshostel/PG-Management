import { expect, it } from "vitest";
import { calendarDate, calendarMonth, paymentInput } from "./validation";
it("rejects impossible dates and months but accepts leap day", () => {
  expect(calendarDate.safeParse("2026-02-30").success).toBe(false);
  expect(calendarDate.safeParse("2028-02-29").success).toBe(true);
  expect(calendarMonth.safeParse("2026-13-01").success).toBe(false);
});
it("requires positive integer paise, a supported payment method and an idempotency key", () => {
  const data = { residentId: "00000000-0000-4000-8000-000000000001", account: "rent", amount: 100, method: "cash", date: "2026-11-04", idem: "one" };
  expect(paymentInput.safeParse(data).success).toBe(true);
  for (const change of [{ amount: -1 }, { amount: 0 }, { amount: 1.5 }, { amount: Number.MAX_SAFE_INTEGER + 1 }, { method: "internal" }, { idem: "" }]) expect(paymentInput.safeParse({ ...data, ...change }).success).toBe(false);
});