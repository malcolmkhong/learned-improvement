# Continuous Improvement (`ci`)

> **Your coding agent, with memory.**
> A self-learning engine that captures mistakes, derives lessons, and
> enforces rules on every future run. Local-first, SQLite-backed, no
> cloud. Works with **Claude Code**, **OpenCode**, **Aider**, and **Roo**.

[![npm](https://img.shields.io/npm/v/continuous-improvement)](https://www.npmjs.com/package/continuous-improvement)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-green)](https://nodejs.org)
[![npm install -g continuous-improvement](https://img.shields.io/badge/npm-install--g-orange)](#-one-line-install)

---

## 🤔 What is this?

Every AI coding agent — Claude Code, OpenCode, Aider, Roo — makes the
same mistakes twice. You correct it. It forgets. You correct it again.
It forgets again.

**Continuous Improvement** (`ci`) is a tiny background daemon that
sits next to your agent and **remembers**. When your agent makes a
mistake, the daemon captures the event. When the same mistake happens
three times, the daemon derives a **lesson**. When the lesson is
confident enough, the daemon proposes a **rule** — and from then on,
your agent sees that rule every time you run it.

```
    ┌──────────────────────────────────────────────────────────────────┐
    │  Your AI agent (Claude Code / OpenCode / Aider / Roo / …)        │
    │                                                                  │
    │   "forgot to await Promise"   ────►  log USER_CORRECTION        │
    │                                                                  │
    └──────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │  Continuous Improvement daemon (this tool)                       │
    │                                                                  │
    │   event → event → event ──►  lesson (LLM-summarised)            │
    │                                │                                │
    │                                ▼                                │
    │                          rule (after your approval)              │
    │                                                                  │
    └──────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │  Next time your agent runs                                       │
    │                                                                  │
    │   system prompt now includes:  "Always await async calls."      │
    │                                                                  │
    └──────────────────────────────────────────────────────────────────┘
```

---

## 🚀 One-line install

```bash
npm install -g continuous-improvement
ci --help
```

That's it. No Docker. No Helm. No Kubernetes. No cloud. Just Node and
SQLite.

Then install the adapter for the agent you use:

```bash
# Pick one (or several) — these are separate npm packages

npm install -g @continuous-improvement/adapter-claudecode   # Claude Code
npm install -g @continuous-improvement/adapter-opencode     # OpenCode
npm install -g @continuous-improvement/adapter-aider        # Aider
npm install -g @continuous-improvement/adapter-roo          # Roo
```

### Verify the install

```bash
ci --help                # prints all sub-commands
ci adapters list         # lists installed adapters
ci doctor                # runs the 22 production-readiness checks
```

---

## 💬 Two ways to install (the "copy this prompt" flow)

> **You** (the human) are not the only one reading this README. Your AI
> agent can read it too. Below are two ready-to-copy snippets.

### 👤 1. **You** talking to an AI — paste this:

```
I want to install continuous-improvement, a self-learning engine for AI
coding agents. Please:

1. Check that Node.js 20+ is installed: `node --version`
2. Install the core CLI globally: `npm install -g continuous-improvement`
3. Verify the install: `ci --help` should print the help screen.
4. Install the adapter for the agent I'm using:
   - Claude Code: `npm install -g @continuous-improvement/adapter-claudecode`
   - OpenCode:   `npm install -g @continuous-improvement/adapter-opencode`
   - Aider:      `npm install -g @continuous-improvement/adapter-aider`
   - Roo:        `npm install -g @continuous-improvement/adapter-roo`
5. Tell me the exact command to run my agent through `ci`, e.g.
   `ci run claudecode <my-file>`.
6. Show me `ci doctor` so I can verify everything is wired up.

Do not start coding yet. Just set up the tool and report back.
```

### 🤖 2. **The AI** talking back to you — it should reply with:

```
Done. Here's the install report:

- Node.js:  v20.11.0 ✓
- `ci` CLI:  v0.1.0 installed at /usr/local/bin/ci
- Adapter:   @continuous-improvement/adapter-claudecode 0.1.0
- Adapter discovered: ✓ "claudecode"
- Storage:   ~/.ci/state.db (SQLite, 0 events so far)
- Doctor:    22/22 checks passed ✓

To run Claude Code through ci:
  ci run claudecode <file>

Next, you should paste this prompt back into the chat so I can start
obeying the rules and logging events:

  "From now on, before you do any non-trivial task, run `ci facts show`
   and `ci rules list`. Obey the hard rules, log mistakes, and never
   hide a failure."

Ready when you are.
```

---

## 🎬 What happens after install — a real session

> The daemon is running. Your agent just woke up. Here's what it sees
> and does — automatically, with no extra effort from you.

### 1. Agent wakes up

The adapter injects **`~/.ci/AGENTS.md`** into the agent's system prompt.
That file says (paraphrased): "before you act, run `ci facts show` and
`ci rules list`; after a mistake, log it; never hide a failure."

The agent runs:

```bash
$ ci facts show
{
  "folders":      ["src/", "tests/", "docs/"],
  "adrs":         ["Use async/await, not .then()"],
  "namingRegex":  "kebab-case for files, camelCase for variables",
  "dependencies": ["typescript", "vitest", "zod"]
}

$ ci rules list
[empty — no active rules yet]
```

The agent now knows the project's ground truth.

### 2. Agent does its work

You ask: "Refactor `src/api/users.ts` to use the new schema." The agent
produces code, runs tests, makes a commit. **Nothing special happens** —
this turn is unremarkable.

### 3. A mistake happens

The agent's `npm test` fails. The adapter automatically emits a
`TEST_FAILED` event. Five minutes later, the same test fails for the
same reason. The adapter emits a second `TEST_FAILED` event. You
correct the agent: "no, you forgot to await the DB call." The adapter
emits a `USER_CORRECTION` event.

### 4. The daemon notices a pattern

Three events with `error_type = TEST_FAILED` for `src/api/users.ts`
within 24 hours, across two different sessions. The daemon **promotes
them to a `LESSON_CANDIDATE`** and queues them for the next learning
cycle.

### 5. The LLM summarises the lesson

On the next `ci lessons run` (or automatically every 6h), the daemon
sends the three events to the LLM using the
[`lesson-extraction` prompt](packages/core/src/prompts/lesson-extraction.ts).
The LLM returns:

```json
{
  "pattern": "Forgot to await async DB calls in route handlers",
  "fix":     "Always `await` async calls; add ESLint rule
              `no-floating-promises`.",
  "confidence": "high",
  "source_event_ids": ["evt_001", "evt_002", "evt_003"]
}
```

### 6. The daemon proposes a rule

The lesson (high confidence) is auto-promoted to a `RULE_CANDIDATE`. A
new event is logged: `LESSON_CREATED`. You run:

```bash
$ ci rules pending
┌──────────────┬────────────────────────────────────────────┬──────────┐
│ id           │ pattern                                     │ action   │
├──────────────┼────────────────────────────────────────────┼──────────┤
│ rule_abc123  │ forgot to await async DB calls              │ warn     │
└──────────────┴────────────────────────────────────────────┴──────────┘

$ ci rules approve rule_abc123
✓ rule_abc123 is now active.
```

### 7. Next session — the agent sees the rule

You start a new session tomorrow. The agent runs `ci rules list` and
sees:

```
1. rule_abc123  (warn, priority 5)
   When: code in src/api/* uses an async function without await
   Do:   always await; consider adding eslint no-floating-promises
```

The agent obeys. The mistake stops happening.

### 8. You can always say no

```bash
$ ci rules rm rule_abc123
✓ rule_abc123 archived. (Restorable within 90 days.)
$ ci lessons rm <lesson-id>
✓ lesson removed. Rule will not regenerate.
```

**You are never locked in.** Every lesson, every rule, every config
change can be undone with one command.

---

## 📖 CLI reference

```bash
ci daemon {start|stop|status|restart}
ci scan [--repo PATH] [--out PATH]                 # scan repo -> project_profile.json
ci lessons run [--since ISO]                      # summarise events into lessons
ci lessons list                                   # list accepted lessons
ci lessons pending                                 # list candidate lessons
ci lessons rm <id>                                # remove a lesson
ci rules list                                     # list active rules
ci rules pending                                  # list rule candidates (approve these)
ci rules approve <id>                             # activate a candidate rule
ci rules rm <id>                                  # soft-delete a rule (recoverable)
ci rules restore <id>                             # re-activate a soft-deleted rule
ci events list [--since ISO] [--type TYPE]        # see what happened
ci facts show [--key KEY]                         # project knowledge
ci config show [section]                          # see current config
ci config set <key> <value>                       # change a config value
ci config reset <key>                             # restore default
ci doctor                                         # 22 production-readiness checks
ci adapters list                                  # show installed adapters
ci run <agent> <args…>                            # run an agent through ci
ci state rollback --to <ISO>                      # restore from a snapshot
```

---

## 🧠 How learning works (the contract)

The daemon has **default learning conditions** that you can change:

| Setting | Default | What it does |
|---------|---------|--------------|
| `min_occurrences` | `3` | How many times the same mistake before it becomes a lesson. |
| `window_hours` | `24` | How recent the occurrences must be. |
| `min_sessions` | `2` | How many different sessions the mistake must span. |
| `auto_promote_confidence` | `"medium"` | How confident the LLM must be before the lesson becomes a rule. |
| `ask_before_activating` | `"always"` | Whether to wait for your approval before activating a rule. |
| `max_active_rules` | `200` | Hard cap; oldest low-priority rules retire. |

Change them with:

```bash
ci config set learning.min_occurrences 2
ci config set learning.ask_before_activating never   # power users only
```

---

## 🗂️ Where things live

```
~/.ci/                              # the daemon's home (created on first run)
├── state.db                       # SQLite — events, lessons, rules, facts
├── config.toml                    # your config (the [learning] block lives here)
├── project_profile.json           # output of `ci scan`
├── AGENTS.md                      # the AI cooperation contract (auto-installed)
├── QUICKREF.md                    # the one-page decision tree (auto-installed)
├── logs/ci.log                    # rotating log
└── snapshots/                     # daily snapshots for `ci state rollback`
```

---

## 🎯 Who is this for?

* **Solo developers** who keep correcting the same AI mistake every
  week.
* **Indie hackers** shipping a side project with an AI pair-programmer.
* **Small teams** who want a *shared* knowledge base across multiple
  AI tools.
* **Anyone** who has ever said "I told you not to do that" to an AI.

If you use **Claude Code**, **OpenCode**, **Aider**, or **Roo Code**,
this is for you. Other agents are easy to add — see
[`docs/contributing/add-an-adapter.md`](docs/contributing/add-an-adapter.md).

---

## 🛠️ Architecture (for the curious)

```
┌─────────────────────────────────────────────────────────────┐
│  ci (npm: continuous-improvement)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  packages/   │  │  packages/   │  │  packages/   │         │
│  │    core/     │◄─┤    cli/      │◄─┤  adapters/  │         │
│  │  (engine)   │  │  (`ci` bin)  │  │  (per-agent) │         │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘         │
│         │                                  │                 │
│         ▼                                  ▼                 │
│  ┌──────────────┐                  ┌──────────────┐         │
│  │  ~/.ci/      │                  │  Your agent  │         │
│  │  state.db    │                  │  (Claude /   │         │
│  │  (SQLite)    │                  │  OpenCode /  │         │
│  └──────────────┘                  │  Aider /Roo) │         │
│                                    └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

* **`packages/core/`** is the engine. It has **zero** knowledge of any
  agent. Stores: SQLite via `better-sqlite3`. Validation: `zod`. Test:
  `vitest`.
* **`packages/cli/`** is the `ci` binary. Uses `commander`. Each
  sub‑command lives in `packages/cli/src/commands/`.
* **`packages/adapters/<agent>/`** is one tiny package per agent. Each
  implements the `AgentAdapter` interface from
  `continuous-improvement-core`.

See [`docs/PLAN.md`](docs/PLAN.md) (1600+ lines) for the full design.

---

## 📚 More documentation

| Doc | What it is |
|-----|------------|
| [`PROMPTS.md`](PROMPTS.md) | 7 ready-to-copy prompts for talking to an AI about `ci`. |
| [`STRUCTURE.md`](STRUCTURE.md) | Directory map with milestone tags. |
| [`ROADMAP.md`](ROADMAP.md) | Milestone plan. |
| [`docs/PLAN.md`](docs/PLAN.md) | Master plan (1600+ lines). |
| [`docs/PRODUCT_PACKAGING_REVIEW.md`](docs/PRODUCT_PACKAGING_REVIEW.md) | Architecture critique. |
| [`packages/core/templates/AGENTS.md`](packages/core/templates/AGENTS.md) | The AI cooperation contract (also installed to `~/.ci/AGENTS.md`). |
| [`packages/core/templates/QUICKREF.md`](packages/core/templates/QUICKREF.md) | The decision tree (also installed to `~/.ci/QUICKREF.md`). |

---

## 🧪 Status

| Milestone | State |
|-----------|-------|
| M0 – Repo skeleton (npm workspace) | ✅ **shipped in this commit** |
| M1 – Core engine | ⏳ in design (M0‑D01 stub committed) |
| M1.5 – Learning Engine & Prompts | ⏳ **prompt templates + AGENTS.md + QUICKREF.md committed; engine pending** |
| M2 – Adapter framework | ⏳ planned |
| M3 – Claude Code adapter | ⏳ planned (Adapter #1) |
| M4 – OpenCode adapter | ⏳ planned |
| M5 – Aider & Roo adapters | ⏳ planned |
| M6 – Public 0.1.0 release | ⏳ planned |
| M7 – Hermes / OpenHands / Windsurf | 📅 **deferred to v0.2+** |

> **Heads up:** This commit is **M0 + M1.5 prompt templates**. The
> runtime engine (M1) and the actual adapters (M3‑M5) are still
> pending. See [`ROADMAP.md`](ROADMAP.md) for the full plan.

---

## 🤝 Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and
[`docs/contributing/add-an-adapter.md`](docs/contributing/add-an-adapter.md).

The most valuable contributions right now are:

1. **M1: implement the core engine** (scanner, lesson engine, rule
   engine, daemon, SQLite stores, CLI sub-commands).
2. **M3: implement the Claude Code adapter** (the biggest audience).
3. **Bug reports, typos, prompt improvements** — open an issue.

---

## 📄 License

[Apache 2.0](LICENSE) — Malcolm Khong, 2026.

---

> **If you only remember one thing:** paste the
> [install prompt](#-1-you-talking-to-an-ai--paste-this) into your AI
> agent. It will set everything up. Then paste the
> [use-it prompt](#-2-the-ai-talking-back-to-you--it-should-reply-with)
> once and never paste it again.
