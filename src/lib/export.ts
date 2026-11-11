/** Quoting alone does not prevent spreadsheet formula execution. */
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[\s]*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}