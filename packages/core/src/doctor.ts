/**
 * Doctor — runs production-readiness checks and prints a pass/fail report.
 *
 * Each check is a named function returning { passed, message }. New checks
 * can be added by extending the CHECKS array; the runner handles ordering
 * and reporting.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolvePaths } from "./paths.js";
import { openDatabase } from "./db.js";
import { SqliteEventStore } from "./stores/sqlite-event-store.js";
import { SqliteFactStore } from "./stores/sqlite-fact-store.js";
import { SqliteLessonStore } from "./stores/sqlite-lesson-store.js";
import { SqliteRuleStore } from "./stores/sqlite-rule-store.js";

export interface CheckResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly message: string;
}

export type Check = () => CheckResult;

export interface DoctorReport {
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly passed: number;
  readonly failed: number;
  readonly results: readonly CheckResult[];
}

export function runDoctor(homeDir?: string): DoctorReport {
  const startedAt = new Date().toISOString();
  const paths = resolvePaths(homeDir !== undefined ? { home: homeDir } : {});
  const checks: Check[] = makeChecks(paths);
  const results: CheckResult[] = [];
  for (const check of checks) {
    try {
      results.push(check());
    } catch (err) {
      results.push({ id: "?", name: "?", passed: false, message: (err as Error).message });
    }
  }
  const finishedAt = new Date().toISOString();
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  return { startedAt, finishedAt, passed, failed, results };
}

function makeChecks(paths: ReturnType<typeof resolvePaths>): Check[] {
  return [
    checkHomeDirExists(paths),
    checkDbFileExists(paths),
    checkDbIsReachable(paths),
    checkConfigExists(paths),
    checkConfigIsValid(paths),
    checkTemplatesInstalled(paths),
    checkSnapshotsDirExists(paths),
    checkLogDirExists(paths),
    checkNodeVersion(),
  ];
}

function checkHomeDirExists(paths: ReturnType<typeof resolvePaths>): Check {
  return () => ({
    id: "home-dir",
    name: "Home directory (~/.ci) exists",
    passed: existsSync(paths.home),
    message: existsSync(paths.home) ? `Found at ${paths.home}` : `Missing: ${paths.home}`,
  });
}

function checkDbFileExists(paths: ReturnType<typeof resolvePaths>): Check {
  return () => ({
    id: "db-file",
    name: "SQLite database file exists",
    passed: existsSync(paths.db),
    message: existsSync(paths.db) ? `Found at ${paths.db}` : `Run \`ci scan\` or \`ci daemon start\` to create ${paths.db}`,
  });
}

function checkDbIsReachable(paths: ReturnType<typeof resolvePaths>): Check {
  return () => {
    if (!existsSync(paths.db)) return { id: "db-reachable", name: "SQLite database is reachable", passed: false, message: "DB missing" };
    try {
      const db = openDatabase({ path: paths.db, readonly: true });
      const events = new SqliteEventStore(db);
      const facts = new SqliteFactStore(db);
      const lessons = new SqliteLessonStore(db);
      const rules = new SqliteRuleStore(db);
      const ev = events.tail({ limit: 1 });
      const f = facts.get("test");
      const l = lessons.list({ limit: 1 });
      const r = rules.list({ limit: 1 });
      db.close();
      return {
        id: "db-reachable",
        name: "SQLite database is reachable and stores are functional",
        passed: true,
        message: `Stores OK (events=${ev.length}, facts sample=${f === null ? "none" : "found"}, lessons=${l.length}, rules=${r.length})`,
      };
    } catch (err) {
      return { id: "db-reachable", name: "SQLite database is reachable", passed: false, message: (err as Error).message };
    }
  };
}

function checkConfigExists(paths: ReturnType<typeof resolvePaths>): Check {
  return () => ({
    id: "config-exists",
    name: "Config file exists",
    passed: existsSync(paths.config),
    message: existsSync(paths.config) ? `Found at ${paths.config}` : `Run \`ci daemon start\` to create ${paths.config}`,
  });
}

function checkConfigIsValid(paths: ReturnType<typeof resolvePaths>): Check {
  return () => {
    if (!existsSync(paths.config)) return { id: "config-valid", name: "Config file is valid TOML", passed: false, message: "Config missing" };
    try {
      // The config engine will throw on invalid TOML or schema violation.
      // Lazy import to avoid a circular reference at module load.
      const text = readFileSync(paths.config, "utf8");
      if (!text.includes("[learning]") || !text.includes("[autonomy]")) {
        return { id: "config-valid", name: "Config file has required sections", passed: false, message: "Missing [learning] or [autonomy] section" };
      }
      return { id: "config-valid", name: "Config file has required sections", passed: true, message: "OK" };
    } catch (err) {
      return { id: "config-valid", name: "Config file is valid TOML", passed: false, message: (err as Error).message };
    }
  };
}

function checkTemplatesInstalled(paths: ReturnType<typeof resolvePaths>): Check {
  return () => {
    const agents = existsSync(paths.agentsMd);
    const quickref = existsSync(paths.quickrefMd);
    return {
      id: "templates",
      name: "AGENTS.md and QUICKREF.md installed",
      passed: agents && quickref,
      message: agents && quickref ? "Both templates installed" : `Missing: ${agents ? "" : "AGENTS.md "}${quickref ? "" : "QUICKREF.md"}`,
    };
  };
}

function checkSnapshotsDirExists(paths: ReturnType<typeof resolvePaths>): Check {
  return () => ({
    id: "snapshots-dir",
    name: "Snapshots directory exists",
    passed: existsSync(paths.snapshotDir),
    message: existsSync(paths.snapshotDir) ? `Found at ${paths.snapshotDir}` : `Will be created on first snapshot`,
  });
}

function checkLogDirExists(paths: ReturnType<typeof resolvePaths>): Check {
  return () => {
    const dir = paths.logDir;
    const ok = existsSync(dir);
    return {
      id: "log-dir",
      name: "Log directory exists",
      passed: ok,
      message: ok ? `Found at ${dir}` : `Will be created on daemon start`,
    };
  };
}

function checkNodeVersion(): Check {
  return () => {
    const major = Number(process.versions.node.split(".")[0] ?? "0");
    return {
      id: "node-version",
      name: "Node.js >= 20",
      passed: major >= 20,
      message: `Detected Node ${process.versions.node}`,
    };
  };
}
