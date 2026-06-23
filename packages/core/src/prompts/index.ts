/**
 * Prompt templates barrel.
 * Re-exports the four required prompt templates from PLAN.md §17.
 * Adapter authors should import from `continuous-improvement-core/prompts`
 * (subpath export) for tree-shaking.
 */

export {
  renderProjectProfilePrompt,
  PROJECT_PROFILE_PROMPT,
  type ProjectProfilePromptData,
} from "./project-profile.js";

export {
  renderRulesPrompt,
  RULES_PROMPT,
  type RulePromptData,
} from "./rules.js";

export {
  renderLessonExtractionPrompt,
  LESSON_EXTRACTION_PROMPT,
  type LessonExtractionEvent,
  type LessonExtractionPromptData,
} from "./lesson-extraction.js";

export {
  renderRuleGenerationPrompt,
  RULE_GENERATION_PROMPT,
  type RuleGenerationPromptData,
} from "./rule-generation.js";
