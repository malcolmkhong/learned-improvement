/**
 * Autonomous Loop — the central coordinator.
 *
 * Observe -> Learn -> Research -> Verify -> Test -> Apply -> Monitor -> Store -> Repeat
 *
 * No human in the inner loop. The Risk Classifier decides what executes.
 * The Daily Report is the only required human surface.
 */

import type { Config } from "../config.js";
import type { LessonStore, RuleStore, EventStore, FactStore } from "../ports/storage.js";
import type { LessonEngine } from "../engines/lesson-engine.js";
import type { RuleEngine } from "../engines/rule-engine.js";
import { classify, type ActionProposal, type RiskVerdict } from "../risk/index.js";

export interface LoopReport {
  readonly cycleStartedAt: string;
  readonly cycleEndedAt: string;
  readonly proposals: readonly ProposedAction[];
  readonly applied: readonly AppliedAction[];
  readonly blocked: readonly BlockedAction[];
  readonly errors: readonly { actionId: string; message: string }[];
}

export interface ProposedAction {
  readonly proposal: ActionProposal;
  readonly verdict: RiskVerdict;
}

export interface AppliedAction {
  readonly actionId: string;
  readonly kind: ActionProposal["kind"]["type"];
  readonly appliedAt: string;
}

export interface BlockedAction {
  readonly actionId: string;
  readonly verdict: RiskVerdict;
  readonly reason: string;
}

export interface LoopDeps {
  readonly config: Config;
  readonly events: EventStore;
  readonly facts: FactStore;
  readonly lessons: LessonStore;
  readonly rules: RuleStore;
  readonly lessonEngine: LessonEngine;
  readonly ruleEngine: RuleEngine;
  /** Hook for actually performing a side-effect; returns true on success. */
  readonly apply?: (proposal: ActionProposal, verdict: RiskVerdict) => Promise<boolean>;
}

export interface LoopOptions {
  readonly now?: () => Date;
}

export class AutonomousLoop {
  constructor(
    private readonly deps: LoopDeps,
    private readonly options: LoopOptions = {},
  ) {}

  /** Run one full Observe -> Apply cycle. Returns a structured report. */
  async runCycle(): Promise<LoopReport> {
    const now = this.options.now ?? (() => new Date());
    const startedAt = now().toISOString();
    const proposals: ProposedAction[] = [];
    const applied: AppliedAction[] = [];
    const blocked: BlockedAction[] = [];
    const errors: { actionId: string; message: string }[] = [];

    // 1. OBSERVE -> LEARN: derive lessons from events.
    this.deps.lessonEngine.runCycle();

    // 2. LEARN -> RESEARCH -> VERIFY: synthesise rules from lessons.
    const rules = this.deps.ruleEngine.synthesiseRules();

    // 3. PROPOSE -> CLASSIFY: build ActionProposals for each candidate rule.
    for (const rule of rules) {
      const proposal: ActionProposal = {
        id: `proposal_${rule.id}`,
        kind: { type: "activate_rule", ruleId: rule.id },
        rationale: `Activate rule derived from lesson ${rule.lesson_id}`,
        sourceRuleId: rule.id,
        sourceLessonId: rule.lesson_id,
      };
      const verdict = classify(proposal, this.deps.config);
      proposals.push({ proposal, verdict });
    }

    // 4. APPLY or BLOCK based on the verdict.
    for (const { proposal, verdict } of proposals) {
      if (!verdict.autoApply) {
        blocked.push({ actionId: proposal.id, verdict, reason: verdict.reason });
        continue;
      }
      if (this.deps.apply !== undefined) {
        try {
          const ok = await this.deps.apply(proposal, verdict);
          if (ok) {
            applied.push({
              actionId: proposal.id,
              kind: proposal.kind.type,
              appliedAt: new Date().toISOString(),
            });
          } else {
            errors.push({ actionId: proposal.id, message: "apply() returned false" });
          }
        } catch (err) {
          errors.push({ actionId: proposal.id, message: (err as Error).message });
        }
      } else {
        // No apply hook — record as would-apply for testing.
        applied.push({
          actionId: proposal.id,
          kind: proposal.kind.type,
          appliedAt: new Date().toISOString(),
        });
      }
    }

    return {
      cycleStartedAt: startedAt,
      cycleEndedAt: now().toISOString(),
      proposals,
      applied,
      blocked,
      errors,
    };
  }
}
