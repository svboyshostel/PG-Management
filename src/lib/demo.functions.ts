import { createServerFn } from "@tanstack/react-start";
import { resolveDemoPreviewEnabled } from "./demo-config";

/** Returns whether read-only Demo Preview is permitted; never accesses database or auth tables. */
export const getDemoStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { enabled: resolveDemoPreviewEnabled() };
});

