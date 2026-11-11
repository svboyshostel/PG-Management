/** Client-safe permission rules. Empty assignments never imply access to all branches. */
export type BranchUser = { role: string; branch_ids?: string[] };
export const branchScope = (user: BranchUser): string[] | null => user.role === "owner" ? null : [...new Set(user.branch_ids ?? [])];
export const canAccessBranch = (user: BranchUser, branchId: string) => user.role === "owner" || (user.branch_ids ?? []).includes(branchId);
export function assertBranchAccess(user: BranchUser, branchId: string | null | undefined) {
  if (!branchId || !canAccessBranch(user, branchId)) throw new Error("You don't have access to this branch.");
}
export const NO_BRANCHES = "No branches assigned. Ask the owner to assign you a branch.";