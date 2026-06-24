import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigManager, DEFAULT_CONFIG, ConfigSchema } from "./config.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ci-cfg-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("ConfigManager", () => {
  it("creates a default config on first run", () => {
    const cfgPath = join(dir, "config.toml");
    const cm = new ConfigManager(cfgPath);
    expect(existsSync(cfgPath)).toBe(true);
    const cfg = cm.get();
    expect(cfg.learning.min_occurrences).toBe(3);
    expect(cfg.autonomy.default_tier).toBe("low");
    expect(cfg.research.enabled).toBe(false);
    expect(cfg.ownership.owned_paths).toEqual(["packages/core/**", "docs/**"]);
  });

  it("round-trips a custom config", () => {
    const cfgPath = join(dir, "config.toml");
    const cm = new ConfigManager(cfgPath);
    const custom = {
      ...DEFAULT_CONFIG,
      learning: { ...DEFAULT_CONFIG.learning, min_occurrences: 5 },
    };
    cm.set("learning", custom.learning);
    // Re-read from disk
    const cm2 = new ConfigManager(cfgPath, { createIfMissing: false });
    expect(cm2.get().learning.min_occurrences).toBe(5);
  });

  it("rejects an invalid section", () => {
    const cfgPath = join(dir, "config.toml");
    writeFileSync(cfgPath, "[learning]\nmin_occurrences = -1\n", "utf8");
    expect(() => new ConfigManager(cfgPath, { createIfMissing: false })).toThrow();
  });

  it("reset restores defaults", () => {
    const cfgPath = join(dir, "config.toml");
    const cm = new ConfigManager(cfgPath);
    cm.set("learning", { ...DEFAULT_CONFIG.learning, min_occurrences: 99 });
    expect(cm.get().learning.min_occurrences).toBe(99);
    cm.reset("learning");
    expect(cm.get().learning.min_occurrences).toBe(3);
  });

  it("DEFAULT_CONFIG is schema-valid", () => {
    expect(() => ConfigSchema.parse(DEFAULT_CONFIG)).not.toThrow();
  });

  it("rendered config contains every section", () => {
    const cfgPath = join(dir, "config.toml");
    new ConfigManager(cfgPath);
    const text = readFileSync(cfgPath, "utf8");
    for (const section of ["[learning]", "[autonomy]", "[research]", "[ownership]", "[daemon]"]) {
      expect(text).toContain(section);
    }
  });
});
