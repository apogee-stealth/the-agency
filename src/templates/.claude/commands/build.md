# Build Orchestrator

## Goal

Execute the development pipeline for a feature by delegating to specialized subagents (dev → review → test-hardener) with fix loops as needed. Each subagent runs in its own isolated context window — they communicate only through files.

## Constraints

1. **Delegate to subagents.** Do NOT try to simulate a persona by changing your own behavior. Use the actual subagents so they get isolated context.
2. **Subagents communicate ONLY through files.** Build plans, reports, and the codebase itself. Never pass conversation context.
3. **Proceed automatically between phases.** Do not ask the user for permission to continue. Report what happened and move on. The user can interrupt if needed.
4. **Cap fix loops at 2 per phase.** If it's still failing, the human needs to look at it.
5. **Report what happened, not what the agent said.** Read the output files and summarize.

## Required Input

You need a build plan. Ask the user which build plan to execute, or check `docs/build-plans/` for available plans.

If no build plan exists, tell the user to run `/architect` (interactive) or use the architect agent (autonomous) first.

## Setup

Before starting, ensure the reports directory exists:

```
mkdir -p docs/reports
```

## The Pipeline

```
Dev Agent → Review Agent → [Fix loop if needed] → Test Agent → [Fix loop if needed] → Done
```

## Phase 1: Development

Delegate to the **dev** subagent. Tell it:

- Which build plan to read: `docs/build-plans/[feature-name].md`
- To check `docs/codebase-map.md` if it exists
- To write its report to `docs/reports/dev-report-[feature-name].md`
- If a file exists at `docs/reports/review-fixes-[feature-name].md`, it's a FIX LOOP — fix only those issues

**After the dev agent completes**: Read `docs/reports/dev-report-[feature-name].md`. Summarize for the user what was built and note any deviations from the plan. Then run the validation gate before proceeding.

### Validation Gate

After each dev agent run (initial or fix loop), run the project's checks before proceeding to the next phase:

1. Lint (e.g., `pnpm lint`) — if the project has a lint script
2. Test (e.g., `pnpm test`) — if the project has a test script
3. Build (e.g., `pnpm build`) — if the project has a build script

Check `package.json` for available scripts. Skip any that don't exist.

If any check fails, send the failures back to the dev agent as a fix loop (same 2-loop cap as review fixes). Do NOT proceed to review with broken lint, tests, or build. If the dev agent cannot resolve the failures within 2 fix loops, produce a failure summary and stop.

Once the validation gate passes, proceed to Phase 2.

## Phase 2: Code Review

Delegate to the **reviewer** subagent. Tell it:

- The feature name and build plan location
- To read the dev report at `docs/reports/dev-report-[feature-name].md`
- To write its review to `docs/reports/review-report-[feature-name].md`

**After the review agent completes**: Read `docs/reports/review-report-[feature-name].md`. Report the verdict to the user.

### If verdict is 🔴 FAIL:

1. Extract the must-fix items into `docs/reports/review-fixes-[feature-name].md`
2. Tell the user: **"Review found must-fix issues. Spawning dev agent to address them."**
3. Go back to Phase 1 (the dev agent will see the fixes file)
4. After fixes, re-run Phase 2
5. **Max 2 fix loops.** If it fails a third time, produce a failure summary (see Failure section) and stop.

### If verdict is 🟡 PASS WITH FIXES:

Report the should-fix items to the user for awareness, then proceed directly to Phase 3. The should-fix items can be addressed after test hardening.

### If verdict is ✅ PASS:

Proceed directly to Phase 3.

## Phase 3: Test Hardening

Delegate to the **test-hardener** subagent. Tell it:

- The feature name and build plan location
- To read the review report at `docs/reports/review-report-[feature-name].md`
- To write its report to `docs/reports/test-report-[feature-name].md`

**After the test agent completes**: Read `docs/reports/test-report-[feature-name].md`. Report the verdict to the user.

### If verdict is 🔴 FAIL (bugs found):

1. Extract bugs into `docs/reports/review-fixes-[feature-name].md`
2. Tell the user: **"Test hardening found bugs. Spawning dev agent to fix."**
3. Loop back to Phase 1 for fixes, then re-run Phase 3
4. **Max 2 fix loops.** If it persists, produce a failure summary (see Failure section) and stop.

### If verdict is ✅ PASS or 🟡 PASS WITH GAPS:

Proceed to completion.

## Completion

When all phases pass, produce a final summary:

```markdown
## Build Complete: [Feature Name] ✅

### Pipeline Summary

- **Dev**: [tasks completed, any deviations]
- **Review**: [verdict, key findings]
- **Test**: [verdict, coverage assessment, bugs found and fixed]

### Fix Loops

[Number of times code went back for fixes, and why — or "None"]

### Files Changed

[Consolidated list from dev report]

### Reports

- Dev: docs/reports/dev-report-[feature-name].md
- Review: docs/reports/review-report-[feature-name].md
- Test: docs/reports/test-report-[feature-name].md

### Suggested Commits

[From dev report]
```

## Failure

When a phase exhausts its fix loops (2 max), produce a failure summary and stop. Do NOT continue to subsequent phases.

```markdown
## Build Failed: [Feature Name] ❌

### Failed Phase

- **Phase**: [Dev / Review / Test Hardening]
- **Fix loops attempted**: [number]
- **Reason**: [Brief description of why it's still failing]

### What Passed

[List any phases that completed successfully before the failure, or "None" if failed on first phase]

### Unresolved Issues

[The specific issues from the last review/test report that could not be resolved]

### Files Changed

[Consolidated list from dev report, if any work was done]

### Reports

- Dev: docs/reports/dev-report-[feature-name].md
- Review: docs/reports/review-report-[feature-name].md (if reached)
- Test: docs/reports/test-report-[feature-name].md (if reached)
```
