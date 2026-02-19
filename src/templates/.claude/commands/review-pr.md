# PR Review Command

## Goal

Produce a structured briefing on a pull request that primes the reviewer's mental model. Help them understand how the codebase shifted and flag areas that need attention.

## Constraints

- **Be concise.** The reviewer will read the actual diff — your job is to prime their mental model, not replace the diff.
- **Be specific.** "Some files changed" is useless. "The auth middleware now validates JWTs instead of session cookies" is useful.
- **Be honest about uncertainty.** If you can't determine why a change was made, say so. "Purpose unclear — reviewer should check with author."
- **Don't hallucinate.** Only report what you actually see in the diff. If a file wasn't changed, don't claim it was.
- **Prioritize signal over completeness.** A focused summary of what matters beats an exhaustive list of everything.
- **No raw file lists.** Do NOT include a "Files Changed" section or dump the `gh pr diff --stat` output. GitHub already shows this. Your job is synthesis, not regurgitation.

## Step 1: Handle Input and Checkout

**If a PR number was provided as an argument** (e.g., `/review-pr 42`):

```bash
gh pr checkout $ARGUMENTS
```

If this fails, stop and report the error.

**If no argument was provided**, you're operating on the currently checked-out branch. Proceed to Step 2.

## Step 2: Get PR Metadata

Run:

```bash
gh pr view --json number,title,baseRefName,headRefName,body,additions,deletions,changedFiles,commits
```

**If this fails with "no pull request found"**: Stop and output:

> **No PR found for this branch.**
>
> This command requires an open pull request. Either:
>
> - Push this branch and create a PR on GitHub first
> - Specify a PR number: `/review-pr 42`

**If successful**, capture:

- `baseRefName` — the base branch for diffing
- `changedFiles` — count of files changed (used for small vs large PR logic)
- `title` and `body` — context for understanding intent

## Step 3: Gather Diff Information

Use `gh pr diff` to get the diff as GitHub sees it. This avoids stale-local-branch problems where a behind-origin base branch inflates the diff with already-merged changes from other PRs.

```bash
# File list with change stats
gh pr diff --stat

# Full diff (for analysis)
gh pr diff
```

**For commit messages**, use the `commits` array already captured in Step 2 — that is the authoritative commit list for this PR. Do NOT use `git log`, which can include commits from other PRs if the local base branch is behind origin.

**Cross-check**: Compare the file count from `gh pr diff --stat` against the `changedFiles` value from Step 2. If they diverge significantly, flag the discrepancy in your output and prefer the `gh pr view` / `gh pr diff` data as the source of truth.

## Step 4: Categorize and Filter Files

Before analysis, categorize the changed files:

