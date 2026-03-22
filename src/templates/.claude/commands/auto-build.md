# Auto Build — Fully Autonomous Pipeline

## Goal

Execute the full development pipeline autonomously: build (dev → review → test-hardener), commit, and create a draft PR. No manual gates, no pauses for input. The human gets a draft PR at the end, or a failure report if something breaks.

This is the autonomous counterpart to `/build`, which keeps manual checkpoints. Use `/build` when you want control over each phase. Use `/auto-build` when you want to hand off the whole thing.

## Input

You need two things:

1. **A build plan.** Ask which plan to execute, or check `docs/build-plans/` for available plans. If none exists, stop and tell the user to run `/architect` or the architect agent first.
2. **A target branch** (optional). Defaults to `main`. This gets passed through to auto-prep-pr at the end.

## Constraints

1. **Fully autonomous.** Do not pause for input at any point. Report what happened and move on.
2. **Delegate to subagents.** Do NOT simulate personas. Use the actual subagents so they get isolated context.
3. **Subagents communicate ONLY through files.** Build plans, reports, and the codebase itself. Never pass conversation context.
4. **Cap fix loops at 2 per phase.** If it's still failing after 2 fix loops, stop. The human needs to look at it.
5. **Report what happened, not what the agent said.** Read the output files and summarize.
6. **Do not commit or create a PR if the build pipeline fails.** Phases 5 and 6 only run if Phases 1-3 succeed.

## Pipeline Markers

External systems (e.g., TPS) watch PTY output for structured markers to trigger workflow automations. You MUST output these markers exactly as specified — they are line-start anchored headings matched by regex.

**Phase markers** — output at the START of each phase:

```
## Phase 1: Development
## Phase 2: Code Review
## Phase 3: Test Hardening
## Phase 4: Retrospective
## Phase 5: Committing
## Phase 6: Preparing Draft PR
```

**Fix loop markers** — output when entering a fix loop:

```
## Fix Loop [N]: [Source Phase] → Dev
```

Example: `## Fix Loop 1: Code Review → Dev`

**Completion markers** — output at the end of the pipeline:

```
## Commit Complete: [short hash]
## Auto Build Complete: [Feature Name]
```

**Failure markers** — output when the pipeline fails:

```
## Auto Build Failed: [Feature Name]
```

These markers must appear on their own line at the start of output, not buried inside code blocks or report summaries.

## Setup

Before starting, ensure the reports directory exists:

```
mkdir -p docs/reports
```

## The Pipeline

```
Dev → Review → [Fix loop if needed] → Test Hardener → [Fix loop if needed] → Retrospective → Commit → Auto Prep PR → Done
```

## Phase 1: Development

Output this marker before delegating:

```
## Phase 1: Development
```

Delegate to the **dev** subagent. Tell it:

- Which build plan to read: `docs/build-plans/[feature-name].md`
- To check `docs/codebase-map.md` if it exists
- To write its report to `docs/reports/dev-report-[feature-name].md`
- If a file exists at `docs/reports/review-fixes-[feature-name].md`, it's a FIX LOOP — fix only those issues

**After the dev agent completes**: Read `docs/reports/dev-report-[feature-name].md`. Note what was built and any deviations from the plan. Then run the validation gate.

### Validation Gate

After each dev agent run (initial or fix loop), run the project's checks before proceeding:

1. Lint (e.g., `pnpm lint`) — if the project has a lint script
2. Test (e.g., `pnpm test`) — if the project has a test script
3. Build (e.g., `pnpm build`) — if the project has a build script

Check `package.json` for available scripts. Skip any that don't exist.

If any check fails, output the fix loop marker before re-entering Phase 1:

```
## Fix Loop [N]: Validation → Dev
```

Send the failures back to the dev agent as a fix loop (same 2-loop cap). Do NOT proceed to review with broken lint, tests, or build. If the dev agent cannot resolve the failures within 2 fix loops, produce a failure summary and stop.

Once the validation gate passes, proceed to Phase 2.

## Phase 2: Code Review

Output this marker before delegating:

```
## Phase 2: Code Review
```

Delegate to the **reviewer** subagent. Tell it:

- The feature name and build plan location
- To read the dev report at `docs/reports/dev-report-[feature-name].md`
- To write its review to `docs/reports/review-report-[feature-name].md`

**After the review agent completes**: Read `docs/reports/review-report-[feature-name].md`.

### If verdict is FAIL:

1. Extract the must-fix items into `docs/reports/review-fixes-[feature-name].md`
2. Output the fix loop marker before re-entering Phase 1:
    ```
    ## Fix Loop [N]: Code Review → Dev
    ```
3. Go back to Phase 1 (the dev agent will see the fixes file)
4. After fixes, re-run Phase 2
5. **Max 2 fix loops.** If it fails a third time, produce a failure summary and stop.

