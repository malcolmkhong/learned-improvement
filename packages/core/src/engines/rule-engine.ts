/**
 * RuleEngine — converts accepted Lessons into executable Rules.
 *
 * Lessons are the *what*; rules are the *how*. The rule condition is a
 * heuristic — for V1 we generate a `regex` check on the error_type, with
 * a `block` action for high-confidence lessons. This is intentionally
 * conservative; more sophisticated AST/shell checks are an extension point.
 */

import { randomUUID } from "node:crypto";
import type { Lesson, ConfidenceLevel } from "../models/lesson.js";
import type { Rule, RuleAction, RuleCondition } from "../models/rule.js";
import type { LessonStore, RuleStore } from "../ports/storage.js";
import type { Config } from "../config.js";

export class RuleEngine {
  constructor(
    private readonly lessons: LessonStore,
    private readonly rules: RuleStore,
    private readonly config: Config,
  ) {}

  /**
   * Synthesise rules from accepted lessons whose confidence meets the
   * auto-promotion threshold.
   */
  synthesiseRules(): readonly Rule[] {
    const accepted = this.lessons.list({ status: "accepted", limit: 10000 });
    const threshold = this.config.learning.auto_promote_confidence;
    const out: Rule[] = [];

    for (const lesson of accepted) {
      if (!meetsConfidence(lesson.confidence, threshold)) continue;

      const existing = this.rules.list({ limit: 10000 }).find((r) => r.lesson_id === lesson.id);
      if (existing !== undefined && existing.status !== "candidate") continue;

      const condition: RuleCondition = synthesiseCondition(lesson);
      const action = chooseAction(lesson.confidence);
      const rationale = `Auto-derived from lesson ${lesson.id} (${lesson.occurrences} occurrences, ${lesson.distinct_sessions} sessions, confidence ${lesson.confidence}).`;

      const rule: Rule = {
        id: existing?.id ?? randomUUID(),
        condition,
        action,
        priority: priorityFor(action),
        status: "candidate",
        rationale,
        lesson_id: lesson.id,
        created_at: existing?.created_at ?? new Date().toISOString(),
        activated_at: null,
        archived_at: null,
        violation_count: existing?.violation_count ?? 0,
      };
      this.rules.upsert(rule);
      out.push(rule);
    }

    return out;
  }
}

function meetsConfidence(actual: ConfidenceLevel, threshold: ConfidenceLevel): boolean {
  const rank: Record<ConfidenceLevel, number> = { low: 1, medium: 2, high: 3 };
  return rank[actual] >= rank[threshold];
}

function synthesiseCondition(lesson: Lesson): RuleCondition {
  // V1: regex on error_type (escaped). Future: AST or shell.
  const escaped = lesson.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { type: "regex", pattern: escaped, scope: "project" };
}

function chooseAction(confidence: ConfidenceLevel): RuleAction {
  if (confidence === "high") return "block";
  if (confidence === "medium") return "warn";
  return "suggest";
}

function priorityFor(action: RuleAction): number {
  if (action === "block") return 8;
  if (action === "warn") return 5;
  if (action === "suggest") return 3;
  return 6; // inject
}
