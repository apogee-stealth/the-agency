# Build Plan: Retrospective

## Context Source

Product brief at `docs/briefs/retrospective.md`. Design decisions made through interactive `/architect` session.

## Problem Summary

The Agency's pipeline generates structured reports on every run (dev reports, review reports, test reports, fix loop records) but these artifacts are throwaway. The pipeline never reads its own output. Patterns that emerge across builds — recurring review findings, repeated fix loop failures, test coverage blind spots — are invisible to future runs.

The retrospective feature closes that loop: a new agent mines pipeline reports to extract patterns into per-feature retro files, a new interactive command consolidates those patterns into shared lessons-learned, and the existing pipeline agents read that accumulated knowledge on future runs.

## Technical Approach

Two new template files (a retrospective agent and a `/retrospective` command) plus surgical additions to three existing agent prompts (dev, reviewer, test-hardener). The retrospective agent runs as Phase 4 of `/auto-build` after test hardening, extracting patterns from pipeline reports into a structured retro file at `.ai/retro/retro-[feature-name].md`. It also runs on pipeline failure — writing what it can from whatever reports exist — but does not change the failure contract (no commit, no PR on failure).

The `/retrospective` command is interactive-only, run on main after merges. It reads unprocessed retro files, presents findings grouped by concern, lets the user accept/modify/reject/merge lessons, writes accepted lessons to `.ai/lessons-learned.md`, and archives processed retro files.

A starter `lessons-learned.md` template is added to `.ai/` and synced to consumers via the manifest. The `.ai/retro/` directory is a runtime artifact — never synced.

## Key Design Decisions

- **Decision**: Retro files and lessons-learned both live under `.ai/`
    - **Why**: They're AI context consumed by agents at runtime, not human documentation. The manifest controls what gets synced — `.ai/retro/` is excluded.
    - **Trade-off**: Mixes distributed templates and runtime artifacts under the same root. Acceptable because the sync tool respects the manifest, not directory structure.

- **Decision**: Retro file schema uses five fixed pattern categories (Review Findings, Fix Loop Triggers, Test Coverage Gaps, Build Plan Deviations, Known Gaps)
    - **Why**: Predictable structure lets the `/retrospective` command parse mechanically and agents extract relevant sections.
    - **Trade-off**: Rigid categories may miss novel pattern types. Acceptable for MVP — categories cover the signal sources identified in the brief.

- **Decision**: `lessons-learned.md` organized by concern (Review Patterns, Fix Loop Triggers, Test Coverage Priorities, Code Patterns), not by feature
    - **Why**: Agents need to find "what do I need to know about testing" quickly, not "what happened on feature X." The `/retrospective` command transposes per-feature findings into per-concern lessons.
    - **Trade-off**: Loses per-feature narrative. Source attribution on each lesson preserves traceability.

