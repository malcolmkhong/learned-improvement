/**
 * ProjectScanner — walks a repository and produces a ProjectProfile.
 *
 * Detects:
 *  - Language (TypeScript / JavaScript / Python / mixed / unknown)
 *  - Package manager (npm / pnpm / yarn / pip / poetry / uv / none)
 *  - Folders (depth 2)
 *  - ADRs (files matching ADR naming patterns)
 *  - Dependencies (from package.json, requirements.txt, pyproject.toml)
 *  - Lint configs (.eslintrc*, tsconfig.json, ruff.toml, .flake8)
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { ProjectProfileSchema, type ProjectProfile, type Adr, type Dependency, type LintConfig } from "../models/project-profile.js";

const ADR_PATTERNS = [
  /^ADR[-_]?\d{4}/i,
  /^\d{4}[-_].*\.md$/,
  /^decision[-_]?\d{4}/i,
  /^adr[-_]?\d+/i,
];

const ADR_DIRS = ["docs/adr", "docs/decisions", "docs/architecture/decisions", "adr", "decisions"];

const LINT_FILES = [
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yaml",
  "eslint.config.js",
  "eslint.config.mjs",
  ".tslint.json",
  "tslint.json",
  "tsconfig.json",
  "ruff.toml",
  ".ruff.toml",
  "pyproject.toml",
  ".flake8",
  ".pylintrc",
  "pylintrc",
];

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  "env",
  ".env",
  ".idea",
  ".vscode",
  ".DS_Store",
  "target",
]);

export interface ScanResult {
  readonly profile: ProjectProfile;
  readonly warnings: readonly string[];
}

export function scanRepo(repoRoot: string): ScanResult {
  const warnings: string[] = [];
  if (!existsSync(repoRoot)) {
    throw new Error(`Repo root does not exist: ${repoRoot}`);
  }

  const stat = statSync(repoRoot);
  if (!stat.isDirectory()) {
    throw new Error(`Repo root is not a directory: ${repoRoot}`);
  }

  const language = detectLanguage(repoRoot, warnings);
  const packageManager = detectPackageManager(repoRoot);
  const folders = scanFolders(repoRoot);
  const adrs = scanAdrs(repoRoot, warnings);
  const dependencies = scanDependencies(repoRoot, warnings);
  const lintConfigs = scanLintConfigs(repoRoot);
  const namingConventions = inferNamingConventions(repoRoot, warnings);

  const profile: ProjectProfile = ProjectProfileSchema.parse({
    version: 1,
    repo_root: repoRoot,
    language,
    package_manager: packageManager,
    scanned_at: new Date().toISOString(),
    folders,
    adrs,
    naming_conventions: namingConventions,
    dependencies,
    lint_configs: lintConfigs,
  });

  return { profile, warnings };
}

function detectLanguage(repoRoot: string, warnings: string[]): ProjectProfile["language"] {
  const hasTs = existsSync(join(repoRoot, "tsconfig.json")) ||
    existsSync(join(repoRoot, "tsconfig.base.json"));
  const hasJs = existsSync(join(repoRoot, "package.json")) && !hasTs;
  const hasPy = existsSync(join(repoRoot, "requirements.txt")) ||
    existsSync(join(repoRoot, "pyproject.toml")) ||
    existsSync(join(repoRoot, "setup.py"));

  if (hasTs && hasPy) return "mixed";
  if (hasTs) return "typescript";
  if (hasPy) return "python";
  if (hasJs) return "javascript";
  warnings.push(`Could not determine language for ${repoRoot}; defaulting to unknown`);
  return "unknown";
}

function detectPackageManager(repoRoot: string): ProjectProfile["package_manager"] {
  if (existsSync(join(repoRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(repoRoot, "pnpm-workspace.yaml"))) return "pnpm";
  if (existsSync(join(repoRoot, "yarn.lock"))) return "yarn";
  if (existsSync(join(repoRoot, "package-lock.json"))) return "npm";
  if (existsSync(join(repoRoot, "bun.lockb"))) return "npm";
  if (existsSync(join(repoRoot, "uv.lock"))) return "uv";
  if (existsSync(join(repoRoot, "Pipfile.lock"))) return "pip";
  if (existsSync(join(repoRoot, "requirements.txt")) || existsSync(join(repoRoot, "pyproject.toml"))) return "pip";
  if (existsSync(join(repoRoot, "package.json"))) return "npm";
  return "unknown";
}

function scanFolders(repoRoot: string): ProjectProfile["folders"] {
  const folders: ProjectProfile["folders"] = [];
  const topLevel = safeReadDir(repoRoot);
  for (const entry of topLevel) {
    if (IGNORED_DIRS.has(entry)) continue;
    const fullPath = join(repoRoot, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        folders.push({ path: entry + "/", purpose: inferFolderPurpose(entry) });
      } else {
        folders.push({ path: entry });
      }
    } catch {
      // skip broken symlinks
    }
  }
  return folders;
}

function inferFolderPurpose(name: string): string | undefined {
  const map: Record<string, string> = {
    src: "source code",
    lib: "library code",
    test: "tests",
    tests: "tests",
    __tests__: "tests",
    spec: "tests",
    docs: "documentation",
    doc: "documentation",
    examples: "example code",
    example: "example code",
    scripts: "utility scripts",
    bin: "binaries",
    config: "configuration",
    configs: "configuration",
    packages: "monorepo packages",
    apps: "monorepo applications",
  };
  return map[name];
}

function scanAdrs(repoRoot: string, warnings: string[]): Adr[] {
  const adrs: Adr[] = [];
  for (const dir of ADR_DIRS) {
    const fullDir = join(repoRoot, dir);
    if (!existsSync(fullDir)) continue;
    let entries: string[];
    try {
      entries = readdirSync(fullDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      if (!ADR_PATTERNS.some((re) => re.test(entry))) continue;
      const fullPath = join(fullDir, entry);
      try {
        const content = readFileSync(fullPath, "utf8");
        adrs.push({
          path: relative(repoRoot, fullPath).split(sep).join("/"),
          title: extractAdrTitle(entry, content),
          decision: extractAdrDecision(content),
        });
      } catch (err) {
        warnings.push(`Failed to read ADR ${fullPath}: ${(err as Error).message}`);
      }
    }
  }
  return adrs;
}

function extractAdrTitle(filename: string, content: string): string {
  const firstHeading = content.split(/\r?\n/).find((l) => l.startsWith("# "));
  if (firstHeading !== undefined) return firstHeading.slice(2).trim();
  return filename.replace(/\.md$/, "");
}

function extractAdrDecision(content: string): string {
  const lines = content.split(/\r?\n/);
  let inSection = false;
  const collected: string[] = [];
  for (const line of lines) {
    if (line.match(/^#+\s*(decision|chosen|outcome)/i) !== null) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("# ")) break;
    if (inSection && line.trim() !== "") collected.push(line.trim());
  }
  return collected.join(" ").slice(0, 500);
}

function scanDependencies(repoRoot: string, warnings: string[]): Dependency[] {
  const deps: Dependency[] = [];
  const pkgPath = join(repoRoot, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      const collect = (bag: Record<string, string> | undefined, source: Dependency["source"]) => {
        if (bag === undefined) return;
        for (const [name, version] of Object.entries(bag)) {
          deps.push({ name, version: stripRangePrefixes(version), source });
        }
      };
      collect(pkg["dependencies"] as Record<string, string> | undefined, "npm");
      collect(pkg["devDependencies"] as Record<string, string> | undefined, "npm");
      collect(pkg["peerDependencies"] as Record<string, string> | undefined, "npm");
    } catch (err) {
      warnings.push(`Failed to parse package.json: ${(err as Error).message}`);
    }
  }

  const reqPath = join(repoRoot, "requirements.txt");
  if (existsSync(reqPath)) {
    try {
      const lines = readFileSync(reqPath, "utf8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "" || trimmed.startsWith("#")) continue;
        const m = /^([A-Za-z0-9_.\-]+)(.*)$/.exec(trimmed);
        if (m === null) continue;
        const name = m[1] ?? "";
        const rest = m[2] ?? "";
        const v = rest.match(/[=<>~!]=([0-9][^,;\s]*)/);
        deps.push({ name, version: v !== null ? v[1] ?? "" : "*", source: "pypi" });
      }
    } catch (err) {
      warnings.push(`Failed to parse requirements.txt: ${(err as Error).message}`);
    }
  }

  const pyprojectPath = join(repoRoot, "pyproject.toml");
  if (existsSync(pyprojectPath)) {
    try {
      const content = readFileSync(pyprojectPath, "utf8");
      const projectMatch = /\[project\][\s\S]*?dependencies\s*=\s*\[([^\]]*)\]/.exec(content);
      if (projectMatch !== null) {
        const inner = projectMatch[1] ?? "";
        for (const entry of inner.split(",")) {
          const trimmed = entry.trim().replace(/^["']|["']$/g, "");
          if (trimmed === "") continue;
          const m = /^([A-Za-z0-9_.\-]+)(.*)$/.exec(trimmed);
          if (m === null) continue;
          const name = m[1] ?? "";
          const rest = m[2] ?? "";
          const v = rest.match(/[=<>~!]=([0-9][^,;\s]*)/);
          deps.push({ name, version: v !== null ? v[1] ?? "" : "*", source: "pypi" });
        }
      }
    } catch (err) {
      warnings.push(`Failed to parse pyproject.toml: ${(err as Error).message}`);
    }
  }

  return deps;
}

function stripRangePrefixes(version: string): string {
  return version.replace(/^[\^~]/, "");
}

function scanLintConfigs(repoRoot: string): LintConfig[] {
  const found: LintConfig[] = [];
  for (const file of LINT_FILES) {
    const path = join(repoRoot, file);
    if (!existsSync(path)) continue;
    let tool: string;
    if (file.startsWith("eslint")) tool = "eslint";
    else if (file === "tslint.json" || file === ".tslint.json") tool = "tslint";
    else if (file === "tsconfig.json") tool = "tsc";
    else if (file.startsWith("ruff") || file === "pyproject.toml") tool = "ruff";
    else if (file === ".flake8") tool = "flake8";
    else if (file === ".pylintrc" || file === "pylintrc") tool = "pylint";
    else continue;
    found.push({ tool, config_path: file });
  }
  return found;
}

function inferNamingConventions(repoRoot: string, warnings: string[]): string[] {
  const conventions: string[] = [];
  const hasKebab = hasFilesMatching(repoRoot, /^[a-z][a-z0-9]*(-[a-z0-9]+)*\.(ts|js|tsx|jsx|py)$/, warnings);
  const hasSnake = hasFilesMatching(repoRoot, /^[a-z][a-z0-9]*(_[a-z0-9]+)*\.(ts|js|tsx|jsx|py)$/, warnings);
  const hasCamel = hasFilesMatching(repoRoot, /^[a-z][a-zA-Z0-9]*\.(ts|js|tsx|jsx)$/, warnings);

  if (hasKebab) conventions.push("kebab-case for file names");
  if (hasSnake) conventions.push("snake_case for file names");
  if (hasCamel) conventions.push("camelCase for file names");

  if (conventions.length === 0) {
    conventions.push("(no clear naming convention detected)");
  }
  return conventions;
}

function hasFilesMatching(repoRoot: string, pattern: RegExp, warnings: string[]): boolean {
  let found = false;
  try {
    const stack = [repoRoot];
    let depth = 0;
    while (stack.length > 0 && depth < 3) {
      const dir = stack.pop();
      if (dir === undefined) break;
      const entries = safeReadDir(dir);
      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry)) continue;
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            stack.push(fullPath);
          } else if (pattern.test(entry)) {
            found = true;
          }
        } catch {
          // skip
        }
        if (found) break;
      }
      depth += 1;
    }
  } catch (err) {
    warnings.push(`Failed to inspect repo: ${(err as Error).message}`);
  }
  return found;
}

function safeReadDir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
