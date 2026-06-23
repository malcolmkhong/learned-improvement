# Contributing to Continuous Improvement

Thanks for your interest in making AI coding agents more reliable.
This project is **local-first**, **single-developer-friendly**, and
**adapter-agnostic** — contributions of any size are welcome.

## Quick orientation

* **Core engine** lives in `packages/core/`. It has **zero** knowledge of
  any specific AI agent.
* **Adapters** live in `packages/adapters/<agent>/`. One small package
  per agent (Claude Code, OpenCode, Aider, Roo, …).
* **CLI** lives in `packages/cli/`. It is the `ci` binary you run from
  the terminal.
* **Docs** live in `docs/`. The master plan is `docs/PLAN.md` (1600+ lines).
* **Prompt templates** live in `packages/core/src/prompts/`.

## How to add a new adapter

See `docs/contributing/add-an-adapter.md` for the full guide. The short
version:

1. `cp -r packages/adapters/stub packages/adapters/myagent`
2. Edit `package.json` to set the name to
   `@continuous-improvement/adapter-myagent`.
3. Implement the `AgentAdapter` interface from `continuous-improvement-core`.
4. Add a test in `tests/adapter.test.ts`.
5. Submit a PR.

## How to add a new event type

See `docs/PLAN.md` §19 for the canonical list. Adding a new type is a
breaking change to the event schema; please open an issue first.

## Coding style

* TypeScript strict mode (`tsconfig.base.json`).
* Prettier for formatting; ESLint for linting.
* Tests live next to the code they test (`*.test.ts`).
* All public APIs have JSDoc comments.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Roo Code adapter
fix: handle missing config.toml
docs: update quickstart
test: cover lesson-extraction prompt
chore: bump vitest to 1.6.1
```

## License

By contributing, you agree that your contributions will be licensed
under the Apache License 2.0 (see `LICENSE`).
