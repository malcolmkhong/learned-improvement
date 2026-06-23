/**
 * Outbound prompt template: rule generation.
 * Sent to the LLM during `ci rules learn` to convert a Lesson into a Rule.
 * See PLAN.md §17.6 for the full specification.
 */

export interface RuleGenerationPromptData {
  pattern: string;
  fix: string;
  occurrences: number;
  confidence: "low" | "medium" | "high";
  source_event_ids: string[];
}

export function renderRuleGenerationPrompt(
  lesson: RuleGenerationPromptData,
): string {
  return `
# Rule Generation

You are given a single **Lesson** that has been promoted to candidate
status. Convert it into an **executable Rule** that can be enforced on
future agent runs.

## Input lesson
\`\`\`json
${JSON.stringify(lesson, null, 2)}
\`\`\`

## Output format
Return a single JSON object:
{
  "condition_json": {
    "type": "always" | "regex" | "ast" | "shell",
    "pattern": "<string | regex | shell command>"
  },
  "action": "block" | "warn" | "suggest",
  "priority": 1-10,
  "rationale": "one-line explanation of why this rule exists"
}

## Hard constraints
- "block" rules require a **deterministic** check (regex, AST, or shell).
  Never block on a fuzzy LLM judgement.
- "warn" and "suggest" may use softer checks but must still be
  reproducible.
- \`priority\` defaults: 8 for block, 5 for warn, 3 for suggest.
`.trim();
}

/** Default empty prompt (used in tests). */
export const RULE_GENERATION_PROMPT = renderRuleGenerationPrompt({
  pattern: "example pattern",
  fix: "example fix",
  occurrences: 3,
  confidence: "medium",
  source_event_ids: [],
});
