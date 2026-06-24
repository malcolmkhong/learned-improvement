import { describe, it, expect } from "vitest";
import { ProjectProfileSchema } from "./project-profile.js";

describe("ProjectProfileSchema", () => {
  const base = {
    version: 1 as const,
    repo_root: "/tmp/repo",
    language: "typescript" as const,
    package_manager: "pnpm" as const,
    scanned_at: new Date().toISOString(),
    folders: [],
    adrs: [],
    naming_conventions: [],
    dependencies: [],
    lint_configs: [],
  };

  it("accepts a minimal profile", () => {
    expect(ProjectProfileSchema.safeParse(base).success).toBe(true);
  });

  it("rejects unknown language", () => {
    expect(ProjectProfileSchema.safeParse({ ...base, language: "cobol" }).success).toBe(false);
  });

  it("rejects unknown package manager", () => {
    expect(ProjectProfileSchema.safeParse({ ...base, package_manager: "maven" }).success).toBe(false);
  });

  it("version must be 1", () => {
    expect(ProjectProfileSchema.safeParse({ ...base, version: 2 }).success).toBe(false);
  });
});
