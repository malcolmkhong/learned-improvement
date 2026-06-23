# Continuous Improvement — Agent Guide

> You are cooperating with a background daemon called `ci`. It captures
> your work, learns from your mistakes, and enforces rules on future
> runs. This file is the contract.
> **Read it before acting on any non-trivial task.**

## When to use ci

1. **Before planning** a multi-step change: run `ci facts show` to see
   the project's stored knowledge.
2. **Before generating code**: read the active rules via `ci rules
   list` (or rely on your adapter to inject them automatically).
3. **After a tool call fails**: do not silently retry — log an event
   via the adapter's `emit_event(event_type="TOOL_ERROR", payload=...)`.
4. **After a user correction**: log `event_type="USER_CORRECTION"`.
5. **Before finishing a turn**: if you produced code, run `ci events
   log` so the daemon can see what you did.

## When to replace ci's output

- The user **explicitly** says "ignore ci" or "I know what I'm doing".
  Log a `RULE_OVERRIDDEN` event.
- The user provides a project-specific reason that contradicts a
  learned rule. **Do not** silently change the rule; instead emit a
  `LESSON_DISPUTED` event and ask the user to run `ci lessons rm`.
- The rule is **stale** (refers to a file or pattern that no longer
  exists). Emit a `RULE_STALE` event.

## When to log a mistake

| Trigger | Event type | Payload |
|---------|------------|---------|
| Tool call failed twice with the same error | `TOOL_ERROR_REPEATED` | `{tool, error, args_hash}` |
| Test failed | `TEST_FAILED` | `{test_name, stack_hash}` |
| Lint error | `LINT_ERROR` | `{rule, file, line}` |
| User said "no, do it this way" | `USER_CORRECTION` | `{original, corrected}` |
| You produced code that the user deleted within the same turn | `CODE_REVERTED` | `{file, lines_deleted}` |
| Same `error_type` appeared 3+ times in 24h | auto-promoted to `LESSON_CANDIDATE` | (daemon) |

## When to learn from a mistake

The daemon **automatically** promotes events to lessons when the
**Learning Conditions** in `~/.ci/config.toml` are met. The default
conditions are documented in the project plan §18. You do **not** need
to do anything special — just log the event.

## The cooperation contract

1. **Honesty**: never hide a failure to avoid logging it.
2. **Transparency**: if you ignore a rule, say so and log it.
3. **Helpfulness**: when in doubt, ask the user — do not guess.
4. **Reversibility**: any rule can be removed with `ci rules rm <id>`.
5. **Bounded authority**: you may **suggest** but never **enforce**
   changes to the user's project outside of an explicit request.

## For more detail

* `~/.ci/QUICKREF.md` — the one-page decision tree
* `ci facts show` — the project knowledge base
* `ci rules list` — all active rules
* `ci config show learning` — current learning thresholds