- **Decision**: Retro agent runs on pipeline failure too, not just success
    - **Why**: Failed pipelines produce the richest signal — exhausted fix loops, unresolvable review failures. Skipping those wastes the best learning opportunities.
    - **Trade-off**: Retro agent must handle partial report sets (some reports won't exist if the pipeline died early). On failure, the retro file is written locally but not committed — auto-build's failure contract (no commit, no PR) is unchanged.

- **Decision**: Agents read both `lessons-learned.md` and unconsolidated `retro-*.md` files
    - **Why**: Retro files may sit unconsolidated for days between `/retrospective` runs. Feature branches created during that window would miss recent patterns if they only read `lessons-learned.md`.
    - **Trade-off**: Two context sources instead of one. Mitigated by framing: lessons-learned is canonical, retro files are "recent and unprocessed."

- **Decision**: No automated staleness detection or interactive pruning workflow for `lessons-learned.md`
    - **Why**: The command doesn't have context to know what's stale — only the human does. Walking through every existing lesson during consolidation turns a quick session into a slog.
    - **Trade-off**: File grows without automated pressure to shrink. Mitigated by a reminder at the end of `/retrospective` telling the user to periodically review and prune manually.

- **Decision**: `/build` does NOT auto-chain the retro agent
    - **Why**: `/build` is manually-gated — the user controls each phase. Adding an automatic retro step breaks that contract. The user can invoke the retrospective agent manually after `/build` completes.
    - **Trade-off**: Users of `/build` must remember to run the retro agent. Acceptable — `/build` users are already in manual-control mode.

## Scope Contract

- **In scope**: `src/templates/.claude/agents/`, `src/templates/.claude/commands/`, `src/templates/.ai/`, `src/manifest.ts`
- **Out of scope**: `src/` (CLI sync tool code), `dist/`, `bin/`, `src/review-plugins/`, any existing `.ai/` files other than adding the new template
- **New dependencies**: None

## Existing Patterns to Follow

- Agent files use YAML frontmatter (`name`, `description`, `tools`, `model`) — see any existing agent in `src/templates/.claude/agents/`
- Command files are pure markdown, no frontmatter — see any existing command in `src/templates/.claude/commands/`
- Manifest entries in `src/manifest.ts` follow `{ file: "filename.md", description: "..." }` format
- Agents communicate through files in `docs/reports/` — the retro agent reads from there, writes to `.ai/retro/`
- All current agents use `model: sonnet`
- Agent Input sections use numbered lists for file reads, with conditional language ("if it exists")

## Implementation Tasks

### Task 1: Retrospective Agent

- **What**: Create the retrospective agent template. It reads pipeline report files for a feature and writes a structured retro file.
- **Files**: Create `src/templates/.claude/agents/retrospective.md`
- **Details**:
    - Frontmatter: `name: retrospective`, `description: Extracts patterns from pipeline reports into per-feature retro files`, `tools: Read, Write, Glob, Bash`, `model: sonnet`
    - Input section: reads `docs/reports/dev-report-[feature-name].md`, `docs/reports/review-report-[feature-name].md`, `docs/reports/test-report-[feature-name].md`, and any `docs/reports/review-fixes-[feature-name].md` files. All reads are conditional — work with whatever exists, note what's missing.
    - Output: writes to `.ai/retro/retro-[feature-name].md` using this schema:

        ```markdown
        # Retrospective: [Feature Name]

        ## Feature

        - **Name**: [feature-name]
        - **Branch**: [branch-name]
        - **Date**: [YYYY-MM-DD]

        ## Pipeline Summary

        - **Dev**: [pass/fail, fix loops count]
        - **Review**: [verdict, fix loops count]
        - **Test Hardening**: [verdict, fix loops count]

        ## Patterns Found

        ### Review Findings

        - [Finding]: [context, frequency if recurring]

        ### Fix Loop Triggers

        - [What caused the loop]: [root cause]

        ### Test Coverage Gaps

        - [Gap]: [what was missing and why]

        ### Build Plan Deviations

        - [Deviation]: [what changed and why]

        ### Known Gaps

        - [Gap flagged by dev agent]: [context]
        ```

    - Creates `.ai/retro/` directory if it doesn't exist (via `mkdir -p`)
    - If a section has no findings, write `- None` under that heading
    - Agent does NOT read git history, code files, or `lessons-learned.md` — report files are the only input

- **Basic Tests**: Manifest integration test (Task 5 covers this)
- **Done when**: Agent file exists with correct frontmatter, input/output sections, schema, and constraints

### Task 2: `/retrospective` Command

- **What**: Create the interactive retrospective command that consolidates retro files into lessons-learned.
- **Files**: Create `src/templates/.claude/commands/retrospective.md`
- **Details**:
    - Pure markdown, no frontmatter (follows command conventions)
    - Flow:
        1. **Discovery**: Glob `.ai/retro/retro-*.md` (not in `archive/`). If none found, tell the user and stop.
        2. **Summarize**: Read all unprocessed retro files. Present findings grouped by lessons-learned categories: Review Patterns, Fix Loop Triggers, Test Coverage Priorities, Code Patterns. Show which features contributed each finding.
        3. **Curate**: Walk through each proposed lesson interactively. User can accept, modify, reject, or merge with an existing lesson.
        4. **Write**: Update `.ai/lessons-learned.md` with accepted/modified lessons. Create it if it doesn't exist. Merge into existing sections — do not overwrite.
        5. **Archive**: Move processed retro files to `.ai/retro/archive/` (create directory if needed).
        6. **Remind**: Print a reminder that `lessons-learned.md` should be periodically reviewed and pruned manually.
    - Conflict handling: If two retro files contain contradictory patterns, surface both and let the user decide.
    - `lessons-learned.md` schema:

        ```markdown
        # Lessons Learned

        ## Review Patterns

        - **[Pattern]**: [What to do or avoid] — _Source: [feature-name(s)]_

        ## Common Fix Loop Triggers

        - **[Trigger]**: [How to avoid it] — _Source: [feature-name(s)]_

        ## Test Coverage Priorities

        - **[Area/Pattern]**: [What to watch for] — _Source: [feature-name(s)]_

        ## Code Patterns

        - **[Pattern]**: [Guidance] — _Source: [feature-name(s)]_
        ```

- **Basic Tests**: Manifest integration test (Task 5 covers this)
- **Done when**: Command file exists with complete flow, schema definitions, and interactive curation instructions

### Task 3: `lessons-learned.md` Starter Template

- **What**: Create the starter template that gets synced to consumer projects.
- **Files**: Create `src/templates/.ai/lessons-learned.md`
- **Details**:
    - Skeleton file with section headers and no content:

        ```markdown
        # Lessons Learned

        ## Review Patterns

        ## Common Fix Loop Triggers

        ## Test Coverage Priorities

        ## Code Patterns
        ```

    - This is the file agents check for. An empty template is harmless — agents see it, find no lessons, proceed normally.

- **Basic Tests**: Manifest integration test (Task 5 covers this)
- **Done when**: Template file exists with correct section headers

### Task 4: Agent Prompt Updates

- **What**: Add conditional context reads to the dev, reviewer, and test-hardener agent Input sections.
- **Files**: Modify `src/templates/.claude/agents/dev.md`, `src/templates/.claude/agents/reviewer.md`, `src/templates/.claude/agents/test-hardener.md`
- **Details**:
    - Add to each agent's Input section (as additional numbered items):
        - `If .ai/lessons-learned.md exists, read it for accumulated project lessons. Apply relevant lessons to your work.`
        - `If any .ai/retro/retro-*.md files exist, read them for recent patterns not yet consolidated into lessons-learned.`
    - These are conditional reads — non-blocking, no behavioral change when files don't exist
    - Placement: after existing input items, before any fix-loop or scope-contract items
    - Keep additions minimal — two bullet points per agent, no rewrites
- **Basic Tests**: Visual inspection that the additions are syntactically consistent with existing Input sections
- **Done when**: All three agents have the two new input items, existing behavior is unchanged when context files don't exist

### Task 5: `/auto-build` Integration

- **What**: Add retrospective as Phase 4, renumber subsequent phases, add failure-path invocation.
- **Files**: Modify `src/templates/.claude/commands/auto-build.md`
- **Details**:
    - **New Phase 4: Retrospective**
        - After Phase 3 (Test Hardening) passes, delegate to the **retrospective** subagent
        - Tell it the feature name and where to find the reports
        - After it completes, read the retro file and note it in the pipeline summary
        - If the retro agent fails, log the failure and continue to Phase 5 — retro failure is NOT a pipeline blocker
    - **Renumber**: Commit becomes Phase 5, Auto Prep PR becomes Phase 6
    - **Update constraint**: "Phases 5 and 6 only run if Phases 1-3 succeed" (was "Phases 4 and 5")
    - **Failure path**: Before producing the failure summary, invoke the retro agent with whatever reports exist. If the retro agent also fails, note it and produce the failure summary anyway. No commit on failure — this is unchanged.
    - **Pipeline diagram update**:
        ```
        Dev -> Review -> [Fix loop] -> Test Hardener -> [Fix loop] -> Retrospective -> Commit -> Auto Prep PR -> Done
        ```
    - **Completion summary template**: Add `- **Retrospective**: [retro file location, or "skipped — agent failed"]`
    - **Failure summary template**: Add `- Retrospective: [retro file location if written, or "not generated"]` to the Reports section
- **Basic Tests**: Manifest already includes auto-build.md — no manifest change needed
- **Done when**: auto-build.md has Phase 4 (Retrospective), renumbered phases, updated constraints, failure-path retro invocation, and updated summary templates

### Task 6: Manifest Updates

- **What**: Add the retrospective agent, command, and lessons-learned template to the manifest.
- **Files**: Modify `src/manifest.ts`
- **Details**:
    - `agents` array: add `{ file: "retrospective.md", description: "Extracts patterns from pipeline reports into per-feature retro files" }`
    - `commands` array: add `{ file: "retrospective.md", description: "Interactive consolidation of retro files into lessons-learned" }`
    - `ai` array: add `{ file: "lessons-learned.md", description: "Accumulated lessons from retrospective analysis" }`
    - `.ai/retro/` is NOT added — runtime artifact directory
- **Basic Tests**: Run `pnpm test` to verify manifest tests pass (existing tests validate manifest structure). Add test coverage for the three new entries if the existing manifest test pattern supports it.
- **Done when**: All three entries present in manifest, `pnpm test` passes, `pnpm build` passes

## Technical Risks

- **Risk**: Retro files accumulate on main if users forget to run `/retrospective`
    - **Mitigation**: The files are small markdown. Accumulation is a minor annoyance, not a system failure. The reminder at the end of `/retrospective` nudges periodic cleanup. Could add a count warning in auto-build later if needed.
    - **Likelihood**: Medium

- **Risk**: Feature name collisions — two branches with the same name produce `retro-[feature-name].md` files that collide on trunk
    - **Mitigation**: Feature names are typically unique (tied to ticket IDs or descriptive slugs). Document the constraint. Not worth building collision resolution for MVP.
    - **Likelihood**: Low

- **Risk**: `lessons-learned.md` grows large enough to add meaningful token cost to every agent run
    - **Mitigation**: Manual pruning via `/retrospective` reminder. File is flat markdown — easy to trim. Revisit if it exceeds ~100 lines after several months of use.
    - **Likelihood**: Low (short-term), Medium (long-term)

- **Risk**: Retro agent produces low-quality extractions from reports — generic findings that don't encode actionable lessons
    - **Mitigation**: The `/retrospective` command's curation step is the quality gate. Bad extractions get rejected. Agent prompt can be tuned based on early output quality.
    - **Likelihood**: Medium

## Dependencies

None. All changes are markdown templates and a TypeScript manifest file. No new packages, services, or APIs.

## Handoff Notes for Developer

- **The symlinks matter.** `.claude/` and `.ai/` in the repo root are symlinks to `src/templates/.claude/` and `src/templates/.ai/`. Edit files in `src/templates/` — that's canonical. The symlinks mean your changes are immediately testable in this repo.

- **Agent prompt additions are surgical.** Two bullet points added to each agent's Input section. Do not rewrite or reorganize existing content. Match the numbering and formatting of the existing items exactly.

- **`/auto-build` phase renumbering is mechanical but touches multiple places.** The phase headers, the constraint text, the pipeline diagram, and both summary templates (completion and failure) all reference phase numbers or names. Don't miss any.

- **The retro agent's failure-path behavior in auto-build is important.** On success: retro runs, then commit. On failure: retro runs, then failure summary, NO commit. The retro agent failing is never a pipeline blocker in either path.

- **Test the manifest changes.** `pnpm build` and `pnpm test` should both pass. The existing test suite validates manifest structure — the new entries need to conform.

- **`lessons-learned.md` template is intentionally empty.** Just headers, no placeholder content. Agents check "if it exists" and find no lessons — that's the correct first-run behavior. Don't add example lessons or instructional text.
