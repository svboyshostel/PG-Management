import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDemoPreviewEnabled } from "../lib/demo-config";
import { DEMO_BRANCHES, DEMO_EB_BILLS, DEMO_PAYMENTS, DEMO_RESIDENTS, DEMO_ROOMS } from "../lib/demo-data";

describe("Demo Preview isolation and synthetic data", () => {
  it("disables demo preview in production by default unless explicitly enabled", () => {
    expect(resolveDemoPreviewEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(resolveDemoPreviewEnabled({ NODE_ENV: "production", ALLOW_DEMO_PREVIEW: "false" })).toBe(false);
    expect(resolveDemoPreviewEnabled({ NODE_ENV: "production", ALLOW_DEMO_PREVIEW: "true" })).toBe(true);
    expect(resolveDemoPreviewEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(resolveDemoPreviewEnabled({ NODE_ENV: "development", ALLOW_DEMO_PREVIEW: "false" })).toBe(false);
  });

  it("keeps demo modules isolated from real database, storage, and auth functions", () => {
    const files = [
      path.resolve(process.cwd(), "src/lib/demo-data.ts"),
      path.resolve(process.cwd(), "src/lib/demo.functions.ts"),
      path.resolve(process.cwd(), "src/routes/demo.tsx"),
    ];
    const forbiddenImports = ["db.server", "storage.server", "auth.server", "auth.functions", "pg.functions", "eb.functions", "documents.functions"];

    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      for (const forbidden of forbiddenImports) {
        expect(text).not.toContain(forbidden);
      }
    }
  });

  it("provides synthetic branches, rooms, residents, payments, and reconciled EB bills", () => {
    expect(DEMO_BRANCHES.length).toBeGreaterThanOrEqual(2);
    expect(DEMO_ROOMS.length).toBeGreaterThanOrEqual(4);
    expect(DEMO_RESIDENTS.length).toBeGreaterThanOrEqual(5);
    expect(DEMO_PAYMENTS.length).toBeGreaterThanOrEqual(4);
    expect(DEMO_EB_BILLS.length).toBeGreaterThanOrEqual(2);

    for (const eb of DEMO_EB_BILLS) {
      const residentsTotal = eb.shares.reduce((sum, s) => sum + s.final, 0);
      expect(residentsTotal + eb.ownerPaise).toBe(eb.totalPaise);
    }
  });
});