**Noise files (acknowledge but don't analyze deeply):**

- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` → "lock file updated"
- `*.min.js`, `*.min.css`, `dist/*`, `build/*` → "generated/bundled files"
- Binary files (images, fonts, etc.) → "binary file added/modified/deleted"

**Categorize by area:**

Group changed files by top-level directory. If the repo uses workspaces (check for a `workspaces` field in `package.json` or the presence of `pnpm-workspace.yaml`), use the workspace definitions to inform grouping. Otherwise, fall back to top-level directory names.

## Step 5: Analyze Changes

### For Small PRs (fewer than 30 changed files):

Analyze **per-commit**. For each commit, produce a narrative block with:

1. **The Mental Model Shift** — plain English explanation of how the codebase's story changed. Focus on "why" and "so what," not restating the diff. Highlight:
    - Architectural shifts or new patterns introduced
    - Patterns retired or approaches abandoned
    - Code that appears orphaned, half-finished, or disconnected

2. **What Changed Structurally** — numbered list of concrete changes:
    - Collapse repetitive/mechanical changes (e.g., "~15 files updated imports from X to Y")
    - Call out meaningful changes individually with enough context to understand impact

### For Large PRs (30 or more changed files):

Analyze **by theme/area** rather than per-commit. Group changes by package or functional area:

1. First, identify the major themes/areas touched
2. For each theme, produce a narrative block (Mental Model Shift + Structural Changes)
3. After per-area analysis, produce a **holistic summary** that captures cross-cutting changes and overall architectural impact

### Analysis Guidance:

- **Explain the "why" and "so what"**, not just the "what"
- **Collapse noise**: If 50 files have the same mechanical change, that's one bullet point
- **Highlight signal**: New public APIs, changed interfaces, deleted capabilities, behavioral changes
- **Flag disconnects**: Code that doesn't seem to connect to anything, half-implemented features, TODOs left behind
- **Note removals**: Deleted code is as important as added code — what capability is gone?

## Step 6: Identify Risks

Scan for and report:

**Security concerns:**

- Auth/authorization changes
- New API endpoints or route changes
- Injection vectors (SQL, command, XSS)
- Sensitive data in logs or error messages
- Secrets or credentials (even if they look like placeholders)
- Changes to validation or sanitization

**Behavioral risks:**

- Changes to public APIs or interfaces
- Modified default values or fallback behavior
- Error handling changes that might swallow errors
- Timing or ordering changes in async code

**Architectural concerns:**

- Layer boundary violations (e.g., handler calling repository directly)
- New circular dependencies
- Assumptions in one layer that depend on implementation details of another
- Patterns that diverge from established codebase conventions

**Dependency concerns:**

- New dependencies added
- Dependencies removed (what relied on them?)
- Major version bumps
- Dependencies with known security issues

**Before finalizing risk callouts related to test files (`.test.ts`, `.spec.ts`):**

Read `.ai/UnitTestGeneration.md` (if it exists) and cross-reference any test-related findings against the project's testing conventions. Do NOT flag patterns that conform to those guidelines — they are intentional, not risks.

## Step 7: Tribal Knowledge Checks

Tribal knowledge checks are loaded dynamically from `.ai/review-checks/`. Each check file is a markdown file with YAML frontmatter.

**Expected check file format:**

```markdown
---
name: Example Check Group
applies_when: Changed files include .ts files in src/
---

- [ ] **Check name**: Description of what to look for.
- [ ] **Another check**: Description of what to look for.
```

**Discovery and evaluation flow:**

1. List available check files:

```bash
ls .ai/review-checks/*.md 2>/dev/null
```

2. **If the directory does not exist or contains no `.md` files**, skip the entire Tribal Knowledge Checks section — produce no heading and no placeholder text.

3. **If files are found**, read each one:

```bash
cat .ai/review-checks/*.md
```

4. For each file, parse the YAML frontmatter to extract `name` and `applies_when`. If a file is missing frontmatter or has invalid/unparseable YAML, skip it and note in the output: "Skipped `{filename}`: missing or invalid frontmatter."

5. Evaluate each file's `applies_when` value against the list of changed files from the diff (gathered in Step 3). Use your judgment — `applies_when` is natural language, not a glob pattern. Match generously but sensibly.

6. For each check group where `applies_when` matches, include its checks in the output under a heading using the `name` from frontmatter. Evaluate each check against the actual diff.

7. If files exist but **none** of their `applies_when` criteria match the diff, skip the Tribal Knowledge Checks section entirely.

## Step 8: Testing Recommendations

Based on the changes in this PR, provide concrete testing recommendations. This is NOT generic "write more tests" advice — recommendations must be tied to the actual changes.

### What to recommend:

**Manual verification:**

- Specific user flows or scenarios the reviewer should manually test
- Edge cases introduced by the changes that aren't obvious from reading the code
- Integration points that might behave differently after these changes

**Automated test coverage:**

- New code paths that lack corresponding tests
- Behavioral changes that existing tests might not cover
- Specific test scenarios to add (with enough detail to write the test)
- **Do NOT recommend tests for React components (`.tsx` files).** We do not unit test React components.

**Regression risks:**

- Existing functionality that might be affected and should be regression tested
- Areas where the change assumptions might conflict with existing behavior

### Guidance:

- Be specific: "Test the login flow with an expired token" not "test authentication"
- Reference the actual changes: "The new `validateApiKey` middleware should be tested with missing, invalid, and expired keys"
- Prioritize: If there are many potential tests, highlight the most important ones first
- If the PR includes good test coverage already, acknowledge that and note any gaps

## Output Format

Produce your output as inline markdown with these sections:

```markdown
# PR Review: #{number} — {title}

**Branch**: {headRefName} → {baseRefName}
**Changes**: {additions} additions, {deletions} deletions across {changedFiles} files

---

## Summary

[For small PRs: per-commit narrative blocks]
[For large PRs: per-theme narrative blocks + holistic summary]

Each block contains:

### [Commit hash / Theme name]

**The Mental Model Shift:**

[Narrative explanation]

**What Changed Structurally:**

1. [Change 1]
2. [Change 2]
   ...

---

## Risk Callouts

[List risks identified, or "No significant risks identified" if none]

- **[Risk category]**: [Description of the risk and why it matters]

---

## Tribal Knowledge Checks

[Only include this section if matching check files were found in .ai/review-checks/. If no check files exist or none matched the diff, omit this entire section including the heading.]

### [name from check file frontmatter]

- [x] [Check passed or N/A]
- [ ] **[Check failed]**: [Specific finding with file:line references]

---

## Testing Recommendations

[Concrete, specific testing recommendations tied to the actual changes in this PR]

### Manual Verification

- [Specific scenario to test manually]

### Automated Test Gaps

- [Specific test that should be written, with enough detail to implement it]

### Regression Risks

- [Existing functionality that should be regression tested]

[If test coverage is already good, say so and note any minor gaps]
```
