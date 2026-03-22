# Product Brief: Retrospective

## Problem Statement

The Agency's multi-agent pipeline (pm → architect → dev → reviewer → test-hardener) generates structured reports on every run — dev reports, review reports, test reports, fix loop records — but these artifacts are throwaway. The pipeline never reads its own output. Every run starts from zero. Patterns that emerge across builds (recurring review findings, repeated fix loop failures, test coverage blind spots, anti-patterns in certain modules) are invisible to future runs.

Teams using The Agency accumulate institutional knowledge in those report files. Right now that knowledge rots in `docs/reports/` and is never extracted. The retrospective feature closes that loop: mine pipeline output to extract patterns, encode them as tribal knowledge, and feed that knowledge back into future pipeline runs so the agents get smarter over time without manual prompt engineering.

## Target User

Development teams using The Agency's pipeline (both `/build` and `/auto-build`) who run multiple features through the pipeline over time and want the pipeline to improve from its own experience — without having to manually curate feedback into agent prompts.

The interactive `/retrospective` command particularly serves the tech lead or senior developer who wants a human checkpoint before tribal knowledge gets encoded into the shared AI context.

## MVP Scope

### 1. Retrospective Agent (autonomous, per-feature)

A new `retrospective` agent that runs after a feature's pipeline is complete, on the feature branch. It mines the feature's pipeline reports and writes a per-feature retro file.

- Reads pipeline report files for the feature: dev report, review report, test report, and any fix loop records (all in `docs/reports/`)
- Extracts patterns worth encoding: recurring review findings, fix loop triggers, test coverage gaps found during hardening, deviations from the build plan, and any "Known gaps" flagged by the dev agent
- Writes a per-feature retro to `.ai/retro/retro-<feature-name>.md` using a defined schema (see User Stories)
- Does NOT read git history or diffs — report files are the only input
- Triggered as Phase 4 of `/auto-build` (after test hardening passes, before commit). The `/build` command does NOT auto-chain the retro agent — it can be invoked manually.

### 2. `/retrospective` Command (interactive, on trunk)

A new `/retrospective` command that runs on `main` after branch merges. It reads all per-feature retro files that haven't been consolidated yet, presents findings to the user, and merges accepted lessons into `.ai/lessons-learned.md`.

