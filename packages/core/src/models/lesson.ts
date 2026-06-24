/**
 * Lesson model — a reusable if-then derived from events.
 */

import { z } from "zod";

export const LESSON_STATUSES = ["candidate", "accepted", "rejected", "disputed"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const LessonSchema = z.object({
  id: z.string(), // uuid
  pattern: z.string().min(1),
  fix: z.string().min(1),
  status: z.enum(LESSON_STATUSES),
  confidence: z.enum(CONFIDENCE_LEVELS),
  occurrences: z.number().int().nonnegative(),
  distinct_sessions: z.number().int().nonnegative(),
  first_seen_at: z.string(),
  last_seen_at: z.string(),
  source_event_ids: z.array(z.number().int().nonnegative()),
  created_at: z.string(),
});

export type LessonInput = z.input<typeof LessonSchema>;
export type Lesson = z.output<typeof LessonSchema>;
