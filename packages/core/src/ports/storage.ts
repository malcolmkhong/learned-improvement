/**
 * Storage ports — interfaces every store must satisfy.
 * Concrete implementations live in `../stores/`.
 */

import type { Event, EventType, Severity } from "../models/event.js";
import type { Fact } from "../models/fact.js";
import type { Lesson } from "../models/lesson.js";
import type { Rule } from "../models/rule.js";

export interface EventStore {
  append(input: {
    type: EventType;
    severity: Severity;
    error_type: string | null;
    source: string;
    payload: Record<string, unknown>;
    trace_id?: string | null;
  }): Event;
  tail(options?: { since?: string; type?: EventType; limit?: number }): readonly Event[];
  countByErrorType(since: string): ReadonlyMap<string, number>;
  distinctSessionsFor(errorType: string, since: string): number;
}

export interface FactStore {
  put(input: {
    key: string;
    category: Fact["category"];
    value: Record<string, unknown>;
    source: string;
    source_url?: string | null;
    confidence: number;
  }): Fact;
  get(key: string): Fact | null;
  list(options?: { category?: Fact["category"]; limit?: number }): readonly Fact[];
}

export interface LessonStore {
  upsert(lesson: Lesson): Lesson;
  get(id: string): Lesson | null;
  list(options?: { status?: Lesson["status"]; limit?: number }): readonly Lesson[];
  updateStatus(id: string, status: Lesson["status"]): Lesson | null;
}

export interface RuleStore {
  upsert(rule: Rule): Rule;
  get(id: string): Rule | null;
  list(options?: { status?: Rule["status"]; limit?: number }): readonly Rule[];
  setStatus(id: string, status: Rule["status"], when?: string): Rule | null;
  activeRules(): readonly Rule[];
}
