#!/usr/bin/env node
/**
 * `ci` — the Continuous Improvement CLI binary.
 *
 * Subcommands:
 *   scan, daemon, lessons, rules, events, facts, doctor, config,
 *   adapters, run, state, report
 */

import { Command } from "commander";
import {
  resolvePaths,
  ConfigManager,
  scanRepo,
  openDatabase,
  SqliteEventStore,
  SqliteFactStore,
  SqliteLessonStore,
  SqliteRuleStore,
  LessonEngine,
  RuleEngine,
  Daemon,
  installBundledFiles,
  runDoctor,
  classify,
  type ActionProposal,
  SnapshotManager,
  DEFAULT_CONFIG,
} from "continuous-improvement-core";

const program = new Command();
program
  .name("ci")
  .description("Continuous Improvement — self-learning engine for AI coding agents")
  .version("0.1.0");

program
  .command("scan")
  .description("Scan a repo and emit a project_profile.json")
  .argument("[repo]", "Repo path", ".")
  .option("--out <path>", "Output file", undefined)
  .action(async (repo: string, options: { out?: string }) => {
    const paths = resolvePaths();
    const result = scanRepo(repo);
    const out = options.out ?? paths.profile;
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(result.profile, null, 2));
    console.log(`✔ Scanned ${repo}`);
    console.log(`  Language: ${result.profile.language}`);
    console.log(`  Package manager: ${result.profile.package_manager}`);
    console.log(`  Folders: ${result.profile.folders.length}`);
    console.log(`  ADRs: ${result.profile.adrs.length}`);
    console.log(`  Dependencies: ${result.profile.dependencies.length}`);
    console.log(`  Lint configs: ${result.profile.lint_configs.length}`);
    console.log(`  Profile written to ${out}`);
    if (result.warnings.length > 0) {
      console.log(`  ⚠ Warnings: ${result.warnings.length}`);
    }
  });

program
  .command("daemon")
  .description("Daemon control (start / stop / status / run-once)")
  .argument("<action>", "Action: start | stop | status | run-once")
  .action(async (action: string) => {
    const paths = resolvePaths();
    const db = openDatabase({ path: paths.db });
    const config = new ConfigManager(paths.config);
    const events = new SqliteEventStore(db);
    const facts = new SqliteFactStore(db);
    const lessons = new SqliteLessonStore(db);
    const rules = new SqliteRuleStore(db);
    const lessonEngine = new LessonEngine(lessons, events, config.get());
    const ruleEngine = new RuleEngine(lessons, rules, config.get());
    const daemon = new Daemon({ config: config.get(), events, facts, lessons, rules, lessonEngine, ruleEngine });

    if (action === "run-once") {
      installBundledFiles(paths.home);
      Daemon.ensureHome(paths.home);
      const report = await daemon.runOnce();
      console.log(`✔ Daemon cycle complete in ${report.cycleEndedAt}`);
      console.log(`  Proposals: ${report.proposals.length}`);
      console.log(`  Applied: ${report.applied.length}`);
      console.log(`  Blocked: ${report.blocked.length}`);
      if (report.errors.length > 0) {
        console.log(`  Errors: ${report.errors.length}`);
        for (const e of report.errors) console.log(`    - ${e.actionId}: ${e.message}`);
      }
      db.close();
      return;
    }

    if (action === "status") {
      const { existsSync } = await import("node:fs");
      console.log(`Config: ${existsSync(paths.config) ? "present" : "missing"}`);
      console.log(`Database: ${existsSync(paths.db) ? "present" : "missing"}`);
      console.log(`Profile: ${existsSync(paths.profile) ? "present" : "missing"}`);
      db.close();
      return;
    }

    console.log(`Daemon '${action}' is not implemented in V1 (use 'run-once' for a single cycle).`);
    db.close();
  });

