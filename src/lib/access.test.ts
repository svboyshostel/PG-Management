import { describe, expect, it } from "vitest";
import { assertBranchAccess, branchScope, canAccessBranch } from "./access";
import { canSendMessages } from "./wa";

describe("Phase 4 access rules", () => {
  it("owner can access all branches", () => {
    expect(branchScope({ role: "owner" })).toBeNull();
    expect(canAccessBranch({ role: "owner" }, "unassigned")).toBe(true);
  });
  it("staff can access multiple explicitly assigned branches only", () => {
    const staff = { role: "staff", branch_ids: ["one", "two"] };
    expect(canAccessBranch(staff, "one")).toBe(true);
    expect(canAccessBranch(staff, "two")).toBe(true);
    expect(() => assertBranchAccess(staff, "three")).toThrow("access");
  });
  it("existing staff with no assignments never gain all-branch access", () => {
    expect(branchScope({ role: "staff" })).toEqual([]);
    expect(() => assertBranchAccess({ role: "staff" }, "one")).toThrow("access");
  });
  it("staff messaging requires explicit permission", () => {
    expect(canSendMessages({ role: "staff" })).toBe(false);
    expect(canSendMessages({ role: "staff", can_message: null })).toBe(false);
    expect(canSendMessages({ role: "staff", can_message: false })).toBe(false);
    expect(canSendMessages({ role: "staff", can_message: true })).toBe(true);
    expect(canSendMessages({ role: "owner", can_message: false })).toBe(true);
  });
});