// Pure owner recovery-code rules: code shape, normalising, guess limits, password strength.
// No database, no environment variables — so every rule is testable on its own.

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;
/** Wrong guesses allowed for one email inside the window before it is locked. */
export const RECOVERY_MAX_FAILS = 5;
/** Wrong guesses allowed across all emails inside the window (stops spraying many addresses). */
export const RECOVERY_MAX_GLOBAL_FAILS = 30;
export const RECOVERY_WINDOW_MINUTES = 15;

// 32 symbols without look-alikes (no I, O, 0, 1) → 5 bits each; 24 symbols = 120 bits.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LENGTH = 24;

export function passwordProblem(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD)
    return `Password must be at least ${MIN_PASSWORD} characters.`;
  if (pw.length > MAX_PASSWORD) return "Password is too long.";
  return null;
}

/** A fresh code like ABCD-EFGH-JKLM-NPQR-STUV-WXYZ from a secure random source. */
export function generateRecoveryCode(random: (n: number) => Uint8Array = (n) =>
  crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(LENGTH);
  let out = "";
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[(bytes[i] ?? 0) & 31];
  return out.match(/.{4}/g)!.join("-");
}

/** Accepts the code typed with any spacing, dashes or case. Returns null when it can't be a code. */
export function normalizeRecoveryCode(input: string): string | null {
  const s = String(input ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (s.length !== LENGTH) return null;
  for (const c of s) if (!ALPHABET.includes(c)) return null;
  return s;
}

/** What gets hashed: tied to the account so one hash can never match another owner. */
export function recoveryHashInput(userId: string, normalized: string): string {
  return `pg-recovery:v1:${userId}:${normalized}`;
}

/** True while the number of failed attempts is under the limit. */
export function attemptsAllowed(failures: number, max = RECOVERY_MAX_FAILS): boolean {
  return failures < max;
}
