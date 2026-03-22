# @apogeelabs/the-agency

A multi-agent development toolkit for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). It gives your project a team of specialized AI agents — architect, developer, reviewer, test hardener, and more — that collaborate through the filesystem to take features from idea to implementation.

Install the package, sync the files, and your Claude Code sessions gain access to structured workflows that turn vague requirements into build plans and build plans into tested, review-ready code.

## Quick Start

```bash
# Install
npm install -D @apogeelabs/the-agency

# Sync agents, commands, and AI context files into your project
npx the-agency sync

# Or pick specific files to sync
npx the-agency sync --pick
```

This copies files into `.claude/agents/`, `.claude/commands/`, and `.ai/` in your project. You'll be prompted before overwriting existing files.

## The Workflow

The core workflow is a pipeline that moves from requirements to shipped code:

```
/pm  -->  product brief  -->  /architect  -->  build plan  -->  /build or /auto-build
```

- **`/pm`** — Interactive session that produces a product brief (`docs/briefs/[feature].md`)
- **`/architect`** — Interactive session that produces a build plan (`docs/build-plans/[feature].md`)
- **`/build`** — Orchestrates dev, review, and test agents with manual gates between stages
- **`/auto-build`** — Fully autonomous pipeline: build, commit, and draft PR with no human intervention

After a build completes, use **`/retrospective`** to consolidate lessons from pipeline reports into reusable patterns.

Agents communicate only through the filesystem. No shared context windows. This is intentional — it forces each agent to write down its reasoning, which makes the whole pipeline auditable.

See `.ai/workflow.md` after syncing for the full workflow guide.

## What's Included

### Agents (`.claude/agents/`)

Autonomous subagents that run in isolated context windows.

| Agent             | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| **architect**     | Designs technical approach, produces build plans           |
| **auto-prep-pr**  | Non-interactive PR preparation and draft creation          |
| **dev**           | Implements features from build plans, task by task         |
| **explorer**      | Maps and documents unfamiliar codebases (read-only)        |
| **pm**            | Produces product briefs from requirements                  |
| **retrospective** | Extracts patterns from pipeline reports into retro files   |
| **reviewer**      | Adversarial code review with pass/fail verdict (read-only) |
| **test-hardener** | Writes edge-case tests, tries to break things              |

### Commands (`.claude/commands/`)

Slash commands invoked in Claude Code sessions.

| Command           | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `/architect`      | Interactive architecture design session                        |
| `/auto-build`     | Fully autonomous build + commit + draft PR pipeline            |
| `/auto-prep-pr`   | Non-interactive PR prep via auto-prep-pr agent                 |
| `/build`          | Orchestrates the dev → review → test pipeline (manually-gated) |
| `/pm`             | Interactive product requirements discovery                     |
| `/prep-pr`        | Pre-submission PR prep and draft creation                      |
| `/retrospective`  | Interactive consolidation of retro files into lessons-learned  |
| `/review-pr`      | Structured PR review briefing                                  |
| `/weekly-summary` | Weekly synthesis of merged PRs                                 |
| `/dnd-alignment`  | D&D alignment chart from commit history                        |

### AI Context (`.ai/`)

Reference material automatically available to Claude Code.

| File                      | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| **UnitTestGeneration.md** | TypeScript/Jest unit testing style guide        |
| **UnitTestExamples.md**   | Working examples for the test style guide       |
| **workflow.md**           | Multi-agent development workflow guide          |
| **lessons-learned.md**    | Accumulated lessons from retrospective analysis |

## Review Checks (`.ai/review-checks/`)

The `/review-pr` command supports pluggable tribal-knowledge checks. Place markdown files in `.ai/review-checks/` in your repo, and the review command discovers and evaluates them automatically.

### Check File Format

Each file uses YAML frontmatter with two fields:

```markdown
---
name: Display Name for This Check Group
applies_when: Natural language description of when these checks apply
---

- [ ] **Check name**: What to look for.
```

- **`name`** — heading used in the review output
- **`applies_when`** — evaluated by the LLM against the PR's changed file list. Use plain language (e.g., "Changed files include `.tsx` files" or "Always").

### Pre-packaged Plugins

Install review plugins interactively:

```bash
npx the-agency install-review-plugins
```

| Plugin                | Targets                                             | Checks                                                                                               |
| --------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **react-frontend.md** | `.tsx`, `.jsx`, `.css`, `.scss`, `.styled.ts` files | Hard-coded colors, missing `data-cy` attributes, accessibility gaps                                  |
| **node-backend.md**   | `.ts` files in backend/service directories          | `console.log` usage, boundary violations, raw SQL, error swallowing                                  |
| **general.md**        | All PRs (unconditional)                             | New env vars, dead code, dependency changes, type safety (`any`, `as`, `@ts-ignore`)                 |
| **unit-test.md**      | `.test.ts`, `.spec.ts` files                        | Style guide adherence, barrel export testing, test description accuracy, missing `export default {}` |

## Project-Specific Configuration

The sync does **not** copy `settings.local.json` or `settings.json` — those are project-specific. See the [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code) for configuring permissions per-project.

## Requirements

- Node.js >= 22
- Claude Code
- GitHub CLI (`gh`) — required for `/review-pr`, `/prep-pr`, and PR-related operations

## Development

See [DEVELOP.md](./DEVELOP.md) for setup, build, test, and publishing workflows.
