# Prompt Templates

> Ready-to-copy prompts for talking to an AI agent about
> **Continuous Improvement**. Print one of these, send it to your agent,
> and the agent will walk you through the rest.

---

## 🚀 1. First-time install prompt (paste this into your AI)

```
I want to install continuous-improvement, a self-learning engine for AI
coding agents. Please:

1. Check that Node.js 20+ is installed: `node --version`
2. Check that pnpm is installed: `pnpm --version` (install with
   `npm install -g pnpm` if missing)
3. Clone the repo:
   `git clone https://github.com/malcolmkhong/learned-improvement.git && cd learned-improvement`
4. Install deps: `pnpm install`
5. Build all packages: `pnpm -r build`
6. Link the binary globally: `cd packages/cli && npm link` (then `cd ~`)
7. Verify the install: `ci --help` should print 12 sub-commands.
8. Install the adapter for the agent I'm using (V0.2+):
   - Claude Code: `npm install -g @continuous-improvement/adapter-claudecode`
   - OpenCode:    `npm install -g @continuous-improvement/adapter-opencode`
   - Aider:       `npm install -g @continuous-improvement/adapter-aider`
   - Roo:         `npm install -g @continuous-improvement/adapter-roo`
9. Show me `ci doctor` so I can verify all 9 production-readiness checks pass.
10. Show me `ci classify modify_owned_file --path packages/core/src/x.ts`
    so I can see the Risk Classifier return tier="medium" and autoApply=true.

Do not start coding yet. Just set up the tool and report back.
```

---

## 🔄 2. "Use it" prompt (paste this once the tool is installed)

```
From now on, before you do any non-trivial task in this repo:

1. Run `ci facts show` to load the project knowledge.
2. Run `ci rules list` to see the active rules.
3. Obey the hard (block) rules; for soft (warn/suggest) rules, prefer
   the rule's suggestion but ask me if you're unsure.
4. After a tool call fails twice with the same error, log a
   `TOOL_ERROR_REPEATED` event via the adapter's emit_event().
5. After a test fails, log a `TEST_FAILED` event.
6. After I correct you, log a `USER_CORRECTION` event.
7. Never hide a failure. Honesty is the cooperation contract.

If you ignore a rule, say so and log a `RULE_OVERRIDDEN` event.

Acknowledge by running `ci rules list` and summarising what you see.
```

---

## 🛑 3. "Stop enforcing" prompt (paste this if a rule is wrong)

```
That last rule was wrong. Please:

1. Run `ci rules list` to find the rule id.
2. Run `ci rules rm <id>` to soft-delete it.
3. Run `ci lessons rm <lesson-id>` to also remove the underlying lesson
   so it does not regenerate.
4. Confirm both commands ran successfully.

If I am sure I never want this rule back, run
`ci rules rm <id> --purge` instead (hard-delete, no recovery).
```

---

## 🔍 4. "What did you learn?" prompt (paste this anytime)

```
Show me everything you've learned about this project:

1. `ci facts show` — the durable project knowledge.
2. `ci lessons list` — every lesson derived from past mistakes.
3. `ci rules list` — every active rule.
4. `ci events list --since 7d` — events from the last week.

In one short paragraph, summarise the most important patterns you've
noticed and the rules that exist because of them.
```

---

## 🧹 5. "Start over" prompt (paste this if everything is broken)

```
The continuous-improvement state is corrupt or noisy. Please:

1. `ci daemon stop`
2. `cp ~/.ci/state.db ~/.ci/state.db.bak.$(date +%Y%m%d)` (just in case)
3. `rm -rf ~/.ci/snapshots` and `rm ~/.ci/state.db`
4. `ci scan` to regenerate the project profile
5. `ci daemon start`

After the restart, the learning memory is empty. We will rebuild it
from scratch.
```

---

## 🧪 6. "Tune the learning" prompt (paste this if too noisy/quiet)

```
The learning is too aggressive (or too quiet). Please tune it:

1. `ci config show learning` — show current thresholds.
2. Based on what I tell you ("too many rules", "missing obvious ones",
   "rules appear too fast", etc.), adjust one of:
   - `learning.min_occurrences` (default 3)
   - `learning.window_hours` (default 24)
   - `learning.min_sessions` (default 2)
   - `learning.auto_promote_confidence` (default "medium")
3. Edit ~/.ci/config.toml directly and save (V0.2 will add `ci config set`).
4. `ci config show learning` again to confirm.
5. The next daemon cycle will pick up the new value automatically.
```

---

## 🔒 7. "Tighten autonomy" prompt (paste this when you want more control)

```
ci is being too aggressive. I want it to ask me more. Please:

1. `ci config show autonomy` — show current autonomy settings.
2. Tighten them:
   - Set `autonomy.allow_medium = false`  (only low-risk auto-applies)
   - Keep `autonomy.allow_high = false`
   - Keep `autonomy.allow_critical = false`
3. Edit ~/.ci/config.toml and save.
4. Confirm with `ci config show autonomy`.
5. From now on, ci will only auto-apply low-risk actions; everything
   medium and above will be queued for my review.

The reverse (loosening) is `ci autonomy set allow_medium true` — but
NEVER set `allow_critical = true` unless you fully understand the seven
hard-stop categories (financial, security, privacy, data_loss,
infrastructure, project_break, legal).
```

---

## 🤝 8. "Add another agent" prompt (paste this when you switch tools)

```
I'm switching to a different AI agent. Please:

1. List the currently installed adapters: `ci adapters list`
2. Install the new one:
   `npm install -g @continuous-improvement/adapter-<name>`
3. Confirm `ci adapters list` now shows the new adapter.
4. Tell me the exact `ci run <name> <args>` command for the new agent.
5. The state in `~/.ci/state.db` is shared across all agents — your
   lessons and rules carry over automatically.
```

---

> **Tip:** Save these prompts as snippets in your editor. Most users only
> need #1 (once), #2 (every session), and #7 (once you trust the tool).