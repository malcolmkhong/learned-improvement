/**
 * Fact model — durable knowledge about a project or about the world.
 * Facts come from the scanner (project facts) or from research (world facts).
 */

import { z } from "zod";

export const FACT_CATEGORIES = ["project", "convention", "dependency", "world", "decision"] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];

export const FactSchema = z.object({
  id: z.number().int().nonnegative(),
  key: z.string().min(1),
  category: z.enum(FACT_CATEGORIES),
  value: z.record(z.string(), z.unknown()),
  source: z.string(), // e.g. "scanner", "research:npm", "user"
  source_url: z.string().nullable(),
  fetched_at: z.string(), // ISO-8601
  verified_at: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type FactInput = z.input<typeof FactSchema>;
export type Fact = z.output<typeof FactSchema>;
