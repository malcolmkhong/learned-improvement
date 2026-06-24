/**
 * Smoke test: every published package must contain ONLY production code.
 *
 * Run with: node tests/integration/published-tarball.mjs
 *
 * Exits non-zero if any of the following leak into the npm tarball:
 *   - *.test.ts / *.test.js source files
 *   - tsconfig.json / vitest.config.ts dev configs
 *   - .eslintrc* / .prettierrc*
 *   - coverage/ / .nyc_output/
 *   - src/ (the raw source; consumers should get dist/)
 *   - *.tsbuildinfo
 */

import { strict as assert } from "node:assert";
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PACKAGES = ["packages/core", "packages/cli", "packages/adapters/stub"];

const FORBIDDEN_PATTERNS = [
  /\.test\.(ts|js|d\.ts|d\.ts\.map|js\.map)$/,
  /tsconfig\.json$/,
  /vitest\.config\.(ts|js)$/,
  /\.eslintrc/,
  /\.prettierrc/,
  /^package\/coverage\//,
  /^package\/\.nyc_output\//,
  /^package\/src\//,
  /\.tsbuildinfo$/,
  /\/__tests__\//,
  /\/__mocks__\//,
];

const REQUIRED_PATTERNS = [
  /package\.json$/,
  // README.md and LICENSE are at the repo root, not in package directories.
  // They are intentionally not duplicated per-package.
];

function listPackageFiles(pkgDir) {
  // Use `npm pack --dry-run` to get the file list. npm prints to stderr
  // (or stdout depending on version); we capture both and parse the first
  // JSON-looking chunk.
  const out = execSync(`cd ${pkgDir} && npm pack --dry-run --json 2>&1`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Find the first '[' or '{' and parse from there.
  const start = out.search(/[\[{]/);
  if (start < 0) {
    throw new Error(`No JSON found in npm pack output:\n${out.slice(0, 500)}`);
  }
  const json = out.slice(start);
  const parsed = JSON.parse(json);
  // npm pack JSON: [{ id, name, version, size, unpackedSize, shasum, integrity, files: [{ path, size, ... }] }]
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  return entry.files.map((f) => f.path.replace(/^package\//, ""));
}

const tmpDir = mkdtempSync(join(tmpdir(), "ci-pack-smoke-"));
let totalViolations = 0;

try {
  for (const pkgDir of PACKAGES) {
    process.stdout.write(`\n--- ${pkgDir} ---\n`);
    const files = listPackageFiles(pkgDir);
    process.stdout.write(`  ${files.length} files in tarball\n`);

    // Required files must be present
    const relFiles = files.map((f) => `package/${f}`);
    for (const pattern of REQUIRED_PATTERNS) {
      if (!relFiles.some((f) => pattern.test(f))) {
        process.stdout.write(`  ✘ MISSING: ${pattern}\n`);
        totalViolations += 1;
      }
    }

    // Forbidden files must NOT be present
    for (const file of files) {
      const relPath = `package/${file}`;
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(relPath)) {
          process.stdout.write(`  ✘ LEAKED: ${relPath} (matched ${pattern})\n`);
          totalViolations += 1;
        }
      }
    }

    // Print a sample of what's in the tarball
    process.stdout.write(`  Sample: ${files.slice(0, 5).join(", ")}...\n`);
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

if (totalViolations > 0) {
  console.error(`\n✘ ${totalViolations} violations found.`);
  process.exit(1);
}
console.log("\n✔ All packages publish production-only code.");