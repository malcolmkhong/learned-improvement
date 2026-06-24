/**
 * Rule model — an executable policy derived from a lesson.
 * Rules are the only output of the system that directly affects an agent's behavior.
 */

import { z } from "zod";

export const RULE_ACTIONS = ["block", "warn", "suggest", "inject"] as const;
export type RuleAction = (typeof RULE_ACTIONS)[number];

export const RULE_CHECK_TYPES = ["always", "regex", "ast", "shell"] as const;
export type RuleCheckType = (typeof RULE_CHECK_TYPES)[number];

export const RuleConditionSchema = z.object({
  type: z.enum(RULE_CHECK_TYPES),
  pattern: z.string(),
  scope: z.enum(["file", "session", "project", "global"]).default("project"),
});

export const RULE_STATUSES = ["candidate", "active", "archived", "disabled"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const RuleSchema = z.object({
  id: z.string(),
  condition: RuleConditionSchema,
  action: z.enum(RULE_ACTIONS),
  priority: z.number().int().min(1).max(10),
  status: z.enum(RULE_STATUSES),
  rationale: z.string(),
  lesson_id: z.string().nullable(),
  created_at: z.string(),
  activated_at: z.string().nullable(),
  archived_at: z.string().nullable(),
  violation_count: z.number().int().nonnegative(),
});

export type RuleInput = z.input<typeof RuleSchema>;
export type Rule = z.output<typeof RuleSchema>;
export type RuleCondition = z.output<typeof RuleConditionSchema>;
