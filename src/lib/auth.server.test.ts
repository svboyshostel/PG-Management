// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server", () => ({ getCookie: vi.fn(), setCookie: vi.fn(), deleteCookie: vi.fn() }));
vi.mock("./db.server", () => ({ q: vi.fn() }));
import { hashPassword, verifyPassword } from "./auth.server";
describe("Password verification", () => {
  it("uses salted PBKDF2 and rejects incorrect passwords", async () => {
    const first = await hashPassword("isolated-test-password"), second = await hashPassword("isolated-test-password");
    expect(first).not.toBe(second);
    expect(await verifyPassword("isolated-test-password", first)).toBe(true);
    expect(await verifyPassword("incorrect", first)).toBe(false);
  });
  it("malformed stored hashes return false rather than throwing", async () => {
    for (const hash of ["", "broken", "pbkdf2$zz$12", "pbkdf2$1234$abcd"]) expect(await verifyPassword("test", hash)).toBe(false);
  });
});