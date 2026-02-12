## Multi-Agent Development Workflow

This project uses a phased development workflow with two modes of operation:

### Interactive Commands (for design and discovery)

Run these as slash commands in a Claude Code session. They're conversational — expect back-and-forth.

- `/pm` — Product Manager: Collaborate to define features, scope MVP, write user stories
- `/architect` — Architect: Collaborate to design technical approach, create build plan

**Start a fresh session for each command.** The PM and architect are deliberately separate contexts. The handoff document (brief or build plan) carries the context between them.

### Autonomous Agents (for execution)

These run as subagents with isolated context windows. They read files, do their job, write reports.

- **pm** — Draft a product brief from notes/descriptions (when you trust the output pattern)
- **architect** — Draft a build plan from a brief or notes (when you trust the output pattern)
- **dev** — Implement a build plan, task by task, with happy-path tests
- **reviewer** — Adversarial code review with fresh eyes (read-only)
- **test-hardener** — Edge case testing, failure modes, tries to break things
- **explorer** — Map and document an unfamiliar codebase (read-only)

### Orchestrator

- `/build` — Runs the execution pipeline: dev → review → test, with automatic fix loops

### Document Flow

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

### Key Principle

Agents have zero shared context. Communication between phases happens through the filesystem only. This is intentional — it eliminates cognitive bleed between personas.

### Choosing Interactive vs. Autonomous

Use **interactive commands** (`/pm`, `/architect`) when:

- You're still figuring out what to build
- Requirements are vague and need discussion
- You want to challenge assumptions and explore trade-offs
- You're early in adopting this workflow

Use **autonomous agents** when:

- You have clear input (notes, brief, description) and trust the agent to draft well
- You want a first draft to react to rather than building from scratch
- You've used the interactive versions enough to know what good output looks like
