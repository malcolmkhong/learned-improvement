/**
 * SQLite implementation of EventStore.
 */

import type { Database, Statement } from "better-sqlite3";
import { EventSchema, type Event, type EventType, type Severity } from "../models/event.js";
import type { EventStore } from "../ports/storage.js";

interface EventRow {
  id: number;
  ts: string;
  type: string;
  severity: string;
  error_type: string | null;
  source: string;
  payload: string;
  trace_id: string | null;
}

export class SqliteEventStore implements EventStore {
  private readonly insertStmt: Statement;
  private readonly selectAllStmt: Statement<[number], EventRow>;
  private readonly selectByTypeStmt: Statement<[string, number], EventRow>;
  private readonly selectSinceStmt: Statement<[string, number], EventRow>;
  private readonly countByErrorTypeStmt: Statement<[string], { error_type: string; n: number }>;
  private readonly distinctSessionsStmt: Statement<[string, string], { ts: string }>;

  constructor(private readonly db: Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO events (ts, type, severity, error_type, source, payload, trace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.selectAllStmt = db.prepare(`SELECT * FROM events ORDER BY ts DESC LIMIT ?`);
    this.selectByTypeStmt = db.prepare(`SELECT * FROM events WHERE type = ? ORDER BY ts DESC LIMIT ?`);
    this.selectSinceStmt = db.prepare(`SELECT * FROM events WHERE ts >= ? ORDER BY ts DESC LIMIT ?`);
    this.countByErrorTypeStmt = db.prepare(`
      SELECT error_type, COUNT(*) AS n
      FROM events
      WHERE error_type IS NOT NULL AND ts >= ?
      GROUP BY error_type
    `);
    this.distinctSessionsStmt = db.prepare(`
      SELECT ts FROM events
      WHERE error_type = ? AND ts >= ?
      ORDER BY ts ASC
    `);
  }

  append(input: {
    type: EventType;
    severity: Severity;
    error_type: string | null;
    source: string;
    payload: Record<string, unknown>;
    trace_id?: string | null;
  }): Event {
    const ts = new Date().toISOString();
    const result = this.insertStmt.run(
      ts,
      input.type,
      input.severity,
      input.error_type,
      input.source,
      JSON.stringify(input.payload),
      input.trace_id ?? null,
    );
    const event: Event = EventSchema.parse({
      id: Number(result.lastInsertRowid),
      ts,
      type: input.type,
      severity: input.severity,
      error_type: input.error_type,
      source: input.source,
      payload: input.payload,
      trace_id: input.trace_id ?? null,
    });
    return event;
  }

  tail(options: { since?: string; type?: EventType; limit?: number } = {}): readonly Event[] {
    const limit = options.limit ?? 100;
    let rows: EventRow[];
    if (options.type !== undefined) {
      rows = this.selectByTypeStmt.all(options.type, limit) as EventRow[];
    } else if (options.since !== undefined) {
      rows = this.selectSinceStmt.all(options.since, limit) as EventRow[];
    } else {
      rows = this.selectAllStmt.all(limit) as EventRow[];
    }
    return rows.map((r) => this.toEvent(r));
  }

  countByErrorType(since: string): ReadonlyMap<string, number> {
    const rows = this.countByErrorTypeStmt.all(since) as { error_type: string; n: number }[];
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.error_type !== null) {
        map.set(row.error_type, row.n);
      }
    }
    return map;
  }

  distinctSessionsFor(errorType: string, since: string): number {
    const rows = this.distinctSessionsStmt.all(errorType, since) as { ts: string }[];
    // A "session" is a 30-minute gap. Count consecutive ts separated by >30min as separate sessions.
    const SESSION_GAP_MS = 30 * 60 * 1000;
    let sessions = 0;
    let lastTs = 0;
    for (const row of rows) {
      const ts = Date.parse(row.ts);
      if (Number.isNaN(ts)) continue;
      if (ts - lastTs > SESSION_GAP_MS) sessions += 1;
      lastTs = ts;
    }
    return sessions;
  }

  private toEvent(row: EventRow): Event {
    const parsed = EventSchema.safeParse({
      id: row.id,
      ts: row.ts,
      type: row.type,
      severity: row.severity,
      error_type: row.error_type,
      source: row.source,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      trace_id: row.trace_id,
    });
    if (!parsed.success) {
      throw new Error(`Corrupt event row id=${row.id}: ${parsed.error.message}`);
    }
    return parsed.data;
  }
}
