/**
 * Stub adapter — a minimal AgentAdapter used for testing.
 * Records every event it receives; never runs an actual agent.
 */

import type { AgentAdapter } from "continuous-improvement-core";

export interface StubAdapterOptions {
  readonly name?: string;
  readonly displayName?: string;
  readonly available?: boolean;
}

export function createStubAdapter(options: StubAdapterOptions = {}): AgentAdapter {
  const name = options.name ?? "stub";
  const displayName = options.displayName ?? "Stub Agent";
  const available = options.available ?? true;
  const recorded: Array<{ ts: string; type: string; payload: unknown }> = [];

  return {
    name,
    displayName,
    isAvailable: async () => available,
    emitEvent: async (input) => {
      recorded.push({ ts: new Date().toISOString(), type: input.type, payload: input.payload });
    },
    enrichPrompt: async (base, context) => {
      const lines = [base, "", "## Active Rules", ""];
      for (const r of context.activeRules) {
        lines.push(`- [${r.action}] ${r.rationale}`);
      }
      return lines.join("\n");
    },
    run: async () => {
      return 0;
    },
  };
}

export default createStubAdapter;
