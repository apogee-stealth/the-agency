# Claude Code: Multi-Agent Development Workflow

A phased development workflow for Claude Code with two entry points per persona: **interactive commands** for collaborative design, and **autonomous agents** for execution in isolated context windows.

## Setup

```bash
# Install the package
npm install -D @apogeelabs/the-agency

# Sync all agents, commands, and AI context files to your project
npx the-agency sync

# Or choose which files to sync
npx the-agency sync --pick

# Create the docs directories used by the workflow
mkdir -p docs/{briefs,build-plans,reports}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  INTERACTIVE COMMANDS (conversational, separate sessions)       │
│                                                                 │
│  /pm  ──→  docs/briefs/feature.md                               │
│  /architect  ──→  docs/build-plans/feature.md                   │
│                                                                 │
│  These are for when you want to THINK TOGETHER.                 │
│  Start a fresh session for each one.                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                   (handoff via files)
                            │
┌─────────────────────────────────────────────────────────────────┐
│  AUTONOMOUS AGENTS (isolated context, file-based communication) │
│                                                                 │
│  These are the SAME PERSONAS as above, but autonomous.          │
│  Use when you trust the output pattern.                         │
│                                                                 │
│  pm agent  ──→  docs/briefs/feature.md                          │
│  architect agent  ──→  docs/build-plans/feature.md              │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                   │
│  │ dev      │──→│ reviewer  │──→│ test-    │                   │
│  │ agent    │   │ agent     │   │ hardener │                   │
│  │          │   │           │   │ agent    │                   │
│  │ Writes   │   │ Read-only │   │ Writes   │                   │
│  │ code +   │   │ review    │   │ tests    │                   │
│  │ tests    │   │           │   │ only     │                   │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘                   │
│       ▼              ▼              ▼                           │
│   dev-report    review-report   test-report                     │
│                                                                 │
│   ◄── fix loops if review/test fail ──►                        │
│                                                                 │
│  explorer agent  ──→  docs/codebase-map.md                      │
│                                                                 │
│  /build  ──→  orchestrates: dev → review → test                 │
└─────────────────────────────────────────────────────────────────┘
```

## Commands & Agents Reference

### Interactive Commands (`.claude/commands/`)

| Command      | What it does                              | Entry point for             |
| ------------ | ----------------------------------------- | --------------------------- |
| `/pm`        | Collaborative requirements discovery      | Defining what to build      |
| `/architect` | Collaborative technical design            | Designing how to build it   |
| `/build`     | Orchestrates the agent execution pipeline | Running dev → review → test |

### Autonomous Agents (`.claude/agents/`)

| Agent           | Tools                               | Context  | What it does                                   |
| --------------- | ----------------------------------- | -------- | ---------------------------------------------- |
| `pm`            | Read, Write, Edit, Glob, Grep       | Isolated | Drafts a product brief from notes              |
| `architect`     | Read, Write, Edit, Glob, Grep, Bash | Isolated | Drafts a build plan from a brief or notes      |
| `dev`           | Read, Write, Edit, Glob, Grep, Bash | Isolated | Implements build plan, writes happy-path tests |
| `reviewer`      | Read, Glob, Grep, Bash              | Isolated | Read-only code review, produces verdict        |
| `test-hardener` | Read, Write, Edit, Glob, Grep, Bash | Isolated | Writes edge case & failure mode tests          |
| `explorer`      | Read, Glob, Grep, Bash              | Isolated | Maps and documents the codebase (read-only)    |

Note: `reviewer` and `explorer` are deliberately read-only — they can't modify project code.

## Workflows

### Starting Out (Interactive, Maximum Control)

When you're still learning the workflow or need to iterate heavily:

```bash
# Session 1: Define the feature
claude> /pm
# ... back-and-forth until brief is right
# Output: docs/briefs/feature.md

# Session 2: Design the approach (fresh session!)
claude> /architect
# ... back-and-forth until plan is right
# Output: docs/build-plans/feature.md

# Session 3: Execute the pipeline
claude> /build
# ... confirms once, then runs dev → review → test automatically
# ... only stops if fix loops are exhausted
```

### Maturing Workflow (Mix of Interactive and Autonomous)

When you trust the brief pattern but still want to discuss architecture:

```bash
# Autonomous: draft a brief from your notes
claude> Use the pm agent to draft a brief from these notes: [paste notes]
# Review docs/briefs/feature.md, edit if needed

# Session: Interactive architecture discussion
claude> /architect
# ... iterate on design

# Execute
claude> /build
```

### Full Autonomous (Trust the Pipeline)

When you've done this enough to trust the drafts:

```bash
# Autonomous brief and plan
claude> Use the pm agent to draft a brief, then the architect agent to create a build plan
# Review both docs, edit if needed

# Execute
claude> /build
```

### CTO-Hands-You-a-Napkin