### If verdict is PASS WITH FIXES:

Note the should-fix items in the final summary. Proceed to Phase 3.

### If verdict is PASS:

Proceed to Phase 3.

## Phase 3: Test Hardening

Output this marker before delegating:

```
## Phase 3: Test Hardening
```

Delegate to the **test-hardener** subagent. Tell it:

- The feature name and build plan location
- To read the review report at `docs/reports/review-report-[feature-name].md`
- To write its report to `docs/reports/test-report-[feature-name].md`

**After the test agent completes**: Read `docs/reports/test-report-[feature-name].md`.

### If verdict is FAIL (bugs found):

1. Extract bugs into `docs/reports/review-fixes-[feature-name].md`
2. Output the fix loop marker before re-entering Phase 1:
    ```
    ## Fix Loop [N]: Test Hardening → Dev
    ```
3. Loop back to Phase 1 for fixes, then re-run Phase 3
4. **Max 2 fix loops.** If it persists, produce a failure summary and stop.

### If verdict is PASS or PASS WITH GAPS:

Proceed to Phase 4.

## Phase 4: Retrospective

Output this marker before delegating:

```
## Phase 4: Retrospective
```

Delegate to the **retrospective** subagent. Tell it:

- The feature name
- To find its reports in `docs/reports/`

**After the retrospective agent completes**: Read `.ai/retro/retro-[feature-name].md` and note it in the pipeline summary.

**If the retro agent fails**: Log the failure and continue to Phase 5. Retrospective failure is NOT a pipeline blocker.

## Phase 5: Commit

Output this marker before starting:

```
## Phase 5: Committing
```

All three phases passed. Time to commit.

1. Read the dev report at `docs/reports/dev-report-[feature-name].md` to understand what was changed and any suggested commit structure.
2. Run `git status` to see all changed files.
3. Run `git diff --stat` to confirm the scope of changes matches expectations.
4. Stage the relevant files. Prefer staging specific files over `git add -A`. Do NOT stage:
    - Files in `docs/reports/` (these are pipeline artifacts, not deliverables)
    - `.env` files or anything that looks like credentials
    - Files unrelated to the build plan's scope contract
5. Write a clear commit message that summarizes the feature, referencing the build plan. Use the project's commit conventions (check recent `git log --oneline -10` for style).
6. Commit the changes.

If the commit fails (e.g., pre-commit hook), fix the issue and retry once. If it fails again, produce a failure summary and stop.

After a successful commit, output this marker with the short hash:

```
## Commit Complete: [short hash]
```

## Phase 6: Auto Prep PR

Output this marker before delegating:

```
## Phase 6: Preparing Draft PR
```

Delegate to the **auto-prep-pr** subagent. Tell it:

- The target branch (from input, or `main` if not specified)

The auto-prep-pr agent handles: fetching remote, diffing against `origin/$TARGET`, generating the PR description, pushing the branch, and creating the draft PR.

**After auto-prep-pr completes**: Report the draft PR URL.

## Completion

When all phases pass, produce a final summary:

```markdown
## Auto Build Complete: [Feature Name]

### Pipeline Summary

- **Dev**: [tasks completed, any deviations]
- **Review**: [verdict, key findings]
- **Test**: [verdict, coverage assessment, bugs found and fixed]
- **Retrospective**: [retro file location, or "skipped — agent failed"]
- **Commit**: [commit hash, files staged]
- **PR**: [draft PR URL]

### Fix Loops

[Number of times code went back for fixes, and why — or "None"]

### Should-Fix Items (Deferred)

[Any should-fix items from review that were noted but not blocking — or "None"]

### Reports

- Dev: docs/reports/dev-report-[feature-name].md
- Review: docs/reports/review-report-[feature-name].md
- Test: docs/reports/test-report-[feature-name].md
```

## Failure

When any phase exhausts its fix loops or encounters an unrecoverable error, invoke the **retrospective** subagent with whatever reports exist before producing the failure summary. If the retro agent also fails, note it and produce the failure summary anyway. No commit on failure — this is unchanged.

```markdown
## Auto Build Failed: [Feature Name]

### Failed Phase

- **Phase**: [Dev / Review / Test Hardening / Commit / PR]
- **Fix loops attempted**: [number]
- **Reason**: [Brief description of why it's still failing]

### What Passed

[List any phases that completed successfully before the failure, or "None"]

### Unresolved Issues

[The specific issues from the last review/test report that could not be resolved]

### Files Changed

[Consolidated list from dev report, if any work was done]

### Reports

- Dev: docs/reports/dev-report-[feature-name].md
- Review: docs/reports/review-report-[feature-name].md (if reached)
- Test: docs/reports/test-report-[feature-name].md (if reached)
- Retrospective: [retro file location if written, or "not generated"]
```
