import { describe, it, expect } from "vitest";
import { splitEqual, applyFifo, toPaise } from "./money";

describe("money rules", () => {
  it("splits a bulk charge so the total is exact to the paisa", () => {
    const parts = splitEqual(100000, 3); // ₹1000 among 3
    expect(parts).toEqual([33334, 33333, 33333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100000);
  });

  it("applies payments to the oldest bill first and keeps the rest as credit", () => {
    const r = applyFifo([{ id: "aug", payable: 800000 }, { id: "sep", payable: 800000 }], 1000000);
    expect(r.paid).toEqual({ aug: 800000, sep: 200000 });
    expect(r.credit).toBe(0);
    expect(applyFifo([{ id: "aug", payable: 500000 }], 600000).credit).toBe(100000);
  });

  it("stores rupees as integer paise", () => {
    expect(toPaise("7,500.50")).toBe(750050);
  });
});
