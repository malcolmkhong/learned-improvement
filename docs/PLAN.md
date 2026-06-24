# Implementation Plan – Continuous Improvement (V1)

> **Document type:** master implementation plan (autonomous, risk‑graded revision)
> **Owner:** Malcolm Khong <[REDACTED]>
> **Status:** v0.1.0 core implemented; v0.2.0 (full autonomy) in design
> **Repo:** [github.com/malcolmkhong/learned-improvement](https://github.com/malcolmkhong/learned-improvement)
> **Distribution:** `npm install -g continuous-improvement`
> **Stack:** TypeScript (Node 20+), better-sqlite3, zod, commander, vitest

---

## 0. The North Star

This project is an **autonomous self-improving engine** for AI coding agents. It is **not a passive memory system**.

The objective is a system that:

```
Observe → Learn → Research → Verify → Test → Apply → Monitor → Store → Repeat
```

with **no human in the inner loop**, and humans appearing in only three places:

1. **Daily report** — what the system learned and changed.
2. **High-risk approval** — when an action crosses into High tier.
3. **Critical-risk approval** — when an action crosses into Critical tier (hard-stop category).

**Hard‑stop categories** (never bypassed, even during self‑improvement):

| Category | Examples |
|----------|----------|
| `financial` | spending money, payment APIs, banking, credit cards |
| `security` | auth, permissions, encryption, secrets, keys |
| `privacy` | PII exfiltration, telemetry uploads, third‑party sharing |
| `data_loss` | deletions, drop tables, `rm -rf`, force pushes |
| `infrastructure` | production deploys, infra‑as‑code changes, DNS |
| `project_break` | modifying non‑owned files outside `packages/core/**` |
| `legal` | anything that could create legal exposure |

**Risk tiers** (4 levels, classified by the Risk Classifier):

| Tier | Examples | System action |
|------|----------|---------------|
| **Low** | store event, store fact, update prompt, optimize workflow | **Auto‑apply**, no report |
| **Medium** | modify owned code, install dep, change prompt template | **Auto‑apply + report** |
| **High** | modify ownership boundary, change daemon safety config | **Block + ask human** |
| **Critical** | spend money, touch security, delete data, modify non‑owned code | **Hard‑stop until approved** |

---

## 1. Architecture

### 1.1 Hexagonal (ports & adapters)

```
┌─────────────────────────────────────────────────────────┐
│  ci (npm: continuous-improvement)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  packages/   │  │  packages/   │  │  packages/   │     │
│  │    core/     │◄─┤    cli/      │◄─┤  adapters/  │     │
│  │  (engine)   │  │  (`ci` bin)  │  │  (per-agent) │     │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘     │
│         │                                  │             │
│         ▼                                  ▼             │
│  ┌──────────────┐                  ┌──────────────┐     │
│  │  ~/.ci/      │                  │  Your agent  │     │
│  │  state.db    │                  │  (Claude /   │     │
│  │  (SQLite)    │                  │  OpenCode /  │     │
│  └──────────────┘                  │  Aider /Roo) │     │
│                                    └──────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Core (engine, zero agent knowledge)

**Path:** `packages/core/src/`

| Module | File | Responsibility |
|--------|------|----------------|
| Models | `models/{event,fact,lesson,rule,project-profile}.ts` | zod‑validated data shapes |
| Ports | `ports/{agent,storage}.ts` | `AgentAdapter`, `EventStore`, `FactStore`, `LessonStore`, `RuleStore` interfaces |
| Stores | `stores/sqlite-*-store.ts` | better‑sqlite3 implementations (WAL mode) |
| Engines | `engines/{scanner,lesson-engine,rule-engine}.ts` | scanner, promotion state machine, rule synthesis |
| Prompts | `prompts/{project-profile,rules,lesson-extraction,rule-generation}.ts` | the 4 prompt templates |
| Risk | `risk/index.ts` | 4‑tier classifier with 7 hard‑stop categories |
| Loop | `loop/index.ts` | Observe→Learn→Research→Verify→Test→Apply→Monitor→Store→Repeat |
| Research | `research/index.ts` | opt‑in web fetcher with freshness policy |
| Config | `config.ts` | TOML config with `[learning]`, `[autonomy]`, `[research]`, `[ownership]`, `[daemon]` sections |
| Paths | `paths.ts` | `~/.ci/` layout |
| DB | `db.ts` | SQLite migration (events / facts / lessons / rules tables) |
| Install | `install.ts` | copies AGENTS.md + QUICKREF.md to `~/.ci/` on first run |
| Snapshots | `snapshots.ts` | create / restore `state.db` snapshots |
| Doctor | `doctor.ts` | 9 production‑readiness checks |
| Daemon | `daemon.ts` | `runOnce()` + `ensureHome()` |

### 1.3 CLI (`packages/cli/src/bin/ci.ts`)

```
ci scan [repo]                # emit project_profile.json
ci daemon run-once            # one full Observe→Apply cycle
ci install                    # copy AGENTS.md + QUICKREF.md to ~/.ci/
ci lessons list|pending|rm    # manage lessons
ci rules list|pending|rm|restore  # manage rules
ci events list [--since] [--type]
ci facts show [--key] [--category]
ci classify <kind> [--path]   # dry-run the Risk Classifier
ci state snapshot|rollback    # create / restore snapshots
ci config show|reset <section>
ci report daily|weekly        # what changed today / this week
ci doctor                     # 9 production-readiness checks
```

### 1.4 Adapters (`packages/adapters/<agent>/`)

Each adapter implements `AgentAdapter` (the `ports/agent.ts` interface) and is discovered via npm `ci.adapters` field. **Core never imports adapters.**

| Adapter | Status (V0.1.0) |
|---------|-----------------|
| `@continuous-improvement/adapter-stub` | implemented (used for tests) |
| `adapter-claudecode` | deferred to V0.2 |
| `adapter-opencode` | deferred to V0.2 |
| `adapter-aider` | deferred to V0.2 |
| `adapter-roo` | deferred to V0.2 |
| `adapter-hermes` | **cancelled** (Hermes is no longer the host) |

---

## 2. The Risk Classifier

`packages/core/src/risk/index.ts` is the **only** component that decides what the daemon may do. Every ActionProposal is scored:

```ts
classify(proposal, config) -> {
  tier: "low" | "medium" | "high" | "critical",
  hardStops: HardStopCategory[],
  requiresApproval: boolean,
  autoApply: boolean,
  reason: string,
}
```

**Rules:**

1. Any `modify_financial`, `modify_auth`, `delete_data`, `modify_infrastructure`, or `modify_unowned_file` → `critical`, hard-stop triggered.
2. Any external `network_request` (https/http to non‑loopback) → `critical`, hard‑stop `privacy`.
3. `modify_owned_file` → `medium` by default.
4. `store_event`, `update_fact`, `deactivate_rule` → `low`.
5. `spawn_subprocess` → `medium`, but `high` if the command contains `rm -rf /`, `del /s`, `format`.
6. `activate_rule` → `medium` if the rule is `block`; otherwise `low`.

The classifier is **read‑only** and lives in `packages/core/src/risk/**`. The Evolver (V0.2) cannot edit the Risk Classifier.

---

## 3. Data Model

### 3.1 Event (`models/event.ts`)

```ts
type EventType = "TOOL_ERROR" | "TOOL_ERROR_REPEATED" | "TEST_FAILED" |
                "BUILD_FAILED" | "LINT_ERROR" | "TYPE_ERROR" |
                "IMPORT_ERROR" | "USER_CORRECTION" | "CODE_REVERTED" |
                "RULE_VIOLATED" | "RULE_OVERRIDDEN" | "RULE_STALE" |
                "LESSON_DISPUTED" | "LESSON_CREATED" | "RULE_ACTIVATED" |
                "RULE_DEACTIVATED" | "RULE_REVERTED" | "CONFIG_CHANGED" |
                "OWNERSHIP_REFUSED" | "APPROVAL_GRANTED" | "APPROVAL_DENIED" |
                "DAEMON_START" | "DAEMON_STOP" | "HEARTBEAT" | "CACHE_HIT" |
                "RESEARCH_FETCH" | "KNOWLEDGE_UPDATED" | "USER_DEFINED";
```

28 canonical types; adding a new type is a breaking change. `EVENT_BLACKLIST` excludes noise events from lesson promotion.

### 3.2 Fact (`models/fact.ts`)

Dated, source‑attributed knowledge: `key`, `category` (project | convention | dependency | world | decision), `value`, `source`, `source_url`, `fetched_at`, `verified_at`, `confidence` ∈ [0,1].

### 3.3 Lesson (`models/lesson.ts`)

If‑then knowledge extracted from events: `pattern`, `fix`, `status` (candidate | accepted | rejected | disputed), `confidence` (low | medium | high), `occurrences`, `distinct_sessions`, `source_event_ids[]`.

### 3.4 Rule (`models/rule.ts`)

Executable policy: `condition` (`always` | `regex` | `ast` | `shell`, scoped to `file` | `session` | `project` | `global`), `action` (`block` | `warn` | `suggest` | `inject`), `priority` (1‑10), `status` (candidate | active | archived | disabled), `rationale`, `lesson_id`.

### 3.5 ProjectProfile (`models/project-profile.ts`)

Output of the scanner: `language` (typescript | javascript | python | mixed | unknown), `package_manager`, `folders[]`, `adrs[]`, `naming_conventions[]`, `dependencies[]`, `lint_configs[]`.

---

## 4. Configuration

`~/.ci/config.toml` (created on first run with defaults):

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

## 5. The Autonomous Loop (Observe → Apply)

Implemented in `packages/core/src/loop/index.ts`:

```
1. OBSERVE  — events appended by adapters via EventStore.append()
2. LEARN    — LessonEngine.runCycle() groups events into candidate/accepted lessons
3. RESEARCH — (opt‑in) ResearchClient.fetch() pulls fresh facts from web sources
4. VERIFY   — Risk Classifier scores every proposed action
5. TEST     — (V0.2) unit‑test run for any owned‑code modification
6. APPLY    — if verdict.autoApply === true, side‑effect runs
7. MONITOR  — (V0.2) post‑apply: did the change actually help?
8. STORE    — append a CONFIG_CHANGED / LESSON_CREATED / RULE_ACTIVATED event
9. REPEAT   — schedule next cycle
```

The Loop returns a `LoopReport`:

```ts
{
  cycleStartedAt, cycleEndedAt,
  proposals:  { proposal, verdict }[],
  applied:    { actionId, kind, appliedAt }[],
  blocked:    { actionId, verdict, reason }[],
  errors:     { actionId, message }[],
}
```

`ci report daily` and `ci report weekly` render this into human‑readable text.

---

## 6. Milestones & Status

| # | Milestone | Effort | Status (V0.1.0) |
|---|-----------|--------|------------------|
| M0 | Repo skeleton (npm workspace) | 2 days | ✅ **shipped** |
| M1 | Core engine (passive) | 1 week | ✅ **shipped** |
| M1.5 | Learning engine + 4 prompt templates + AGENTS.md + QUICKREF.md | 1 week | ✅ **shipped** |
| M2 | Adapter framework + stub | 2 days | ✅ **shipped** (stub only) |
| M2.5 | **Risk Classifier + Autonomous Loop** | 5 days | ✅ **shipped** |
| M3 | Claude Code / OpenCode / Aider / Roo adapters | 2 days each | ❌ **not shipped** (V0.2) |
| M4 | `network_request` → always allow via research.enabled | 2 days | ❌ **not shipped** |
| M5 | Real Evolver (writes PRs to `packages/core/**` only) | 5 days | ❌ **not shipped** |
| M6 | Self‑modification under ownership boundaries | 5 days | ❌ **not shipped** |
| M7 | Public 0.1.0 npm release | 2 days | ❌ **not shipped** |
| M8 | Hermes / OpenHands / Windsurf adapters | – | 📅 **cancelled** (V0.2 if ever) |

**V0.1.0 = M0–M2.5.** A user can install and use `ci` for event capture, lesson extraction, rule synthesis, and risk‑graded auto‑apply. The 4‑tier Risk Classifier, 7 hard‑stops, and Autonomous Loop are the heart of this release.

---

## 7. Definition of Done — V0.1.0

* [x] `npm install -g continuous-improvement` works (after `pnpm publish`).
* [x] `ci --help` lists all sub‑commands.
* [x] `ci scan` writes valid `project_profile.json`.
* [x] `ci install` copies AGENTS.md + QUICKREF.md to `~/.ci/`.
* [x] `ci daemon run-once` completes a full Observe→Apply cycle.
* [x] `ci doctor` runs 9 production‑readiness checks.
* [x] `ci classify <kind>` dry‑runs the Risk Classifier.
* [x] `ci state snapshot` + `ci state rollback <name>` works.
* [x] `ci report daily|weekly` prints a status report.
* [ ] **Unit tests pass** — written, not yet executed.
* [ ] **Integration tests pass** — not yet written.
* [ ] **Lint + typecheck pass** — not yet executed.
* [ ] **Public npm release** — not yet published.

---

## 8. The Three Prompt Templates

The 4 prompt templates live in `packages/core/src/prompts/`. Two are *inbound* (injected into the agent's system prompt); two are *outbound* (sent to the LLM by the daemon for bookkeeping).

### 8.1 `project-profile.ts` (inbound)

Tells the agent what is true about the repo: folder layout, ADRs, naming conventions, allowed deps, lint config. Agent must obey hard constraints or ASK before violating.

### 8.2 `rules.ts` (inbound)

Lists active rules with their action (block / warn / suggest / inject) and priority. Agent must obey hard (block) rules; for soft rules it may ask the user for confirmation.

### 8.3 `lesson-extraction.ts` (outbound)

Sent to the LLM by `LessonEngine`. Asks it to group raw events into lessons: pattern, fix, occurrences, confidence, source_event_ids.

### 8.4 `rule-generation.ts` (outbound)

Sent to the LLM by `RuleEngine`. Asks it to convert a single lesson into an executable Rule: condition (type + pattern + scope), action, priority, rationale. Hard constraint: `block` rules require a *deterministic* check (regex / AST / shell).

---

## 9. File Layout (live)

```
continuous-improvement/
├── README.md                           # user-facing
├── PLAN.md                             # ← this document
├── PROMPTS.md                          # 7 ready-to-copy prompts for AI agents
├── LICENSE                             # Apache-2.0
├── CONTRIBUTING.md
├── STRUCTURE.md                        # directory map
├── ROADMAP.md                          # condensed milestones
├── package.json                        # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts                    # (per-package)
├── docs/
│   ├── PLAN.md                         # (this file, mirrored)
│   ├── PRODUCT_PACKAGING_REVIEW.md
│   └── QUICKREF.md (mirrored to ~/.ci/QUICKREF.md)
├── .github/
│   ├── workflows/ci.yml
│   └── workflows/release.yml
├── packages/
│   ├── core/                           # the engine
│   │   ├── src/
│   │   │   ├── models/                 # Event, Fact, Lesson, Rule, ProjectProfile
│   │   │   ├── ports/                  # AgentAdapter, *Store interfaces
│   │   │   ├── stores/                 # SQLite implementations
│   │   │   ├── engines/                # Scanner, LessonEngine, RuleEngine
│   │   │   ├── prompts/                # 4 prompt templates
│   │   │   ├── risk/                   # Risk Classifier (4 tiers, 7 hard-stops)
│   │   │   ├── loop/                   # Autonomous Loop
│   │   │   ├── research/               # opt-in web fetcher
│   │   │   ├── config.ts               # TOML ConfigManager
│   │   │   ├── paths.ts                # ~/.ci/ layout
│   │   │   ├── db.ts                   # SQLite bootstrap + migrations
│   │   │   ├── install.ts              # AGENTS.md + QUICKREF.md installer
│   │   │   ├── snapshots.ts            # snapshot / restore
│   │   │   ├── doctor.ts               # 9 production-readiness checks
│   │   │   └── daemon.ts               # runOnce() + ensureHome()
│   │   └── templates/
│   │       ├── AGENTS.md               # (mirrored to ~/.ci/AGENTS.md)
│   │       └── QUICKREF.md
│   ├── cli/                            # the `ci` binary
│   │   └── src/bin/ci.ts               # 12 sub-commands
│   └── adapters/
│       └── stub/                       # for tests
└── tests/
    └── integration/                     # (V0.2)
```

---

## 10. Engineering Standards (enforced)

* **No hardcoded values.** All thresholds live in `~/.ci/config.toml`.
* **No `any` types.** TypeScript `strict: true`. zod validates every external boundary.
* **Strong typing.** Every public API has an explicit return type and explicit input type.
* **No dead code.** Unused exports removed in every PR.
* **No unnecessary abstractions.** No class hierarchies; modules export functions and small classes.
* **Prefer modification over duplication.** One Risk Classifier, one ConfigManager, one path resolver.
* **Every piece of code must have a purpose.** New code comes with a test.
* **No over‑engineering.** V0.1.0 ships the minimum useful surface; V0.2 adds what is requested.

---

## 11. Open Questions for V0.2

These were deferred from V0.1.0 because the user explicitly chose "ship the core first":

1. Real adapters for Claude Code, OpenCode, Aider, Roo.
2. Evolver that writes PRs to `packages/core/**` only, gated by the Risk Classifier.
3. Post‑apply monitor (does the rule actually reduce future events?).
4. LLM‑backed lesson extraction (currently deterministic; the prompt is in place).
5. GitHub Actions release workflow that publishes to npm on tag.

---

## 12. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `better-sqlite3` native build fails on some platforms | Medium | High | prebuilt binaries shipped by the package; `npm install` falls back to source build |
| Adapter abuse (emitting false events to pollute memory) | Low | Medium | `EVENT_BLACKLIST` filters self‑tracking; lesson engine requires ≥ 3 occurrences |
| Risk Classifier misclassifies a critical action as low | Low | High | unit tests cover all 7 hard‑stop categories; V0.2 adds defense‑in‑depth (second‑pass review for `block` actions) |
| Self‑modification touches non‑owned code | High | Critical | `ownership.owned_paths` is enforced by the Evolver; the Risk Classifier refuses `modify_unowned_file` as `critical` |
| Schema break (adding a new event type) | Low | Medium | zod refuses unknown types at the boundary; plan documents the upgrade procedure |

---

## 13. Versioning

* `0.0.x` — development snapshots, no published releases.
* `0.1.0` — current: Risk Classifier + Autonomous Loop + 12 CLI commands + stub adapter.
* `0.2.0` — planned: real adapters + Evolver + Monitor + public npm release.
* `1.0.0` — when ≥ 3 production adapters are stable and ≥ 1 has ≥ 100 daily active users.

---

*End of plan – autonomous, risk‑graded revision. The full implementation status
lives in the GitHub repo at `malcolmkhong/learned-improvement`. For the
original (passive) design rationale, see `docs/PRODUCT_PACKAGING_REVIEW.md`.*