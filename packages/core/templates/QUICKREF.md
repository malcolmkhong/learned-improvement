# Continuous Improvement — Quick Reference (Decision Tree)

> Single-page cheat sheet. Read this on first run.
> Full version: see the project `docs/PLAN.md` §21.

## When **you** (the agent) should USE ci

```
┌─ before any non-trivial task ─────────────────────────────┐
│  1. Run `ci facts show` → see project knowledge           │
│  2. Run `ci rules list` → see active rules                │
│  3. Obey hard rules; suggest soft rules to the user        │
└────────────────────────────────────────────────────────────┘
```

## When **you** should REPLACE ci's output

```
┌─ user said "ignore that rule" OR "I know what I'm doing" ─┐
│  1. Do the user's request                                  │
│  2. Log RULE_OVERRIDDEN with the reason                    │
│  3. Suggest `ci rules rm <id>` for permanent removal       │
└────────────────────────────────────────────────────────────┘
```

## When **you** should LOG a mistake

```
┌─ tool call failed twice with the same error ───────────────┐
│  → emit TOOL_ERROR_REPEATED                                │
│                                                           │
┌─ test failed ──────────────────────────────────────────────┐
│  → emit TEST_FAILED                                        │
│                                                           │
┌─ lint error ──────────────────────────────────────────────┐
│  → emit LINT_ERROR                                         │
│                                                           │
┌─ user said "no, do it this way" ───────────────────────────┐
│  → emit USER_CORRECTION                                    │
│                                                           │
┌─ user deleted your code in the same turn ──────────────────┐
│  → emit CODE_REVERTED                                      │
│                                                           │
┌─ any other "this went wrong" signal ───────────────────────┐
│  → emit USER_DEFINED with a descriptive `error_type`       │
└────────────────────────────────────────────────────────────┘
```

## When the **daemon** should LEARN

```
events with same error_type ≥ min_occurrences
    AND
spread over ≥ min_sessions
    AND
occurred within window_hours
        ↓
   promote to LESSON_CANDIDATE
        ↓
   LLM (lesson-extraction prompt) groups & summarises
        ↓
   if confidence ≥ auto_promote_confidence:
        promote to RULE_CANDIDATE
            ↓
        if ask_before_activating == "always":
            surface in `ci rules pending` and wait
        else:
            auto-activate
```

## When **you** (the human) should INTERVENE

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `ci rules list` shows > 50 rules | Too aggressive learning | `ci config set learning.max_active_rules 20` |
| `ci lessons pending` is empty but you make the same mistake | `min_occurrences` too high | `ci config set learning.min_occurrences 2` |
| Daemon suggests bad rules | `auto_promote_confidence` too low | `ci config set learning.auto_promote_confidence high` |
| `ci daemon start` says "config invalid" | Typo in config | `ci config show` → `ci config reset <key>` |
| Adapter says "UnknownAgentError" | Adapter not installed | `npm install -g @continuous-improvement/adapter-<name>` |

## The single rule of thumb

> **If you are an AI agent and you are about to do something irreversible
> (write a file, run a command, change a config), ask yourself: "Did I
> log the last mistake I made?" If the answer is no, log it first.**
>
> If you are a human and the system is doing something you don't like,
> the answer is always one of: `ci rules rm`, `ci lessons rm`,
> `ci config set`, or `ci daemon stop`. You are never locked in.
