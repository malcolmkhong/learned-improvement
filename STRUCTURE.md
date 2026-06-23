# Continuous Improvement – Standalone Project Structure

> **Root:** `C:/Users/malco/continuous-improvement/` (will be the
> `continuous-improvement/ci` GitHub repository).
> **Planning source of truth:** `docs/PLAN.md` in this folder (the master plan, 1653 lines).
> **Architecture critique:** `docs/PRODUCT_PACKAGING_REVIEW.md`.

## Status

* **Language:** TypeScript (Node 20+)
* **Distribution:** `npm install -g continuous-improvement` → runnable as `ci`
* **Storage:** SQLite at `~/.ci/state.db`
* **No Docker, no Helm, no Kubernetes, no containers.**

## Current on‑disk structure (M0 + M1.5 scaffold)

```
continuous-improvement/                 ← project root (this folder)
├── README.md                            ← entry point (npm install CTA)
├── STRUCTURE.md                         ← this file
├── ROADMAP.md                           ← condensed milestone plan
├── docs/
│   ├── PLAN.md                          ← master plan (1653 lines, copy)
│   ├── PRODUCT_PACKAGING_REVIEW.md      ← architecture critique (copy)
│   ├── adapters/                        (M3-M5) one page per adapter
│   └── contributing/                    (M0, M2) coding style, add-an-adapter
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                       (M0-D07)  Node 20/22 lint+test matrix
│   │   └── release.yml                  (M0-D08)  npm publish on tag v*
│   └── ISSUE_TEMPLATE/                  (M0-D09, D10)
├── packages/
│   ├── core/                            ← CORE: zero agent knowledge
│   │   ├── package.json                 (M1-D14)  continuous-improvement-core
│   │   ├── src/
│   │   │   ├── index.ts                 (M1-D15)
│   │   │   ├── models/                  (M1-D16)  Event, Fact, Lesson, Rule, ProjectProfile
│   │   │   │   ├── event.ts
│   │   │   │   ├── fact.ts
│   │   │   │   ├── lesson.ts
│   │   │   │   ├── rule.ts
│   │   │   │   ├── project-profile.ts
│   │   │   │   └── index.ts
│   │   │   ├── ports/                   (M1-D17, D18)  AgentAdapter + storage interfaces
│   │   │   │   ├── agent.ts
│   │   │   │   ├── storage.ts
│   │   │   │   └── index.ts
│   │   │   ├── stores/                  (M1-D19, D20, D21)  better-sqlite3
│   │   │   │   ├── sqlite-event-store.ts
│   │   │   │   ├── sqlite-fact-store.ts
│   │   │   │   └── sqlite-rule-store.ts
│   │   │   ├── engines/                 (M1, M1.5)
│   │   │   │   ├── scanner.ts           (M1-D22)
│   │   │   │   ├── lesson-engine.ts     (M1-D23)
│   │   │   │   ├── rule-engine.ts       (M1-D24)
│   │   │   │   ├── config.ts            (M1.5-D39)  [learning] section
│   │   │   │   └── promotion.ts         (M1.5-D40)  state machine
│   │   │   ├── prompts/                 (M1.5 – ✓ on disk)
│   │   │   │   ├── project-profile.ts   (M1.5-D32)
│   │   │   │   ├── rules.ts             (M1.5-D33)
│   │   │   │   ├── lesson-extraction.ts (M1.5-D34)
│   │   │   │   ├── rule-generation.ts   (M1.5-D35)
│   │   │   │   └── index.ts             (M1.5-D36)
│   │   │   ├── schemas/                 (M1, M1.5)
│   │   │   │   ├── project-profile.ts   (M1-D26)
│   │   │   │   ├── event.ts             (M1-D26 + M1.5-D37 full taxonomy)
│   │   │   │   ├── lesson.ts            (M1-D26)
│   │   │   │   └── learning-config.ts   (M1.5-D38)
│   │   │   ├── daemon.ts                (M1-D25, M1.5-D41)
│   │   │   ├── install.ts               (M1.5-D51)
│   │   │   ├── snapshots.ts             (M1.5-D42)
│   │   │   ├── doctor.ts                (M1.5-D43)
│   │   │   └── utils/                   (M1)
│   │   ├── templates/                   (M1.5 – ✓ on disk)
│   │   │   ├── AGENTS.md                (M1.5-D49)
│   │   │   └── QUICKREF.md              (M1.5-D50)
│   │   └── tests/                       (M1, M1.5)
│   │       ├── learning-state-machine.test.ts   (M1.5-D52)
│   │       └── event-taxonomy.test.ts           (M1.5-D53)
│   ├── cli/                             ← CLI: the `ci` binary
│   │   ├── package.json                 (M1-D28)  continuous-improvement, bin: "ci"
│   │   ├── src/
│   │   │   ├── index.ts                 (M1-D29)
│   │   │   ├── bin/
│   │   │   │   └── ci.ts                (M1-D29)  shebang entry, commander
│   │   │   └── commands/
│   │   │       ├── daemon.ts            (M1-D30)
│   │   │       ├── scan.ts              (M1-D30)
│   │   │       ├── lessons.ts           (M1-D30, M1.5-D46 pending+rm)
│   │   │       ├── rules.ts             (M1-D30, M1.5-D47 pending+rm+restore)
│   │   │       ├── events.ts            (M1-D30)
│   │   │       ├── facts.ts             (M1-D30)
│   │   │       ├── run.ts               (M1-D30)
│   │   │       ├── adapters.ts          (M1-D30)
│   │   │       ├── config.ts            (M1.5-D45)
│   │   │       ├── doctor.ts            (M1.5-D44)
│   │   │       └── state.ts             (M1.5-D48)
│   │   └── tests/
│   └── adapters/
│       ├── claudecode/                  ← ADAPTER #1 (M3)
│       │   ├── package.json             (M3-D58)  @continuous-improvement/adapter-claudecode
│       │   ├── src/
│       │   │   ├── index.ts             implements AgentAdapter
│       │   │   ├── event-source.ts      tail JSONL log
│       │   │   ├── prompt-bridge.ts     --append-system-prompt
│       │   │   └── run.ts               launch `claude` with enriched args
│       │   └── tests/
│       ├── opencode/                    ← ADAPTER #2 (M4)
│       │   ├── package.json             @continuous-improvement/adapter-opencode
│       │   ├── src/
│       │   └── tests/
│       ├── aider/                       ← ADAPTER #3 (M5)
│       │   ├── package.json             @continuous-improvement/adapter-aider
│       │   ├── src/
│       │   └── tests/
│       ├── roo/                         ← ADAPTER #4 (M5)
│       │   ├── package.json             @continuous-improvement/adapter-roo
│       │   ├── src/
│       │   └── tests/
│       ├── hermes/                      ← ADAPTER #5 (M7 - DEFERRED)
│       │   ├── package.json
│       │   ├── src/
│       │   └── tests/
│       ├── openhands/                   ← ADAPTER #6 (M7 - DEFERRED)
│       │   ├── package.json
│       │   ├── src/
│       │   └── tests/
│       └── windsurf/                    ← ADAPTER #7 (M7 - DEFERRED)
│           ├── package.json
│           ├── src/
│           └── tests/
├── scripts/
│   ├── verify_no_circular_imports.mjs   (M0-D11)  CI lint
│   ├── publish.sh                       (M0-D12)
│   └── smoke.sh                         (M1/M6-D71)
└── tests/
    └── integration/                     (M2-D57, M3)
```

