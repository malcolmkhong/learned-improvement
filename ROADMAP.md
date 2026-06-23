# Continuous Improvement – Roadmap (0.1.0 → 0.x)

> **Source of truth:** `docs/PLAN.md` in this folder (the master plan, 1653 lines).
> This file is a condensed, scannable view of **§7 Milestones** and **§8 TODO list**
> from that document, with concrete file paths.

## Install (for users)

```bash
npm install -g continuous-improvement
ci --help
```

Adapters are separate packages (install only the ones you need):

```bash
npm install -g @continuous-improvement/adapter-claudecode
npm install -g @continuous-improvement/adapter-opencode
npm install -g @continuous-improvement/adapter-aider
npm install -g @continuous-improvement/adapter-roo
```

## Milestones at a glance

| ID | Goal | Effort | File root |
|----|------|--------|-----------|
| **M0** | Repo skeleton (workspace, workflows, lint) | 2 days | this folder + `.github/` + `scripts/` |
| **M1** | Core Engine (`continuous-improvement-core` + `ci` CLI) | 1 week | `packages/core/` + `packages/cli/` |
| **M1.5** | Learning Engine & Prompts (the AI contract) | 1 week | `packages/core/src/prompts/` + `packages/core/templates/` + `packages/core/src/engines/{config,promotion}.ts` + `packages/cli/src/commands/{config,doctor,state}.ts` |
| **M2** | Adapter framework + author guide | 2 days | `packages/adapters/stub/` + `docs/contributing/add-an-adapter.md` |
| **M3** | Claude Code Adapter (Adapter #1) | 2 days | `packages/adapters/claudecode/` |
| **M4** | OpenCode Adapter | 1 day | `packages/adapters/opencode/` |
| **M5** | Aider & Roo Adapters | 2 days (1 day each) | `packages/adapters/{aider,roo}/` |
| **M6** | Public 0.1.0 npm release | 2 days | `docs/index.md` + `docs/CHANGELOG.md` + `docs/architecture.md` + `docs/QUICKREF.md` |
| **M7** | Hermes / OpenHands / Windsurf adapters (deferred) | – | `packages/adapters/{hermes,openhands,windsurf}/` |

## What M1.5 actually ships (the part that makes it production-ready)

> M1.5 is the difference between "a database" and "a cooperating partner."

| File | Why it matters |
|------|----------------|
| `packages/core/src/prompts/project-profile.ts` | Tells the AI what's true about the repo. |
| `packages/core/src/prompts/rules.ts` | Tells the AI which rules to obey. |
| `packages/core/src/prompts/lesson-extraction.ts` | Lets the daemon ask the LLM to group events. |
| `packages/core/src/prompts/rule-generation.ts` | Lets the daemon ask the LLM to write a rule. |
| `packages/core/src/schemas/learning-config.ts` | Validates the `[learning]` section of `~/.ci/config.toml`. |
| `packages/core/src/engines/config.ts` | `ci config set/show/reset/edit`. |
| `packages/core/src/engines/promotion.ts` | Implements the event → lesson → rule state machine. |
| `packages/core/src/install.ts` | Installs `AGENTS.md` and `QUICKREF.md` to `~/.ci/` on first run. |
| `packages/core/src/snapshots.ts` | `ci state rollback --to <ISO>`. |
| `packages/core/src/doctor.ts` | `ci doctor` — runs the 22 production-readiness checks. |
| `packages/core/templates/AGENTS.md` | The AI cooperation contract. |
| `packages/core/templates/QUICKREF.md` | The decision tree. |

## Existing `todo` items → milestones

| todo | Fulfilled by | Status |
|------|--------------|--------|
| `helm_chart` | **OBSOLETE** – removed from npm‑first scope. Cancel this todo. | ❌ removed |
| `ci_lint` | M0‑D07 (`.github/workflows/ci.yml`) + M0‑D11 (`scripts/verify_no_circular_imports.mjs`) | ✓ kept |
| `release_tag` | M0‑D08 (`.github/workflows/release.yml`) + M6 (`git tag v0.1.0`) | ✓ kept |

## Commit order (M0 → M6)

1. **M0** – workspace + workflows + lint (13 files)
2. **M1** – Core Engine (~34 files)
3. **M1.5** – Learning Engine & Prompts (~22 files) – **this is what makes it production-ready**
4. **M2** – Adapter framework + docs (~6 files)
5. **M3** – Claude Code Adapter (~7 files)
6. **M4** – OpenCode Adapter (~4 files)
7. **M5** – Aider + Roo Adapters (~4 files each)
8. **M6** – Public release (~5 files); tag `v0.1.0` after merge

## Target users

* **Claude Code users** – primary audience (Adapter #1)
* **OpenCode users** – Adapter #2
* **Aider users** – Adapter #3
* **Roo users** – Adapter #4
* **Solo developers, indie hackers, small teams** – primary persona for the core CLI

## Deferred (no current target‑user demand)

* **Hermes, OpenHands, Windsurf** – v0.2+ if anyone asks.

## Progress check

```bash
# From C:/Users/malco/continuous-improvement/
find . -type d -not -path "*/node_modules*" | sort
ls -la packages/core/src/                                  # M1 status
ls -la packages/core/src/prompts/                          # M1.5 status (✓ on disk)
ls -la packages/core/templates/                            # M1.5 status (✓ on disk)
node scripts/verify_no_circular_imports.mjs                # M0-D11 lint
```

> **Heads up:** Today (2026‑06‑24) the M0 *scaffold* is on disk
> (folders + `README.md` + `STRUCTURE.md` + `ROADMAP.md` + `docs/PLAN.md` +
> `docs/PRODUCT_PACKAGING_REVIEW.md` + the 4 prompt templates + `AGENTS.md`
> + `QUICKREF.md`). The first **content** commit is the 13 M0 files.
> The second commit is the ~34 M1 core files. The third commit is the
> ~22 M1.5 learning files. **All three commits together make it
> production-ready.**
