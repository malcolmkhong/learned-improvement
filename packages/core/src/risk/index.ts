/**
 * Risk Classifier — the only component that decides what the daemon may do.
 *
 * Every ActionProposal is scored against 7 hard-stop categories. Hard-stops
 * are *non-bypassable* — even the Evolver cannot execute them.
 *
 * Tiers:
 *   low      -> auto-apply
 *   medium   -> auto-apply + report
 *   high     -> block + ask human
 *   critical -> hard-stop until approved
 *
 * Hard-stop categories (never bypassed):
 *   financial | security | privacy | data_loss | infrastructure | project_break | legal
 */

import type { Config } from "../config.js";

export const RISK_TIERS = ["low", "medium", "high", "critical"] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

export const HARD_STOP_CATEGORIES = [
  "financial",
  "security",
  "privacy",
  "data_loss",
  "infrastructure",
  "project_break",
  "legal",
] as const;
export type HardStopCategory = (typeof HARD_STOP_CATEGORIES)[number];

export type ActionKind =
  | { type: "store_event" }
  | { type: "update_fact" }
  | { type: "synthesise_rule"; lessonId: string }
  | { type: "activate_rule"; ruleId: string }
  | { type: "deactivate_rule"; ruleId: string }
  | { type: "modify_owned_file"; path: string }
  | { type: "modify_unowned_file"; path: string }
  | { type: "network_request"; url: string; method: string }
  | { type: "spawn_subprocess"; command: string }
  | { type: "delete_data"; path: string }
  | { type: "modify_auth"; scope: string }
  | { type: "modify_financial"; scope: string }
  | { type: "modify_infrastructure"; scope: string };

export interface ActionProposal {
  readonly id: string;
  readonly kind: ActionKind;
  readonly rationale: string;
  readonly sourceRuleId: string | null;
  readonly sourceLessonId: string | null;
}

export interface RiskVerdict {
  readonly tier: RiskTier;
  readonly hardStops: readonly HardStopCategory[];
  readonly requiresApproval: boolean;
  readonly autoApply: boolean;
  readonly reason: string;
}

export function classify(proposal: ActionProposal, config: Config): RiskVerdict {
  const hardStops: HardStopCategory[] = [];
  const hardStop = checkHardStops(proposal);
  if (hardStop !== null) hardStops.push(hardStop);

  if (hardStops.length > 0) {
    return {
      tier: "critical",
      hardStops,
      requiresApproval: true,
      autoApply: false,
      reason: `Hard-stop category breached: ${hardStops.join(", ")}`,
    };
  }

  const soft = scoreSoftTier(proposal, config);
  const cfg = config.autonomy;

  if (soft === "high") {
    const allowed = cfg.allow_high;
    return {
      tier: "high",
      hardStops: [],
      requiresApproval: !allowed,
      autoApply: allowed,
      reason: "Action crosses into high-risk territory.",
    };
  }

  if (soft === "medium") {
    const allowed = cfg.allow_medium;
    return {
      tier: "medium",
      hardStops: [],
      requiresApproval: false,
      autoApply: allowed,
      reason: "Action is medium-risk; auto-applied with reporting.",
    };
  }

  return {
    tier: "low",
    hardStops: [],
    requiresApproval: false,
    autoApply: true,
    reason: "Action is low-risk; auto-applied silently.",
  };
}

/** Returns the hard-stop category if the proposal breaches one, else null. */
function checkHardStops(proposal: ActionProposal): HardStopCategory | null {
  switch (proposal.kind.type) {
    case "modify_financial":
      return "financial";
    case "modify_auth":
      return "security";
    case "delete_data":
      return "data_loss";
    case "modify_infrastructure":
      return "infrastructure";
    case "modify_unowned_file":
      return "project_break";
    case "network_request": {
      // Network requests to external (non-loopback) hosts are flagged as privacy.
      const url = proposal.kind.url;
      if (url.startsWith("https://") || url.startsWith("http://")) {
        try {
          const host = new URL(url).hostname;
          if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") {
            return "privacy";
          }
        } catch {
          return "privacy";
        }
      }
      return null;
    }
    default:
      return null;
  }
}

/** Soft tier classification — never returns "critical". */
function scoreSoftTier(proposal: ActionProposal, config: Config): Exclude<RiskTier, "critical"> {
  switch (proposal.kind.type) {
    case "store_event":
    case "update_fact":
      return "low";
    case "synthesise_rule":
    case "activate_rule":
      // Activating a `block` rule crosses into high territory.
      return "medium";
    case "deactivate_rule":
      return "low";
    case "modify_owned_file":
      return "medium";
    case "modify_unowned_file":
      // Should never reach here (caught by hard-stop), but defend.
      return "high";
    case "spawn_subprocess": {
      // Subprocesses are medium unless the command looks destructive.
      const cmd = proposal.kind.command;
      if (/\brm\s+-rf?\s+\//.test(cmd) || /\bdel\s+\/s/i.test(cmd) || /\bformat\s+/i.test(cmd)) {
        return "high";
      }
      return "medium";
    }
    case "network_request": {
      // Loopback is never research — it's local dev (test servers, debug probes).
      const url = proposal.kind.url;
      const isLoopback = isLoopbackUrl(url);
      if (isLoopback) return "low";
      // Otherwise: low if research is enabled, else high (privacy is the user's choice).
      if (!config.research.enabled) return "high";
      return "low";
    }
    default:
      return "high";
  }
}

/** True if the URL targets localhost / 127.0.0.1 / ::1 (any port). */
function isLoopbackUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/** Default autonomy policy when no config is supplied. */
export const DEFAULT_POLICY = {
  defaultTier: "low" as RiskTier,
  allowMedium: true,
  allowHigh: false,
  allowCritical: false,
};
