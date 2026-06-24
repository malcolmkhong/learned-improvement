/**
 * LessonEngine — observes events and derives Lessons.
 *
 * The promotion state machine:
 *   event --(occurrences >= min_occurrences IN window)--> candidate
 *   candidate --(distinct_sessions >= min_sessions)--> accepted lesson
 *
 * Lessons are *candidates* until they pass both gates; we don't block the
 * loop waiting for an LLM call — the summarisation step (LLM) is an
 * extension point in `proposeLessonSummary()`.
 */

import { randomUUID } from "node:crypto";
import type { LessonStore, EventStore } from "../ports/storage.js";
import { LessonSchema, type Lesson, type ConfidenceLevel } from "../models/lesson.js";
import type { Config } from "../config.js";

export interface LessonEngineOptions {
  readonly now?: () => Date;
}

export class LessonEngine {
  constructor(
    private readonly lessons: LessonStore,
    private readonly events: EventStore,
    private readonly config: Config,
    private readonly options: LessonEngineOptions = {},
  ) {}

  /** Run one cycle: scan events, derive lessons, return the lessons created/updated. */
  runCycle(): readonly Lesson[] {
    const now = this.options.now ?? (() => new Date());
    const windowMs = this.config.learning.window_hours * 60 * 60 * 1000;
    const since = new Date(now().getTime() - windowMs).toISOString();
    const counts = this.events.countByErrorType(since);
    const out: Lesson[] = [];

    for (const [errorType, occurrences] of counts) {
      if (occurrences < this.config.learning.min_occurrences) continue;

      const sessions = this.events.distinctSessionsFor(errorType, since);
      const status: Lesson["status"] =
        sessions >= this.config.learning.min_sessions ? "accepted" : "candidate";

      const existing = this.lessons.list({ limit: 10000 }).find((l) => l.pattern === errorType);
      const ids = this.events.tail({ since, limit: 1000 }).filter((e) => e.error_type === errorType).map((e) => e.id);

      const created_at = existing?.created_at ?? now().toISOString();
      const first_seen_at = existing?.first_seen_at ?? ids.length > 0 ? (this.events.tail({ since, limit: 1 }).find((e) => e.error_type === errorType)?.ts ?? created_at) : created_at;
      const last_seen_at = ids.length > 0 ? (this.events.tail({ since, limit: 1000 }).find((e) => e.error_type === errorType)?.ts ?? created_at) : created_at;

      const confidence: ConfidenceLevel = inferConfidence(sessions, occurrences);

      const lesson: Lesson = LessonSchema.parse({
        id: existing?.id ?? randomUUID(),
        pattern: errorType,
        fix: existing?.fix ?? `See lesson ${errorType}`,
        status,
        confidence,
        occurrences,
        distinct_sessions: sessions,
        first_seen_at,
        last_seen_at,
        source_event_ids: ids,
        created_at,
      });
      this.lessons.upsert(lesson);
      out.push(lesson);
    }

    return out;
  }
}

function inferConfidence(sessions: number, occurrences: number): ConfidenceLevel {
  if (sessions >= 5 && occurrences >= 10) return "high";
  if (sessions >= 2 && occurrences >= 3) return "medium";
  return "low";
}
