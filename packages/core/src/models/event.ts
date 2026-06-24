/**
 * Event model — the atomic unit of observability.
 * Every action, mistake, override, and self-tracking event is an Event.
 */

import { z } from "zod";

/**
 * Canonical event types. Adding a new type is a breaking change.
 * See PLAN.md §19 for the full taxonomy.
 */
export const EVENT_TYPES = [
  "TOOL_ERROR",
  "TOOL_ERROR_REPEATED",
  "TEST_FAILED",
  "BUILD_FAILED",
  "LINT_ERROR",
  "TYPE_ERROR",
  "IMPORT_ERROR",
  "USER_CORRECTION",
  "CODE_REVERTED",
  "RULE_VIOLATED",
  "RULE_OVERRIDDEN",
  "RULE_STALE",
  "LESSON_DISPUTED",
  "LESSON_CREATED",
  "RULE_ACTIVATED",
  "RULE_DEACTIVATED",
  "RULE_REVERTED",
  "CONFIG_CHANGED",
  "OWNERSHIP_REFUSED",
  "APPROVAL_GRANTED",
  "APPROVAL_DENIED",
  "DAEMON_START",
  "DAEMON_STOP",
  "HEARTBEAT",
  "CACHE_HIT",
  "RESEARCH_FETCH",
  "KNOWLEDGE_UPDATED",
  "USER_DEFINED",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const SEVERITIES = ["debug", "info", "warn", "error"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const EventTypeSchema = z.enum(EVENT_TYPES);
export const SeveritySchema = z.enum(SEVERITIES);

export const EventPayloadSchema = z.record(z.string(), z.unknown());

export const EventSchema = z.object({
  id: z.number().int().nonnegative(),
  ts: z.string(), // ISO-8601
  type: EventTypeSchema,
  severity: SeveritySchema,
  error_type: z.string().nullable(),
  source: z.string(), // e.g. "adapter:claudecode", "daemon", "user"
  payload: EventPayloadSchema,
  trace_id: z.string().nullable(),
});

export type EventInput = z.input<typeof EventSchema>;
export type Event = z.output<typeof EventSchema>;

/** Event types that never become lessons (noise filter). */
export const EVENT_BLACKLIST: ReadonlySet<EventType> = new Set([
  "HEARTBEAT",
  "CACHE_HIT",
  "DAEMON_START",
  "DAEMON_STOP",
  "LESSON_CREATED",
  "RULE_ACTIVATED",
  "RULE_DEACTIVATED",
  "RULE_OVERRIDDEN",
  "RULE_REVERTED",
  "CONFIG_CHANGED",
  "OWNERSHIP_REFUSED",
  "APPROVAL_GRANTED",
  "APPROVAL_DENIED",
  "RULE_VIOLATED",
  "RESEARCH_FETCH",
  "KNOWLEDGE_UPDATED",
]);
