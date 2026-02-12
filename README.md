# @apogeelabs/the-agency

Centralized Claude Code agents, commands, and workflows. Install once, sync to any project.

## Install

```bash
npm install -D @apogeelabs/the-agency
```

## Usage

```bash
# Sync all agents, commands, and AI context files to your project
npx the-agency sync

# Choose which files to sync
npx the-agency sync --pick
```

Files are copied to `.claude/agents/`, `.claude/commands/`, and `.ai/` in the target project. If destination files already exist, you'll be prompted before overwriting.

## What's Included

### Agents (`.claude/agents/`)

Autonomous subagents that run in isolated context windows and communicate through files.

| Agent             | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| **architect**     | Designs technical approach, produces build plans           |
| **dev**           | Implements features from build plans, task by task         |
| **explorer**      | Maps and documents unfamiliar codebases (read-only)        |
| **pm**            | Produces product briefs from requirements                  |
| **reviewer**      | Adversarial code review with pass/fail verdict (read-only) |
| **test-hardener** | Writes edge case tests, tries to break things              |

### Commands (`.claude/commands/`)

Slash commands invoked in Claude Code sessions.

| Command      | Purpose                                            |
| ------------ | -------------------------------------------------- |
| `/architect` | Interactive architecture design session            |
| `/build`     | Orchestrates the full dev → review → test pipeline |
| `/pm`        | Interactive product requirements discovery         |
| `/review-pr` | Structured PR review briefing                      |

### AI Context (`.ai/`)

Reference material automatically available to Claude Code.

| File                      | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| **UnitTestGeneration.md** | TypeScript/Jest unit testing style guide  |
| **UnitTestExamples.md**   | Working examples for the test style guide |
| **workflow.md**           | Multi-agent development workflow guide    |

## The Workflow

```
/pm → docs/briefs/[feature].md → /architect → docs/build-plans/[feature].md → /build
```

- **`/pm`** and **`/architect`** are interactive — back-and-forth conversations that produce documents
- **`/build`** is autonomous — orchestrates dev, review, and test agents with automatic fix loops
- Agents communicate only through the filesystem. No shared context. This is intentional.

See `.ai/workflow.md` after syncing for the full workflow guide.

## Project-Specific Configuration

The sync does **not** copy `settings.local.json` or `settings.json` — those are project-specific. See the [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code) for configuring permissions per-project.

## Requirements

- Node.js >= 22
- Claude Code
- GitHub CLI (`gh`) — required for `/review-pr` and PR-related operations

## Development

```bash
pnpm install
pnpm build       # Compile TypeScript → dist/
pnpm test        # Run test suite
```

Versioning is managed with [changesets](https://github.com/changesets/changesets). To propose a version bump:

```bash
pnpm changeset
```