- Reads all `.ai/retro/retro-*.md` files
- Detects which ones are unprocessed (not yet consolidated — see Assumptions)
- Presents a summary of patterns found across retro files
- Allows the user to discuss, curate, and decide what gets encoded or discarded
- Merges accepted lessons into `.ai/lessons-learned.md` (creates it if it doesn't exist)
- Marks consolidated retro files as processed (moves them to `.ai/retro/archive/`)
- Prunes stale lessons from `lessons-learned.md` when the user explicitly indicates a lesson is outdated (e.g., the module it references was deleted)

### 3. Agent Prompt Updates

The dev, reviewer, and test-hardener agents each get an addition to their Input section instructing them to read context files if present:

- Read `.ai/lessons-learned.md` if it exists
- Read any `.ai/retro/retro-*.md` files if they exist

The instruction is a conditional read ("if it exists"), not a hard dependency. Agents that find no context files proceed normally.

### 4. Manifest and CLI Updates

- `.ai/lessons-learned.md` added to the `ai` section of the manifest
- The retrospective agent added to the `agents` section of the manifest
- The `/retrospective` command added to the `commands` section of the manifest
- `.ai/retro/` is NOT added to the manifest as a sync target — it is a project-local artifact directory generated at runtime, not a distributable template file

## Explicitly Out of Scope

- **Reading git history, diffs, or blame.** The agent works only from report files. Git mining is a potential v2 capability.
- **Automatic pruning of stale lessons.** Staleness detection (e.g., "this module no longer exists") is flagged for human review during the `/retrospective` command, not automated.
- **Cross-project knowledge sharing.** `lessons-learned.md` is per-project. No mechanism to export or import lessons between codebases.
- **Retrospective agent chaining from `/build`.** The manual-gated build command does not auto-invoke the retro agent. Manual invocation only.
- **Structured querying of lessons.** `lessons-learned.md` is a flat markdown file read by agents at runtime. No indexing, search API, or structured retrieval.
- **Retro agent reading other features' retro files.** The per-feature retro agent reads only the current feature's reports. Cross-feature synthesis is the job of `/retrospective` on trunk.
- **Versioning or conflict resolution for `lessons-learned.md`.** The single-writer model (only `/retrospective` on trunk writes to it) is the conflict avoidance strategy. Concurrent writes are not supported.
- **UI or dashboard for lessons.** All interaction is through the CLI and markdown files.
- **Retro files synced to consumers via `the-agency sync`.** Per-project retro files are local artifacts. Only the agent/command definitions are distributed.

## Assumptions Made

**Assumption 1: `/auto-build` Phase 4 is the retro agent trigger.** The notes say "after the pipeline completes" but don't specify the exact hook. I've placed it as Phase 4 of `/auto-build` (after test hardening passes, before commit). This keeps it inside the autonomous pipeline so retro files are on the branch when the PR is created, making them reviewable before merge.

**Assumption 2: `/build` does NOT auto-chain the retro agent.** The notes explicitly asked whether `/build` should auto-chain it. I've decided no — `/build` is the manually-gated command where the user controls each phase. Adding an automatic Phase 4 would break that contract. The user can invoke the retrospective agent manually after `/build` completes.

**Assumption 3: Per-feature retro files are archived (not deleted) after consolidation.** The notes ask "archived or deleted?" I've chosen archive (move to `.ai/retro/archive/`) over deletion. Deleting processed retro files creates an unrecoverable state if consolidation produces a bad lessons-learned entry. Archiving is reversible.

**Assumption 4: "Unprocessed" retro files are detected by presence in `.ai/retro/` (not `.ai/retro/archive/`).** The simplest possible staleness marker: files in the active directory are unprocessed, files in archive are done. No metadata file or frontmatter flag needed.

**Assumption 5: The retro agent does NOT add new phases to fix loops.** It reads reports but does not evaluate code quality or produce verdicts. It is purely a synthesis agent. If it fails to write its output file, `/auto-build` logs the failure and continues to commit — a missing retro file is not a pipeline blocker.

**Assumption 6: `lessons-learned.md` is structured markdown, not freeform.** For agents to consume it reliably, it needs predictable section headers. The exact schema is left to the architect, but the intent is structured-enough that agents can locate relevant lessons for the module/pattern they're working on.

**Assumption 7: The retro agent reads all report types for the feature, not just the dev report.** Dev report, review report, test report, and any fix loop records. The richest signal often comes from fix loop records and reviewer must-fix findings.

**Assumption 8: Agent context reads are conditional and non-blocking.** "Read `.ai/lessons-learned.md` if it exists" is the exact pattern. Agents with no prior lessons context behave identically to today. This preserves behavior for new projects or early pipeline runs.

## User Stories

- As a developer running `/auto-build`, I want a retro file generated automatically at the end of the pipeline so that I don't have to remember to do it manually.
    - Acceptance Criteria:
        - [ ] After test hardening passes in `/auto-build`, the retrospective agent is invoked automatically
        - [ ] The retro file is written to `.ai/retro/retro-<feature-name>.md` on the feature branch
        - [ ] If the retro agent fails, `/auto-build` logs the failure and continues to commit — it does not block the pipeline
        - [ ] The retro file is present in the branch when the PR is created

- As a tech lead merging feature branches, I want to run `/retrospective` on main to consolidate lessons from completed features into shared AI context so that future pipeline runs benefit from accumulated knowledge.
    - Acceptance Criteria:
        - [ ] `/retrospective` reads all `.ai/retro/retro-*.md` files not yet in the archive directory
        - [ ] It presents a summary of patterns found across all unprocessed retro files
        - [ ] The user can approve, modify, or reject individual lessons before they are encoded
        - [ ] Accepted lessons are written to `.ai/lessons-learned.md`
        - [ ] Processed retro files are moved to `.ai/retro/archive/` after consolidation
        - [ ] If `lessons-learned.md` already exists, new lessons are merged in (not overwritten)

- As the dev agent on a subsequent feature, I want to read accumulated lessons-learned before implementing so that I avoid patterns that have caused review failures or fix loops on previous features.
    - Acceptance Criteria:
        - [ ] The dev agent Input section instructs it to read `.ai/lessons-learned.md` if the file exists
        - [ ] The dev agent Input section instructs it to read `.ai/retro/retro-*.md` files if any exist
        - [ ] When no context files exist, the dev agent behaves identically to its current behavior

- As the reviewer agent on a subsequent feature, I want to be aware of recurring findings from previous reviews so that I prioritize known problem patterns.
    - Acceptance Criteria:
        - [ ] The reviewer agent Input section instructs it to read `.ai/lessons-learned.md` if it exists
        - [ ] The reviewer agent Input section instructs it to read `.ai/retro/retro-*.md` files if any exist

- As the test-hardener agent on a subsequent feature, I want to know which test coverage gaps have been found repeatedly so that I prioritize those areas.
    - Acceptance Criteria:
        - [ ] The test-hardener agent Input section instructs it to read `.ai/lessons-learned.md` if it exists
        - [ ] The test-hardener agent Input section instructs it to read `.ai/retro/retro-*.md` files if any exist

- As a consumer running `the-agency sync`, I want to receive the retrospective agent and command so that I can use the feature without manual file copying.
    - Acceptance Criteria:
        - [ ] The retrospective agent is listed in the `agents` section of `src/manifest.ts`
        - [ ] The `/retrospective` command is listed in the `commands` section of `src/manifest.ts`
        - [ ] `lessons-learned.md` is listed in the `ai` section of `src/manifest.ts`
        - [ ] `.ai/retro/` is NOT added to the manifest (it is a runtime artifact directory)

## Edge Cases & Open Questions

**What is the exact schema for `.ai/retro/retro-<feature-name>.md`?** The brief specifies intent (patterns, findings, fix loop triggers) but not the field structure. The architect needs to define this schema so the `/retrospective` consolidation step can reliably parse and merge entries.

**What is the exact schema for `.ai/lessons-learned.md`?** Similarly undefined. Needs to be structured enough for agents to use, but readable enough for humans to curate during the `/retrospective` session. This is a critical design decision that belongs in the build plan.

**How does the `/retrospective` command handle conflicts when two retro files contain contradictory lessons?** For example, Feature A learned "always do X in module Y" and Feature B learned "never do X in module Y." The interactive session gives the user a chance to resolve this, but the command needs to surface the conflict rather than silently picking one.

**What happens on the first `/retrospective` run when `lessons-learned.md` doesn't exist yet?** Assumption 6 says it's created. But what's the bootstrap content? Does it start with a header and empty sections, or is it written from scratch based on the first consolidation?

**Should the retro agent also run after a pipeline FAILURE?** The current scope places it after test hardening passes. But some of the richest learning signal comes from pipelines that failed — exhausted fix loops, unresolvable review failures. This is worth discussing before implementation.

**What's the staleness model for `lessons-learned.md` long-term?** The brief scopes out automatic pruning, but doesn't define what the human-driven pruning workflow looks like beyond "the user indicates a lesson is outdated." Does `/retrospective` show lessons with timestamps and ask the user to review them? Does it flag lessons referencing files that no longer exist in the repo?

**Can the retrospective agent be run standalone (outside `/auto-build`)?** The brief scopes the trigger as Phase 4 of `/auto-build`, but there's no explicit prohibition on invoking the agent directly for a feature that went through `/build`. Should the agent be robust to manual invocation, or tightly coupled to the auto-build pipeline?

**Naming collision risk:** If two branches have the same feature name, they'll produce `retro-<feature-name>.md` files that collide on trunk. The per-branch isolation strategy assumes unique feature names. This is worth a brief note in the build plan to document the constraint.

## Success Metrics

- Retro files are generated on feature branches without developer intervention when using `/auto-build`
- The `/retrospective` command consolidates lessons without requiring manual file editing by the user
- After 3+ features have been consolidated, the dev, reviewer, and test-hardener agents demonstrably reference lessons-learned content in their reports (qualitative signal, not automated measurement)
- Fix loop frequency decreases over time as recurring anti-patterns are encoded into lessons (leading indicator — hard to measure precisely, but reviewable in pipeline reports)
- Zero pipeline breakage: the retro agent failing does not block commits or PR creation

## Handoff Notes for Architect

**The schema decisions are load-bearing.** The retro file schema and `lessons-learned.md` schema need to be defined in the build plan before the dev agent touches anything. Both files are consumed by multiple agents; if the structure is ambiguous, agents will parse them inconsistently.

**File location conventions.** `.ai/retro/` follows the `.ai/` convention for AI context files. The archive subdirectory (`.ai/retro/archive/`) is introduced here as a new pattern. The architect should verify this doesn't create problems with the sync CLI (the manifest only distributes the template files, not runtime directories — but the sync tool may need to handle the case where `.ai/retro/` already exists in the consumer's project).

**Agent prompt additions are surgical, not a rewrite.** The Input section additions for dev, reviewer, and test-hardener are small — a conditional file read with a brief instruction on how to apply what's found. Keep them tightly scoped. These agents already have long prompts; this shouldn't add cognitive weight if nothing is found.

**`/auto-build` Phase numbering shifts.** Adding Phase 4 (retrospective) before the current Phase 4 (commit) means the existing phases need renumbering. The commit becomes Phase 5 and auto-prep-pr becomes Phase 6. The failure summary template also references phase names and will need updating.

**The `/retrospective` command is interactive by design.** Unlike `/auto-build`, this should NOT be converted to a fully autonomous flow. Human curation before encoding is the point — it's the quality gate between raw pipeline signal and persistent AI context. Resist any pressure to automate this away.

**Test coverage:** The retrospective agent's file-writing behavior and the manifest additions are testable. The `/retrospective` command's interactive flow is harder to unit-test but the consolidation logic (merge, dedup, archive) should have coverage.
