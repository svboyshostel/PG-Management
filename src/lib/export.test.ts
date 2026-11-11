import { expect, it } from "vitest";
import { csvCell } from "./export";
it("neutralizes formula injection in payment exports", () => {
  expect(csvCell('=HYPERLINK("unsafe")')).toBe('"\'=HYPERLINK(""unsafe"")"');
  expect(csvCell(" +SUM(1,2)")).toBe('"\' +SUM(1,2)"');
  expect(csvCell("Normal reference")).toBe('"Normal reference"');
});