## Mapping table – every roadmap item has a file

| Milestone | Files in this structure |
|-----------|--------------------------|
| **M0** | `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `LICENSE`, `CONTRIBUTING.md`, `.gitignore`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/ISSUE_TEMPLATE/*.md`, `scripts/verify_no_circular_imports.mjs`, `scripts/publish.sh`, `docs/contributing/coding-style.md` |
| **M1** | `packages/core/{models,ports,stores,engines,schemas,daemon,utils}/`, `packages/cli/` |
| **M1.5** | `packages/core/src/prompts/`, `packages/core/src/schemas/learning-config.ts`, `packages/core/src/engines/{config,promotion}.ts`, `packages/core/src/{install,snapshots,doctor}.ts`, `packages/core/templates/{AGENTS,QUICKREF}.md`, `packages/core/tests/{learning-state-machine,event-taxonomy}.test.ts`, `packages/cli/src/commands/{config,doctor,state,lessons-extended,rules-extended}.ts` |
| **M2** | `packages/adapters/stub/`, `docs/contributing/add-an-adapter.md`, `docs/quickstart.md`, `tests/integration/` |
| **M3** | `packages/adapters/claudecode/**` |
| **M4** | `packages/adapters/opencode/**` |
| **M5** | `packages/adapters/{aider,roo}/**` |
| **M6** | `docs/index.md`, `docs/CHANGELOG.md`, `docs/architecture.md`, `docs/QUICKREF.md`, `scripts/smoke.sh` |
| **M7** (deferred) | `packages/adapters/{hermes,openhands,windsurf}/**` |

## Verification commands (run from this root)

```bash
# Verify directory structure matches the plan
find . -type d -not -path "*/node_modules*" | sort

# (M0-D11) Verify core ↛ adapter rule is satisfiable
node scripts/verify_no_circular_imports.mjs

# (M0-D07) Once the workspace is wired, run the matrix
pnpm install --frozen-lockfile
pnpm -r lint
pnpm -r test --coverage

# (M1.5) View the AI guide and decision tree
cat packages/core/templates/AGENTS.md
cat packages/core/templates/QUICKREF.md

# (M1.5) View the four prompt templates
ls packages/core/src/prompts/
```

> **Heads up:** This folder is the *target shape*. The M0 + M1.5 milestone
> deliverables (the actual `package.json`, `LICENSE`, `CONTRIBUTING.md`,
> the `.github/workflows/*.yml` YAML, the circular-import verifier, the
> four prompt templates, `AGENTS.md`, `QUICKREF.md`, etc.) are the **next
> commits**. The roadmap IDs in parentheses above (e.g. `M0-D14`,
> `M1.5-D32`) tell you exactly which roadmap item produces each file.
