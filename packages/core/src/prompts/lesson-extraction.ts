/**
 * Outbound prompt template: lesson extraction.
 * Sent to the LLM during `ci lessons run` to group raw events into lessons.
 * See PLAN.md §17.5 for the full specification.
 */

export interface LessonExtractionEvent {
  id: string;
  ts: string;
  type: string;
  error_type: string;
  payload: Record<string, unknown>;
}

export interface LessonExtractionPromptData {
  events: LessonExtractionEvent[];
  minOccurrences: number;
}

export function renderLessonExtractionPrompt(
  data: LessonExtractionPromptData,
): string {
  const eventLines = data.events
    .map(
      (e) => `- [${e.id}] ${e.ts} type=${e.type} error_type=${e.error_type} payload=${JSON.stringify(e.payload)}`,
    )
    .join("\n");

  return `
# Lesson Extraction

You are given a list of recent **error events** from the user's coding
sessions. Your job is to group them into **lessons** — reusable
*if-this-then-that* rules the user (or future agents) should follow.

## Input events (${data.events.length} total)
${eventLines}

## Output format
Return a JSON array of lessons, each with:
{
  "pattern": "the error pattern (e.g. 'forgot to await async function')",
  "fix": "the recommended action (e.g. 'always await, or use top-level await')",
  "occurrences": <number of events that match this pattern>,
  "confidence": "low" | "medium" | "high",
  "source_event_ids": [<event ids>]
}

## Rules
- Only group events that share the **same root cause** (not just the
  same symptom).
- Only emit a lesson if \`occurrences >= ${data.minOccurrences}\` (see PLAN.md §18 for the full
  learning condition).
- Set confidence = "high" if the events span ≥ 2 different sessions.
- Do not invent fixes you have not seen in the events; if no fix is
  evident, set \`fix\` to "investigate" and confidence = "low".
`.trim();
}

/** Default empty prompt (used in tests). */
export const LESSON_EXTRACTION_PROMPT = renderLessonExtractionPrompt({
  events: [],
  minOccurrences: 3,
});
