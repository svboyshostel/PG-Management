import { neon } from "@neondatabase/serverless";
import { SCHEMA_STATEMENTS } from "../src/lib/schema";
import { EB_SCHEMA_STATEMENTS } from "../src/lib/eb-schema";
import { DOCUMENT_SCHEMA_STATEMENTS } from "../src/lib/documents-schema";
const apply = process.argv.includes("--apply");
const statements = process.argv.includes("--final-only") ? [...DOCUMENT_SCHEMA_STATEMENTS, ...EB_SCHEMA_STATEMENTS] : SCHEMA_STATEMENTS;
if (!apply) {
  console.log(`Review mode: ${statements.length} statements; no database connection or changes.`);
  console.log(statements.map(s => s + ";").join("\n\n"));
} else {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("Set DATABASE_URL before explicitly applying migrations.");
  const sql = neon(url);
  await sql.transaction(statements.map(s => sql.query(s)));
  console.log(`Applied ${statements.length} statements in one transaction.`);
}