import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getManualInstallInstruction } from "./pwa";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");

describe("PWA configuration and branding", () => {
  it("provides a valid PG Manager manifest and required icon files", () => {
    const manifestPath = path.join(PUBLIC_DIR, "manifest.webmanifest");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      name: string;
      short_name: string;
      display: string;
      start_url: string;
      theme_color: string;
      background_color: string;
      icons: { src: string; sizes: string; type: string; purpose?: string }[];
    };

    expect(manifest.name).toBe("PG Manager");
    expect(manifest.short_name).toBe("PG Manager");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toMatch(/^#/);
    expect(manifest.background_color).toMatch(/^#/);

    expect(manifest.icons.some((i) => i.sizes === "192x192" && i.purpose !== "maskable")).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === "512x512" && i.purpose !== "maskable")).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);

    for (const icon of manifest.icons) {
      const iconFile = path.join(PUBLIC_DIR, icon.src.replace(/^\//, ""));
      expect(fs.existsSync(iconFile)).toBe(true);
      expect(fs.statSync(iconFile).size).toBeGreaterThan(0);
    }

    for (const requiredAsset of ["favicon.ico", "icon.svg", "apple-touch-icon.png", "sw.js"]) {
      const filePath = path.join(PUBLIC_DIR, requiredAsset);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.statSync(filePath).size).toBeGreaterThan(0);
    }
  });

  it("keeps the service worker online-first and excludes sensitive endpoints", () => {
    const sw = fs.readFileSync(path.join(PUBLIC_DIR, "sw.js"), "utf8");
    expect(sw).toContain("self.skipWaiting()");
    expect(sw).toContain("self.clients.claim()");
    expect(sw).toContain("caches.delete");
    expect(sw).toContain('request.method !== "GET"');
    expect(sw).toContain('request.mode === "navigate"');
    expect(sw).toContain("STATIC_ASSET_PATHS.has");
    expect(sw).not.toContain("/_serverFn");
    expect(sw).not.toContain("supabase");
  });

  it("returns tailored fallback installation instructions per platform", () => {
    expect(getManualInstallInstruction("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15")).toContain("Add to Home Screen");
    expect(getManualInstallInstruction("Mozilla/5.0 (Linux; Android 14) Chrome/126.0.0.0 Mobile")).toContain("Install app");
    expect(getManualInstallInstruction("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15")).toContain("Add to Dock");
    expect(getManualInstallInstruction("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0")).toContain("Install PG Manager");
  });
});