program
  .command("lessons")
  .description("Manage lessons")
  .argument("<action>", "Action: list | pending | rm")
  .argument("[id]", "Lesson ID (required for rm)")
  .action((action: string, id?: string) => {
    const paths = resolvePaths();
    const db = openDatabase({ path: paths.db });
    const lessons = new SqliteLessonStore(db);
    if (action === "list" || action === "pending") {
      const status = action === "pending" ? "candidate" : undefined;
      const items = lessons.list(status !== undefined ? { status } : {});
      if (items.length === 0) {
        console.log(`(no ${action === "pending" ? "pending " : ""}lessons)`);
      } else {
        for (const l of items) {
          console.log(`${l.id}  [${l.status}]  ${l.confidence}  ${l.occurrences}×/${l.distinct_sessions} sessions`);
          console.log(`    pattern: ${l.pattern}`);
          console.log(`    fix:     ${l.fix}`);
        }
      }
    } else if (action === "rm") {
      if (id === undefined) {
        console.error("Usage: ci lessons rm <id>");
        process.exit(2);
      }
      const result = lessons.updateStatus(id, "rejected");
      if (result === null) {
        console.error(`Lesson not found: ${id}`);
        process.exit(1);
      }
      console.log(`✔ Lesson ${id} marked as rejected`);
    } else {
      console.error(`Unknown action: ${action}`);
      process.exit(2);
    }
    db.close();
  });

program
  .command("rules")
  .description("Manage rules")
  .argument("<action>", "Action: list | pending | rm | restore")
  .argument("[id]", "Rule ID (required for rm/restore)")
  .action((action: string, id?: string) => {
    const paths = resolvePaths();
    const db = openDatabase({ path: paths.db });
    const rules = new SqliteRuleStore(db);
    if (action === "list") {
      const items = rules.list();
      if (items.length === 0) {
        console.log("(no rules)");
      } else {
        for (const r of items) {
          console.log(`${r.id}  [${r.status}]  ${r.action}  priority=${r.priority}`);
          console.log(`    condition: ${r.condition.type} /${r.condition.pattern}/ scope=${r.condition.scope}`);
          console.log(`    rationale: ${r.rationale}`);
        }
      }
    } else if (action === "pending") {
      const items = rules.list({ status: "candidate" });
      if (items.length === 0) {
        console.log("(no pending rules)");
      } else {
        for (const r of items) {
          console.log(`${r.id}  ${r.action}  priority=${r.priority}  ${r.rationale}`);
        }
      }
    } else if (action === "rm" || action === "restore") {
      if (id === undefined) {
        console.error(`Usage: ci rules ${action} <id>`);
        process.exit(2);
      }
      const status = action === "rm" ? "archived" : "active";
      const result = rules.setStatus(id, status);
      if (result === null) {
        console.error(`Rule not found: ${id}`);
        process.exit(1);
      }
      console.log(`✔ Rule ${id} → ${status}`);
    } else {
      console.error(`Unknown action: ${action}`);
      process.exit(2);
    }
    db.close();
  });

program
  .command("events")
  .description("List events")
  .option("--since <iso>", "Only events since this ISO timestamp")
  .option("--type <type>", "Only events of this type")
  .option("--limit <n>", "Max events to show", "50")
  .action((options: { since?: string; type?: string; limit?: string }) => {
    const paths = resolvePaths();
    const db = openDatabase({ path: paths.db });
    const events = new SqliteEventStore(db);
    const limit = options.limit !== undefined ? Number(options.limit) : 50;
    const items = events.tail({
      limit,
      since: options.since,
      type: options.type as never,
    });
    if (items.length === 0) {
      console.log("(no events)");
    } else {
      for (const e of items) {
        console.log(`[${e.ts}]  ${e.type}  severity=${e.severity}  error_type=${e.error_type ?? "-"}`);
        console.log(`    source: ${e.source}  trace: ${e.trace_id ?? "-"}`);
      }
    }
    db.close();
  });

