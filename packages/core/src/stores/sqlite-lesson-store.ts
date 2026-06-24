/**
 * SQLite implementation of LessonStore.
 */

import type { Database, Statement } from "better-sqlite3";
import { LessonSchema, type Lesson, type LessonStatus } from "../models/lesson.js";
import type { LessonStore } from "../ports/storage.js";

interface LessonRow {
  id: string;
  pattern: string;
  fix: string;
  status: string;
  confidence: string;
  occurrences: number;
  distinct_sessions: number;
  first_seen_at: string;
  last_seen_at: string;
  source_event_ids: string;
  created_at: string;
}

export class SqliteLessonStore implements LessonStore {
  private readonly upsertStmt: Statement;
  private readonly getStmt: Statement<[string], LessonRow>;
  private readonly listAllStmt: Statement<[number], LessonRow>;
  private readonly listByStatusStmt: Statement<[string, number], LessonRow>;
  private readonly updateStatusStmt: Statement<[string, string]>;

  constructor(private readonly db: Database) {
    this.upsertStmt = db.prepare(`
      INSERT INTO lessons (id, pattern, fix, status, confidence, occurrences, distinct_sessions,
                           first_seen_at, last_seen_at, source_event_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        pattern = excluded.pattern,
        fix = excluded.fix,
        status = excluded.status,
        confidence = excluded.confidence,
        occurrences = excluded.occurrences,
        distinct_sessions = excluded.distinct_sessions,
        first_seen_at = excluded.first_seen_at,
        last_seen_at = excluded.last_seen_at,
        source_event_ids = excluded.source_event_ids
    `);
    this.getStmt = db.prepare(`SELECT * FROM lessons WHERE id = ?`);
    this.listAllStmt = db.prepare(`SELECT * FROM lessons ORDER BY created_at DESC LIMIT ?`);
    this.listByStatusStmt = db.prepare(`SELECT * FROM lessons WHERE status = ? ORDER BY created_at DESC LIMIT ?`);
    this.updateStatusStmt = db.prepare(`UPDATE lessons SET status = ? WHERE id = ?`);
  }

  upsert(lesson: Lesson): Lesson {
    this.upsertStmt.run(
      lesson.id,
      lesson.pattern,
      lesson.fix,
      lesson.status,
      lesson.confidence,
      lesson.occurrences,
      lesson.distinct_sessions,
      lesson.first_seen_at,
      lesson.last_seen_at,
      JSON.stringify(lesson.source_event_ids),
      lesson.created_at,
    );
    return lesson;
  }

  get(id: string): Lesson | null {
    const row = this.getStmt.get(id) as LessonRow | undefined;
    return row === undefined ? null : this.toLesson(row);
  }

  list(options: { status?: LessonStatus; limit?: number } = {}): readonly Lesson[] {
    const limit = options.limit ?? 1000;
    const rows = (
      options.status !== undefined
        ? (this.listByStatusStmt.all(options.status, limit) as LessonRow[])
        : (this.listAllStmt.all(limit) as LessonRow[])
    );
    return rows.map((r) => this.toLesson(r));
  }

  updateStatus(id: string, status: LessonStatus): Lesson | null {
    const existing = this.get(id);
    if (existing === null) return null;
    this.updateStatusStmt.run(status, id);
    return this.get(id);
  }

  private toLesson(row: LessonRow): Lesson {
    const parsed = LessonSchema.safeParse({
      id: row.id,
      pattern: row.pattern,
      fix: row.fix,
      status: row.status,
      confidence: row.confidence,
      occurrences: row.occurrences,
      distinct_sessions: row.distinct_sessions,
      first_seen_at: row.first_seen_at,
      last_seen_at: row.last_seen_at,
      source_event_ids: JSON.parse(row.source_event_ids) as number[],
      created_at: row.created_at,
    });
    if (!parsed.success) {
      throw new Error(`Corrupt lesson row id=${row.id}: ${parsed.error.message}`);
    }
    return parsed.data;
  }
}
