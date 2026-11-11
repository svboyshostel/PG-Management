// Owner recovery-code rules.
import { describe, expect, it } from "vitest";
import {
  RECOVERY_MAX_FAILS,
  attemptsAllowed,
  generateRecoveryCode,
  normalizeRecoveryCode,
  passwordProblem,
  recoveryHashInput,
} from "./reset";

describe("password strength", () => {
  it("rejects short and oversized passwords", () => {
    expect(passwordProblem("1234567")).toBe("Password must be at least 8 characters.");
    expect(passwordProblem("a".repeat(201))).toBe("Password is too long.");
    expect(passwordProblem("bedroom8")).toBeNull();
  });
});

describe("recovery codes", () => {
  it("are 6 groups of 4 with no look-alike characters", () => {
    const c = generateRecoveryCode();
    expect(c).toMatch(/^([A-HJ-NP-Z2-9]{4}-){5}[A-HJ-NP-Z2-9]{4}$/);
  });
  it("differ every time", () => {
    const set = new Set(Array.from({ length: 50 }, () => generateRecoveryCode()));
    expect(set.size).toBe(50);
  });
  it("accept any case, spaces or dashes when typed back", () => {
    const c = generateRecoveryCode();
    expect(normalizeRecoveryCode(c.toLowerCase().replace(/-/g, " "))).toBe(c.replace(/-/g, ""));
  });
  it("reject wrong length or characters", () => {
    expect(normalizeRecoveryCode("ABCD")).toBeNull();
    expect(normalizeRecoveryCode("0".repeat(24))).toBeNull();
  });
  it("hash input is tied to the account", () => {
    expect(recoveryHashInput("a", "X")).not.toBe(recoveryHashInput("b", "X"));
  });
});

describe("guess limit", () => {
  it("allows 5 wrong attempts and blocks the next", () => {
    expect(RECOVERY_MAX_FAILS).toBe(5);
    expect(attemptsAllowed(4)).toBe(true);
    expect(attemptsAllowed(5)).toBe(false);
  });
});