program
  .command("facts")
  .description("Show facts")
  .option("--category <cat>", "Filter by category")
  .option("--key <key>", "Show a single fact")
  .action((options: { category?: string; key?: string }) => {
    const paths = resolvePaths();
    const db = openDatabase({ path: paths.db });
    const facts = new SqliteFactStore(db);
    if (options.key !== undefined) {
      const f = facts.get(options.key);
      if (f === null) {
        console.log(`(no fact with key=${options.key})`);
      } else {
        console.log(`${f.key}  [${f.category}]  confidence=${f.confidence}`);
        console.log(`  source: ${f.source}  url: ${f.source_url ?? "-"}`);
        console.log(`  fetched_at: ${f.fetched_at}  verified_at: ${f.verified_at ?? "-"}`);
        console.log(`  value: ${JSON.stringify(f.value, null, 2)}`);
      }
    } else {
      const items = facts.list(options.category !== undefined ? { category: options.category as never } : {});
      if (items.length === 0) {
        console.log("(no facts)");
      } else {
        for (const f of items) {
          console.log(`${f.key}  [${f.category}]  confidence=${f.confidence}  source=${f.source}`);
        }
      }
    }
    db.close();
  });

program
  .command("doctor")
  .description("Run production-readiness checks")
  .action(() => {
    const report = runDoctor();
    console.log(`\nDoctor — ${report.passed} passed, ${report.failed} failed\n`);
    for (const r of report.results) {
      const mark = r.passed ? "✔" : "✘";
      console.log(`${mark}  [${r.id}]  ${r.name}`);
      console.log(`     ${r.message}`);
    }
    if (report.failed > 0) process.exit(1);
  });

program
  .command("config")
  .description("Config inspection (use `ci config show|set|reset`)")
  .argument("<action>", "Action: show | set | reset")
  .argument("[key]", "Config key (for set/reset), e.g. learning.min_occurrences")
  .argument("[value]", "Value (for set)")
  .action((action: string, key?: string, _value?: string) => {
    const paths = resolvePaths();
    const config = new ConfigManager(paths.config);
    if (action === "show") {
      console.log(JSON.stringify(config.get(), null, 2));
      return;
    }
    if (action === "reset") {
      if (key === undefined) {
        console.error("Usage: ci config reset <section>");
        process.exit(2);
      }
      if (!(key in DEFAULT_CONFIG)) {
        console.error(`Unknown section: ${key}`);
        process.exit(2);
      }
      config.reset(key as keyof typeof DEFAULT_CONFIG);
      console.log(`✔ Reset [${key}] to defaults`);
      return;
    }
    if (action === "set") {
      console.error("ci config set is V0.2; use `edit ~/.ci/config.toml` for now.");
      process.exit(2);
    }
    console.error(`Unknown action: ${action}`);
    process.exit(2);
  });

program
  .command("classify")
  .description("Dry-run: classify an action kind (debug helper for adapters)")
  .argument("<kind>", "Action kind, e.g. modify_owned_file")
  .option("--path <path>", "Path (for file-related kinds)")
  .action((kind: string, options: { path?: string }) => {
    const paths = resolvePaths();
    const config = new ConfigManager(paths.config);
    const proposal: ActionProposal = {
      id: "dry-run",
      kind: makeKind(kind, options.path),
      rationale: "dry-run",
      sourceRuleId: null,
      sourceLessonId: null,
    };
    const verdict = classify(proposal, config.get());
    console.log(JSON.stringify({ proposal, verdict }, null, 2));
  });

