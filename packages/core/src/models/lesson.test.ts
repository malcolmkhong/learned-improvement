import { describe, it, expect } from "vitest";
import { LessonSchema, LESSON_STATUSES, CONFIDENCE_LEVELS } from "./lesson.js";

describe("LessonSchema", () => {
  const base = {
    id: "00000000-0000-0000-0000-000000000000",
    pattern: "forgot to await",
    fix: "always await",
    status: "accepted" as const,
    confidence: "high" as const,
    occurrences: 5,
    distinct_sessions: 2,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    source_event_ids: [1, 2, 3],
    created_at: new Date().toISOString(),
  };

  it("accepts a valid lesson", () => {
    expect(LessonSchema.safeParse(base).success).toBe(true);
  });

  it("rejects empty pattern", () => {
    expect(LessonSchema.safeParse({ ...base, pattern: "" }).success).toBe(false);
  });

  it("rejects unknown status", () => {
    expect(LessonSchema.safeParse({ ...base, status: "weird" }).success).toBe(false);
  });

  it("LESSON_STATUSES has the canonical four", () => {
    expect(LESSON_STATUSES).toEqual(["candidate", "accepted", "rejected", "disputed"]);
  });

  it("CONFIDENCE_LEVELS has the canonical three", () => {
    expect(CONFIDENCE_LEVELS).toEqual(["low", "medium", "high"]);
  });
});
