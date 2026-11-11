import { writeFile } from "node:fs/promises";
import { SCHEMA_STATEMENTS } from "../src/lib/schema";
import { EB_SCHEMA_STATEMENTS } from "../src/lib/eb-schema";
import { DOCUMENT_SCHEMA_STATEMENTS } from "../src/lib/documents-schema";
await writeFile("db/schema.sql", "-- PG Manager schema. Apply explicitly after backup and review.\n" + SCHEMA_STATEMENTS.map(s=>s+";").join("\n\n")+"\n");
await writeFile("db/final-changes.sql", "-- Additive storage and room EB migration. No legacy records deleted.\n" + [...DOCUMENT_SCHEMA_STATEMENTS,...EB_SCHEMA_STATEMENTS].map(s=>s+";").join("\n\n")+"\n");
console.log("Generated SQL only; no database connection.");