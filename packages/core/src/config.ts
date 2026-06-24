/**
 * Config engine — loads, validates, and edits ~/.ci/config.toml.
 *
 * The schema is the single source of truth for what the daemon cares about.
 * Every setting has a default; the file is created on first run with defaults.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

/** Learning subsystem — controls when events become lessons and lessons become rules. */
export const LearningConfigSchema = z.object({
  min_occurrences: z.number().int().min(1).default(3),
  window_hours: z.number().int().min(1).default(24),
  min_sessions: z.number().int().min(1).default(2),
  auto_promote_confidence: z.enum(["low", "medium", "high"]).default("medium"),
  max_active_rules: z.number().int().min(1).default(200),
});

/** Autonomy subsystem — controls when the loop may execute, apply, or block changes. */
export const AutonomyConfigSchema = z.object({
  default_tier: z.enum(["low", "medium", "high", "critical", "off"]).default("low"),
  allow_medium: z.boolean().default(true),
  allow_high: z.boolean().default(false),
  allow_critical: z.boolean().default(false),
  daily_report: z.boolean().default(true),
});

/** Research subsystem — what to fetch from the web and how to verify it. */
export const ResearchConfigSchema = z.object({
  enabled: z.boolean().default(false),
  max_age_months: z.number().int().min(1).default(24),
  poll_interval_minutes: z.number().int().min(5).default(60),
  require_url_proof: z.boolean().default(true),
  sources: z.array(z.string()).default([]),
});

/** Ownership — the only paths the Evolver may modify. */
export const OwnershipConfigSchema = z.object({
  owned_paths: z.array(z.string()).default(["packages/core/**", "docs/**"]),
});

/** Daemon subsystem — scheduler intervals. */
export const DaemonConfigSchema = z.object({
  lesson_scan_interval_minutes: z.number().int().min(1).default(60),
  rule_synthesis_interval_minutes: z.number().int().min(1).default(360),
  research_poll_interval_minutes: z.number().int().min(5).default(60),
  snapshot_interval_hours: z.number().int().min(1).default(24),
  archive_retention_days: z.number().int().min(1).default(90),
});

export const ConfigSchema = z.object({
  version: z.literal(1),
  learning: LearningConfigSchema.default({}),
  autonomy: AutonomyConfigSchema.default({}),
  research: ResearchConfigSchema.default({}),
  ownership: OwnershipConfigSchema.default({}),
  daemon: DaemonConfigSchema.default({}),
});

export type Config = z.output<typeof ConfigSchema>;
export type LearningConfig = z.output<typeof LearningConfigSchema>;
export type AutonomyConfig = z.output<typeof AutonomyConfigSchema>;
export type ResearchConfig = z.output<typeof ResearchConfigSchema>;
export type OwnershipConfig = z.output<typeof OwnershipConfigSchema>;
export type DaemonConfig = z.output<typeof DaemonConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({
  version: 1,
  learning: {},
  autonomy: {},
  research: {},
  ownership: {},
  daemon: {},
});

export class ConfigManager {
  private current: Config;

  constructor(
    private readonly configPath: string,
    options: { createIfMissing?: boolean } = {},
  ) {
    this.current = this.loadOrCreate(options.createIfMissing ?? true);
  }

  get(): Config {
    return this.current;
  }

  set<K extends keyof Config>(section: K, value: Config[K]): Config {
    const next: Config = { ...this.current, [section]: value };
    const parsed = ConfigSchema.safeParse(next);
    if (!parsed.success) {
      throw new Error(`Invalid config for [${String(section)}]: ${parsed.error.message}`);
    }
    this.current = parsed.data;
    this.persist();
    return this.current;
  }

  reset<K extends keyof Config>(section: K): Config {
    const defaults = DEFAULT_CONFIG[section];
    return this.set(section, defaults);
  }

  private loadOrCreate(createIfMissing: boolean): Config {
    if (!existsSync(this.configPath)) {
      if (!createIfMissing) {
        throw new Error(`Config not found: ${this.configPath}`);
      }
      mkdirSync(dirname(this.configPath), { recursive: true });
      writeFileSync(this.configPath, renderToml(DEFAULT_CONFIG), "utf8");
      return DEFAULT_CONFIG;
    }
    const raw = readFileSync(this.configPath, "utf8");
    const parsed = parseToml(raw);
    const result = ConfigSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Invalid config in ${this.configPath}: ${result.error.message}`);
    }
    return result.data;
  }

  private persist(): void {
    mkdirSync(dirname(this.configPath), { recursive: true });
    writeFileSync(this.configPath, renderToml(this.current), "utf8");
  }
}

/**
 * Minimal TOML writer for our config. We control the format, so this is safe.
 */
function renderToml(config: Config): string {
  const lines: string[] = [`version = ${config.version}`, ""];
  for (const [section, value] of Object.entries(config)) {
    if (section === "version") continue;
    lines.push(`[${section}]`);
    for (const [k, v] of Object.entries(value)) {
      lines.push(`${k} = ${renderValue(v)}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderValue(v: unknown): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) {
    const inner = v.map(renderValue).join(", ");
    return `[${inner}]`;
  }
  throw new Error(`Cannot render TOML value: ${String(v)}`);
}

/**
 * Minimal TOML parser — supports the subset we emit (sections, scalars, arrays).
 */
function parseToml(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = { version: 1 };
  let currentSection = "";
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const sectionMatch = /^\[([a-zA-Z0-9_.]+)\]$/.exec(line);
    if (sectionMatch !== null) {
      currentSection = sectionMatch[1] ?? "";
      if (result[currentSection] === undefined) result[currentSection] = {};
      continue;
    }
    const kvMatch = /^([a-zA-Z0-9_]+)\s*=\s*(.+)$/.exec(line);
    if (kvMatch === null) {
      throw new Error(`Bad TOML line: ${rawLine}`);
    }
    const key = kvMatch[1] ?? "";
    const valueRaw = kvMatch[2] ?? "";
    if (currentSection === "") {
      // `version` is the only allowed top-level key.
      if (key !== "version") {
        throw new Error(`Top-level key not allowed: ${key}`);
      }
      result["version"] = parseValue(valueRaw);
      continue;
    }
    let section = result[currentSection];
    if (section === undefined) {
      section = {};
      result[currentSection] = section;
    }
    (section as Record<string, unknown>)[key] = parseValue(valueRaw);
  }
  return result;
}

function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((s) => parseValue(s.trim()));
  }
  const n = Number(raw);
  if (!Number.isNaN(n)) return n;
  throw new Error(`Cannot parse TOML value: ${raw}`);
}
