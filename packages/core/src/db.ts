/**
 * SQLite connection factory.
 * Uses better-sqlite3 with WAL mode.
 */

import BetterSqlite3, { type Database } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface DbOptions {
  readonly path: string;
  readonly readonly?: boolean;
}

export function openDatabase(options: DbOptions): Database {
  mkdirSync(dirname(options.path), { recursive: true });
  const db = new BetterSqlite3(options.path);
  if (!options.readonly) {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("synchronous = NORMAL");
    migrate(db);
  }
  return db;
}

function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      ts          TEXT NOT NULL,
      type        TEXT NOT NULL,
      severity    TEXT NOT NULL,
      error_type  TEXT,
      source      TEXT NOT NULL,
      payload     TEXT NOT NULL,
      trace_id    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_ts          ON events(ts);
    CREATE INDEX IF NOT EXISTS idx_events_type_ts     ON events(type, ts);
    CREATE INDEX IF NOT EXISTS idx_events_error_type  ON events(error_type, ts);

    CREATE TABLE IF NOT EXISTS facts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key         TEXT NOT NULL UNIQUE,
      category    TEXT NOT NULL,
      value       TEXT NOT NULL,
      source      TEXT NOT NULL,
      source_url  TEXT,
      fetched_at  TEXT NOT NULL,
      verified_at TEXT,
      confidence  REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);

    CREATE TABLE IF NOT EXISTS lessons (
      id                  TEXT PRIMARY KEY,
      pattern             TEXT NOT NULL,
      fix                 TEXT NOT NULL,
      status              TEXT NOT NULL,
      confidence          TEXT NOT NULL,
      occurrences         INTEGER NOT NULL,
      distinct_sessions   INTEGER NOT NULL,
      first_seen_at       TEXT NOT NULL,
      last_seen_at        TEXT NOT NULL,
      source_event_ids    TEXT NOT NULL,
      created_at          TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);

    CREATE TABLE IF NOT EXISTS rules (
      id              TEXT PRIMARY KEY,
      condition_json  TEXT NOT NULL,
      action          TEXT NOT NULL,
      priority        INTEGER NOT NULL,
      status          TEXT NOT NULL,
      rationale       TEXT NOT NULL,
      lesson_id       TEXT,
      created_at      TEXT NOT NULL,
      activated_at    TEXT,
      archived_at     TEXT,
      violation_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_rules_status ON rules(status);
    CREATE INDEX IF NOT EXISTS idx_rules_active_priority ON rules(status, priority);
  `);
}
