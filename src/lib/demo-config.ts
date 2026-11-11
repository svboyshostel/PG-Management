/**
 * Controls whether the isolated read-only /demo preview route is accessible.
 * Disabled in production by default unless ALLOW_DEMO_PREVIEW is explicitly "true".
 */
export function resolveDemoPreviewEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env["ALLOW_DEMO_PREVIEW"] === "false") return false;
  if (env["ALLOW_DEMO_PREVIEW"] === "true") return true;
  return env["NODE_ENV"] !== "production";
}