```bash
# Skip PM entirely, architect works from whatever you've got
claude> /architect
# ... paste notes, describe the feature, iterate

claude> /build
```

### New Repo, Who Dis

```bash
claude> Use the explorer agent to map this codebase
# Review docs/codebase-map.md

claude> /architect
# ... architect now knows the codebase patterns

claude> /build
```

### Just Need a Review

```bash
claude> Use the reviewer agent to review the auth module changes
```

## How Fix Loops Work

The `/build` orchestrator handles failures:

1. **Review fails** (🔴) → extracts must-fix items → fresh dev agent reads only the fixes file → commits fixes → re-runs review → max 2 loops
2. **Test hardening fails** (🐛) → same pattern for bugs

The user approves once at the start of the pipeline. After that, fix loops run automatically, capped at 2 per phase. The only mid-pipeline interruption is escalation when a fix loop is exhausted.

## Git Workflow

The pipeline manages git automatically:

1. **Orchestrator** creates a feature branch: `[TASK-ID]-[feature-name]` (e.g., `DEV-2315-user-email-validation`)
2. **Dev agent** commits after each task with conventional commit prefixes (`feat:`, `fix:`, `refactor:`, etc.)
3. **Test hardener** commits its new test files (`test:` prefix)
4. **Fix loop commits** use `fix:` prefix and reference what was fixed
5. **Orchestrator** commits reports at the end (`docs:` prefix)

The result is a branch with clean, atomic, per-task commits:

```
git log --oneline main..HEAD

a1b2c3d DEV-2315 Add build reports for user-auth
f4e5d6c DEV-2315 Add edge case and failure mode tests for user-auth
9a8b7c6 DEV-2315 Fix null user.address per review feedback
3d2e1f0 DEV-2315 Add auth token refresh logic
b4c5d6e DEV-2315 Add login endpoint with validation
7f8e9d0 DEV-2315 Add user model and migration
```

At completion, the orchestrator gives you the branch name and commit history. You choose how to land it — merge, squash, open a PR, whatever fits your workflow.

⚠️ **Protected branches**: The dev agent verifies it's on a feature branch before every commit. If it somehow finds itself on `main`/`master`/`develop`, it stops and reports the error rather than committing.

## Document Flow

```
docs/briefs/[feature].md          ← PM output
docs/build-plans/[feature].md     ← Architect output
docs/codebase-map.md              ← Explorer output
docs/reports/
  ├── dev-report-[feature].md     ← Dev agent output
  ├── review-report-[feature].md  ← Review agent output
  ├── review-fixes-[feature].md   ← Fix loop items (if triggered)
  └── test-report-[feature].md    ← Test agent output
```

## Directory Structure

```
.claude/
├── commands/                # Interactive slash commands
│   ├── pm.md               # /pm → conversational requirements
│   ├── architect.md         # /architect → conversational design
│   └── build.md             # /build → pipeline orchestrator
└── agents/                  # Autonomous subagents (isolated context)
    ├── pm.md                # Brief drafting
    ├── architect.md         # Build plan drafting
    ├── dev.md               # Implementation
    ├── reviewer.md          # Code review (read-only)
    ├── test-hardener.md     # Test hardening
    └── explorer.md          # Codebase mapping (read-only)

.ai/
├── UnitTestGeneration.md    # Testing style guide
├── UnitTestExamples.md      # Testing examples
└── workflow.md              # This file

docs/
├── briefs/                  # PM outputs
├── build-plans/             # Architect outputs
├── reports/                 # Agent execution reports
└── codebase-map.md          # Explorer output
```

## Choosing Interactive vs. Autonomous

Use **interactive commands** (`/pm`, `/architect`) when:

- You're still figuring out what to build
- Requirements are vague and need discussion
- You want to challenge assumptions and explore trade-offs
- You're early in adopting this workflow

Use **autonomous agents** when:

- You have clear input (notes, brief, description) and trust the agent to draft well
- You want a first draft to react to rather than building from scratch
- You've used the interactive versions enough to know what good output looks like

## Customization

### Things Worth Tuning

- **Code standards** in `agents/dev.md` — replace with your team's conventions
- **Review criteria** in `agents/reviewer.md` — tune must-fix vs. consider thresholds
- **Test priorities** in `agents/test-hardener.md` — focus on your domain's risk areas
- **Build plan template** in architect files — swap in your team's RFC/ADR format
- **Fix loop cap** in `commands/build.md` — default is 2, adjust to taste
- **Model selection** in agent frontmatter — default is `sonnet`, bump to `opus` for critical phases

### Agent Tool Access

Tools are intentionally restricted per agent:

- `reviewer` and `explorer` are **read-only** (no Write/Edit) — they observe and report
- `dev` and `test-hardener` have full access — they need to create and modify files
- Adjust in the YAML frontmatter `tools:` field
