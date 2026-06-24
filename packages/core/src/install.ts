/**
 * Install — on first run, copies AGENTS.md and QUICKREF.md into ~/.ci/.
 *
 * Idempotent: if the files already exist and match, we do nothing.
 * If they differ, we overwrite (the bundled templates are the source of truth).
 */

import { existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function resolveTemplateDir(): string {
  // In production: the package ships templates/ alongside dist/.
  // In dev/tests: we walk up from this file to find the repo root.
  const here = dirname(fileURLToPath(import.meta.url));
  // Try several candidate locations.
  const candidates = [
    join(here, "templates"),
    join(here, "..", "templates"),
    join(here, "..", "..", "templates"),
    join(here, "..", "..", "..", "..", "packages", "core", "templates"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "AGENTS.md"))) return c;
  }
  throw new Error(`Could not locate bundled templates directory. Tried: ${candidates.join(", ")}`);
}

export interface InstallResult {
  readonly agentsInstalled: boolean;
  readonly quickrefInstalled: boolean;
}

export function installBundledFiles(homeDir: string): InstallResult {
  mkdirSync(homeDir, { recursive: true });
  const templateDir = resolveTemplateDir();

  const agentsDst = join(homeDir, "AGENTS.md");
  const quickrefDst = join(homeDir, "QUICKREF.md");

  const agentsInstalled = copyIfMissing(join(templateDir, "AGENTS.md"), agentsDst);
  const quickrefInstalled = copyIfMissing(join(templateDir, "QUICKREF.md"), quickrefDst);

  return { agentsInstalled, quickrefInstalled };
}

function copyIfMissing(src: string, dst: string): boolean {
  if (existsSync(dst)) {
    const existing = readFileSync(dst, "utf8");
    const fresh = readFileSync(src, "utf8");
    if (existing === fresh) return false;
  }
  copyFileSync(src, dst);
  return true;
}

/** Resolve the package's own version (for snapshot metadata). */
export function resolvePackageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}