program
  .command("state")
  .description("State management (snapshot / rollback)")
  .argument("<action>", "Action: snapshot | rollback")
  .argument("[target]", "Snapshot name (for rollback)")
  .action((action: string, target?: string) => {
    const paths = resolvePaths();
    const sm = new SnapshotManager(paths.snapshotDir);
    if (action === "snapshot") {
      const info = sm.create(paths.db);
      console.log(`✔ Created ${info.name} (${info.sizeBytes} bytes)`);
      return;
    }
    if (action === "rollback") {
      if (target === undefined) {
        const snaps = sm.list();
        if (snaps.length === 0) {
          console.error("No snapshots available");
          process.exit(1);
        }
        console.log("Available snapshots:");
        for (const s of snaps) console.log(`  ${s.name}  ${s.createdAt}`);
        return;
      }
      sm.restore(target, paths.db);
      console.log(`✔ Restored from ${target}`);
      return;
    }
    console.error(`Unknown action: ${action}`);
    process.exit(2);
  });

program
  .command("report")
  .description("Generate a status report")
  .argument("<scope>", "Scope: daily | weekly")
  .action((scope: string) => {
    if (scope !== "daily" && scope !== "weekly") {
      console.error(`Unknown scope: ${scope}`);
      process.exit(2);
    }
    const paths = resolvePaths();
    const db = openDatabase({ path: paths.db });
    const events = new SqliteEventStore(db);
    const facts = new SqliteFactStore(db);
    const lessons = new SqliteLessonStore(db);
    const rules = new SqliteRuleStore(db);

    const hours = scope === "daily" ? 24 : 24 * 7;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const e = events.tail({ since, limit: 1000 });
    const f = facts.list({ limit: 100 });
    const l = lessons.list();
    const r = rules.list();

    console.log(`\n=== ${scope.toUpperCase()} REPORT ===\n`);
    console.log(`Window: since ${since}\n`);
    console.log(`Events:    ${e.length}`);
    console.log(`Facts:     ${f.length}`);
    console.log(`Lessons:   ${l.length}  (${l.filter((x) => x.status === "accepted").length} accepted, ${l.filter((x) => x.status === "candidate").length} candidate)`);
    console.log(`Rules:     ${r.length}  (${r.filter((x) => x.status === "active").length} active, ${r.filter((x) => x.status === "candidate").length} candidate, ${r.filter((x) => x.status === "archived").length} archived)`);
    db.close();
  });

program
  .command("install")
  .description("Install AGENTS.md and QUICKREF.md into ~/.ci/")
  .action(() => {
    const paths = resolvePaths();
    const r = installBundledFiles(paths.home);
    console.log(`✔ Installed bundled files into ${paths.home}`);
    console.log(`  AGENTS.md:   ${r.agentsInstalled ? "installed/updated" : "unchanged"}`);
    console.log(`  QUICKREF.md: ${r.quickrefInstalled ? "installed/updated" : "unchanged"}`);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
});

function makeKind(kind: string, path: string | undefined): ActionProposal["kind"] {
  switch (kind) {
    case "store_event":
      return { type: "store_event" };
    case "update_fact":
      return { type: "update_fact" };
    case "synthesise_rule":
      return { type: "synthesise_rule", lessonId: "dry-run" };
    case "activate_rule":
      return { type: "activate_rule", ruleId: "dry-run" };
    case "deactivate_rule":
      return { type: "deactivate_rule", ruleId: "dry-run" };
    case "modify_owned_file":
      return { type: "modify_owned_file", path: path ?? "x" };
    case "modify_unowned_file":
      return { type: "modify_unowned_file", path: path ?? "x" };
    case "network_request":
      return { type: "network_request", url: path ?? "https://example.com", method: "GET" };
    case "spawn_subprocess":
      return { type: "spawn_subprocess", command: path ?? "ls" };
    case "delete_data":
      return { type: "delete_data", path: path ?? "x" };
    case "modify_auth":
      return { type: "modify_auth", scope: path ?? "x" };
    case "modify_financial":
      return { type: "modify_financial", scope: path ?? "x" };
    case "modify_infrastructure":
      return { type: "modify_infrastructure", scope: path ?? "x" };
    default:
      throw new Error(`Unknown kind: ${kind}`);
  }
}
