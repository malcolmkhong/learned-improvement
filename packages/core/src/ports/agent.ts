/**
 * AgentAdapter port — every agent integration must satisfy this interface.
 * Core never imports adapters. Adapters implement this and are discovered
 * via package.json `ci.adapters` field.
 */

import type { EventType, Severity } from "../models/event.js";
import type { ProjectProfile } from "../models/project-profile.js";
import type { Rule } from "../models/rule.js";

export interface AgentAdapterContext {
  readonly projectProfile: ProjectProfile;
  readonly activeRules: readonly Rule[];
  readonly traceId: string | null;
}

export interface AgentAdapter {
  readonly name: string;
  readonly displayName: string;
  /** Returns true if the underlying agent is available on this machine. */
  isAvailable(): Promise<boolean>;
  /** Emits an event back to the daemon. */
  emitEvent(input: {
    type: EventType;
    severity: Severity;
    error_type: string | null;
    payload: Record<string, unknown>;
    trace_id?: string | null;
  }): Promise<void>;
  /** Builds the enriched prompt for a given base prompt. */
  enrichPrompt(base: string, context: AgentAdapterContext): Promise<string>;
  /** Runs the agent with the given enriched prompt and arguments. */
  run(args: readonly string[], context: AgentAdapterContext): Promise<number>;
}

export interface DiscoveredAdapter {
  readonly name: string;
  readonly displayName: string;
  readonly packageName: string;
  readonly instance: AgentAdapter;
}
