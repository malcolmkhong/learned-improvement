# Continuous Improvement (`ci`)

> **Your coding agent, with memory and self-discipline.**
> A risk-graded autonomous engine that captures mistakes, derives lessons,
> enforces rules, and refrains from anything dangerous — without you
> babysitting every step. Local-first, SQLite-backed, no cloud.

[![npm](https://img.shields.io/npm/v/continuous-improvement)](https://www.npmjs.com/package/continuous-improvement)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-green)](https://nodejs.org)
[![Status](https://img.shields.io/badge/status-V0.1.0--core--shipped-blueviolet)](#-current-status)
[![Tests](https://img.shields.io/badge/tests-42%2F42%20passing-brightgreen)](tests/)

---

## 🤔 What is this?

Every AI coding agent makes the same mistakes twice. You correct it. It forgets. You correct it again. It forgets again.

**Continuous Improvement** (`ci`) is a small autonomous engine that sits next to your agent and **remembers** — and, unlike a passive log, it has the discipline to know when to act on its own and when to stop and ask.

```
    ┌──────────────────────────────────────────────────────────────────┐
    │  Your AI agent (Claude Code / OpenCode / Aider / Roo / …)        │
    │                                                                  │
    │   "forgot to await Promise"   ────►  log TEST_FAILED              │
    │                                                                  │
    └──────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │  ci — autonomous engine (v0.1.0)                                 │
    │                                                                  │
    │   Observe ─► Learn ─► Verify ─► Test ─► Apply ─► Monitor ─► Store │
    │                                                                  │
    │   Every action is scored by the Risk Classifier:                 │
    │     Low      → auto-apply                                        │
    │     Medium   → auto-apply + report                               │
    │     High     → block + ask human                                 │
    │     Critical → hard-stop until approved                          │
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

## 🧠 The four risk tiers

This is the heart of the system. **Every** action the daemon considers is scored:

| Tier | Examples | What ci does |
|------|----------|--------------|
| **Low** | store event, update fact, optimise workflow | **Auto-apply silently** |
| **Medium** | modify owned code, install dep, change prompt template | **Auto-apply + add to daily report** |
| **High** | modify ownership boundary, change safety config | **Block + ask human** |
| **Critical** | spend money, touch auth/security, delete data, modify non-owned code | **Hard-stop until approved** |

Seven categories are **never** bypassed, even during self-improvement:

```
financial | security | privacy | data_loss | infrastructure | project_break | legal
```

---

## 🚀 One-line install

```bash
npm install -g continuous-improvement
ci --help
```

Adapters are **separate** packages — install only what you need:

```bash
npm install -g @continuous-improvement/adapter-claudecode   # Claude Code
npm install -g @continuous-improvement/adapter-opencode     # OpenCode
npm install -g @continuous-improvement/adapter-aider        # Aider
npm install -g @continuous-improvement/adapter-roo          # Roo
```

> The npm publish step is the last item on the V0.1.0 checklist. Until
> then, install from source:
>
> ```bash
> git clone https://github.com/malcolmkhong/learned-improvement.git
> cd learned-improvement
> pnpm install
> pnpm -r build
> node packages/cli/dist/bin/ci.js install
> ```

---

## 💬 Two ways to install (the "copy this prompt" flow)

### 👤 You, talking to an AI — paste this:

```
I want to install continuous-improvement, a self-learning engine for AI
coding agents. Please:

1. Check that Node.js 20+ is installed: `node --version`
2. Clone the repo: `git clone https://github.com/malcolmkhong/learned-improvement.git && cd learned-improvement`
3. Install deps: `pnpm install`
4. Build: `pnpm -r build`
5. Install the binary globally: `npm link packages/cli` (or `pnpm link --global`)
6. Verify: `ci --help` should print all 12 sub-commands.
7. Install the adapter for the agent I'm using:
   - Claude Code: `npm install -g @continuous-improvement/adapter-claudecode`
   - OpenCode:    `npm install -g @continuous-improvement/adapter-opencode`
   - Aider:       `npm install -g @continuous-improvement/adapter-aider`
   - Roo:         `npm install -g @continuous-improvement/adapter-roo`
8. Run `ci doctor` and show me the 9-check report.
9. Run `ci classify modify_owned_file --path packages/core/src/x.ts` so I
   can see the Risk Classifier return "medium" and "auto-apply: true".

Do not start coding yet. Just set up the tool and report back.
```

### 🤖 The AI's expected reply:

```
Done. Here's the install report:

- Node.js: v22.22.3 ✓
- Repo cloned and pnpm install succeeded (196 packages)
- pnpm -r build: all 3 packages compiled
- `ci` linked globally at /usr/local/bin/ci
- 12 sub-commands available: scan, daemon, lessons, rules, events, facts,
  doctor, config, classify, state, report, install
- Doctor: 9/9 checks passed ✓
- Classify demo: { tier: "medium", autoApply: true, hardStops: [] }

To run a cycle:        ci daemon run-once
To see the daily report: ci report daily
To inspect the state:   ci facts show
To install agent templates: ci install

Ready when you are.
```

---

## 🎬 What happens after install — a real session

> The daemon is running. Your agent just woke up. Here's what it sees
> and does — automatically, with no extra effort from you.

### 1. Agent wakes up

The adapter injects `~/.ci/AGENTS.md` into the agent's system prompt:

```
Read ~/.ci/AGENTS.md before acting.
```

That file says: "before planning, run `ci facts show` and `ci rules list`; after a tool call fails, log it; never hide a failure."

### 2. Agent does its work

You ask: "Refactor `src/api/users.ts` to use the new schema." The agent produces code, runs tests, commits.

### 3. A mistake happens

`npm test` fails. The adapter emits:

```json
{
  "type": "TEST_FAILED",
  "severity": "warn",
  "error_type": "TEST_FAILED: forgot to await async DB call",
  "source": "adapter-claudecode"
}
```

Five minutes later, the same test fails for the same reason. Second `TEST_FAILED`. You correct the agent: "no, you forgot to await the DB call." Third event: `USER_CORRECTION`.

### 4. The daemon notices a pattern

Three events with `error_type = TEST_FAILED: forgot to await async DB call` within 24 hours. The daemon promotes them to a `LESSON_CANDIDATE`.

### 5. The Risk Classifier decides what to do

The proposed action is: "activate a rule derived from this lesson." That's `medium` tier → **auto-apply + add to daily report**.

### 6. Next session — the agent sees the rule

```
$ ci rules list
1. rule_abc123  (warn, priority 5)
   When: code in src/api/* uses async without await
   Do:   always await; consider adding eslint no-floating-promises

$ ci report daily
[2026-06-24] Applied 1 rule (medium, auto): rule_abc123
            Source: lesson from 3x TEST_FAILED events
```

The agent obeys. The mistake stops happening.

### 7. You can always say no

```bash
ci rules rm rule_abc123           # soft-delete (restorable within 90 days)
ci lessons rm <lesson-id>          # remove the source lesson too
ci autonomy set allow_medium false # tighten future autonomy
ci daemon stop                    # hard stop (always works)
```

**You are never locked in.**

---

## 📖 CLI reference (12 sub-commands, all working)

```bash
ci scan [repo]                                       # emit ~/.ci/project_profile.json
ci daemon run-once                                    # one full Observe->Apply cycle
ci install                                            # copy AGENTS.md + QUICKREF.md to ~/.ci/
ci lessons list | pending | rm <id>                  # manage lessons
ci rules list | pending | rm <id> | restore <id>    # manage rules
ci events list [--since ISO] [--type TYPE]            # raw event log
ci facts show [--key KEY] [--category CAT]            # durable project knowledge
ci classify <kind> [--path PATH]                       # dry-run the Risk Classifier
ci state snapshot | rollback [name]                   # snapshot management
ci config show | reset <section>                      # config inspection
ci report daily | weekly                              # human-readable status
ci doctor                                             # 9 production-readiness checks
```

---

## 🛠️ Architecture (hexagonal — Core knows nothing about any agent)

```
┌──────────────────────────────────────────────────────────────┐
│  ci — npm: continuous-improvement                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ packages/    │  │ packages/    │  │ packages/    │           │
│  │   core/      │◄─┤   cli/       │◄─┤ adapters/    │           │
│  │ (engine)     │  │ (`ci` bin)  │  │ (per-agent)  │           │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘           │
│         │                                 │                   │
│         ▼                                 ▼                   │
│  ┌──────────────┐                ┌──────────────┐            │
│  │  ~/.ci/      │                │  Your agent  │            │
│  │  state.db    │                │  (Claude /   │            │
│  │  (SQLite)    │                │  OpenCode /  │            │
│  └──────────────┘                │  Aider /Roo) │            │
│                                  └──────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

- **`packages/core/`** — engine. Zero agent knowledge. Implements `AgentAdapter` (port) + all engines + Risk Classifier + Autonomous Loop. ~1,600 LOC, fully tested.
- **`packages/cli/`** — the `ci` binary. Single executable, 12 sub-commands.
- **`packages/adapters/<agent>/`** — one tiny package per agent. Each implements `AgentAdapter`. Core never imports adapters.

---

## 🧪 Status — V0.1.0 core shipped, public release next

| | Status |
|---|--------|
| ✅ Core engine (models, stores, engines, Risk Classifier, Autonomous Loop) | **shipped** |
| ✅ 12 CLI commands working end-to-end | **shipped** |
| ✅ 4 prompt templates (project-profile, rules, lesson-extraction, rule-generation) | **shipped** |
| ✅ 42 unit tests + 2 integration tests, all passing | **shipped** |
| ✅ 9/9 production-readiness checks pass via `ci doctor` | **shipped** |
| ✅ `pnpm -r build` clean, `tsc --noEmit` clean, `eslint` clean | **shipped** |
| ✅ GitHub: 68 files, 0 Hermes files | **shipped** |
| ⏳ Real adapters for Claude Code, OpenCode, Aider, Roo | **V0.2** |
| ⏳ Public npm release (`npm publish`) | **V0.2** |
| ⏳ Evolver (writes PRs to `packages/core/**` only, gated by Risk Classifier) | **V0.3** |
| ⏳ Web dashboard, distributed KB, LLM-summarised lessons | **later** |

The core engine works **today** — install from source, run `ci daemon run-once`, watch it work. The npm publish and real adapters are the only blockers for a true public release.

---

## 📂 Where things live

```
~/.ci/                              # the daemon's home (created on first run)
├── state.db                       # SQLite — events, facts, lessons, rules
├── config.toml                    # your config (the [autonomy] block lives here)
├── project_profile.json           # output of `ci scan`
├── AGENTS.md                      # AI cooperation contract (auto-installed)
├── QUICKREF.md                    # decision tree (auto-installed)
├── logs/ci.log                    # rotating log
└── snapshots/                     # daily snapshots for `ci state rollback`
```

---

## ⚙️ Configuration (`~/.ci/config.toml`, created on first run)

```toml
version = 1

[learning]
min_occurrences = 3
window_hours = 24
min_sessions = 2
auto_promote_confidence = "medium"
max_active_rules = 200

[autonomy]
default_tier = "low"
allow_medium = true
allow_high = false
allow_critical = false
daily_report = true

[research]
enabled = false
max_age_months = 24
poll_interval_minutes = 60
require_url_proof = true
sources = []

[ownership]
owned_paths = ["packages/core/**", "docs/**"]

[daemon]
lesson_scan_interval_minutes = 60
rule_synthesis_interval_minutes = 360
research_poll_interval_minutes = 60
snapshot_interval_hours = 24
archive_retention_days = 90
```

---

## 🤝 Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/PLAN.md`](docs/PLAN.md).

The most valuable contributions right now are:

1. **V0.2: implement real adapters** (Claude Code, OpenCode, Aider, Roo) — each ≤ 300 LOC.
2. **Bug reports, prompt improvements, test coverage** — open an issue.

---

## 📚 More documentation

| Doc | What it is |
|-----|------------|
| [`PROMPTS.md`](PROMPTS.md) | 7 ready-to-copy prompts for talking to an AI about `ci` |
| [`STRUCTURE.md`](STRUCTURE.md) | Directory map with milestone tags |
| [`ROADMAP.md`](ROADMAP.md) | Milestone plan (M0 → M7) |
| [`docs/PLAN.md`](docs/PLAN.md) | Master plan with autonomous architecture |
| [`docs/PRODUCT_PACKAGING_REVIEW.md`](docs/PRODUCT_PACKAGING_REVIEW.md) | Why this exists |
| [`packages/core/templates/AGENTS.md`](packages/core/templates/AGENTS.md) | AI cooperation contract (also `~/.ci/AGENTS.md`) |
| [`packages/core/templates/QUICKREF.md`](packages/core/templates/QUICKREF.md) | Decision tree (also `~/.ci/QUICKREF.md`) |

---

## 📄 License

[Apache 2.0](LICENSE) — Malcolm Khong, 2026.

---

> **If you only remember one thing:** the system is *risk-graded*. It
> runs itself for low-risk things (logging events, deriving lessons,
> optimising prompts) and stops itself for anything that touches your
> money, your security, your data, or your code outside the agreed
> boundaries. You can tighten or loosen that line at any time with
> `ci config set autonomy.allow_<tier> true|false`.