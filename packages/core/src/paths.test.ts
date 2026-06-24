import { describe, it, expect } from "vitest";
import { resolve as resolvePath, sep } from "node:path";
import { resolvePaths } from "./paths.js";

describe("paths", () => {
  it("uses ~/.ci by default", () => {
    const p = resolvePaths();
    expect(p.home.endsWith(`${sep}.ci`)).toBe(true);
    expect(p.db).toBe(`${p.home}${sep}state.db`);
    expect(p.config).toBe(`${p.home}${sep}config.toml`);
    expect(p.profile).toBe(`${p.home}${sep}project_profile.json`);
    expect(p.agentsMd).toBe(`${p.home}${sep}AGENTS.md`);
    expect(p.quickrefMd).toBe(`${p.home}${sep}QUICKREF.md`);
  });

  it("respects explicit home override", () => {
    const expected = resolvePath("/tmp/foo");
    const p = resolvePaths({ home: expected });
    expect(p.home).toBe(expected);
    expect(p.db).toBe(`${expected}${sep}state.db`);
  });

  it("respects CI_HOME env var", () => {
    const expected = resolvePath("/tmp/env");
    process.env["CI_HOME"] = expected;
    try {
      const p = resolvePaths();
      expect(p.home).toBe(expected);
    } finally {
      delete process.env["CI_HOME"];
    }
  });
});
