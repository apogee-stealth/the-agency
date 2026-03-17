# Prep PR Command

## Goal

Prepare and create a draft pull request for the current branch. Run pre-submission checks, generate a full PR review, collect optional author testing notes, and create the draft PR.

This command takes no arguments. It operates on the currently checked-out branch.

<!-- Sibling command: review-pr.md uses the same analysis approach and plugin discovery/loading flow. If the analysis format or plugin format changes, update both files. -->

## Constraints

- This command is conversational. There are multiple points where you pause and wait for developer input (Step 2, Step 10, Step 11, Step 12). Don't try to rush through without their responses.
- Check failures are informational, not blocking. The developer can still create the PR even if checks fail.
- Always create the PR as a draft. No option to toggle this.
- If the developer wants to bail at any point, respect that. Don't push them to continue.

## Step 1: Validate Preconditions

Run these checks in order. Stop at the first failure.

### 1.1: Verify `gh` CLI

```bash
gh auth status
```

**If this fails**, stop and output:

> **GitHub CLI is not installed or not authenticated.**
>
> Install it from https://cli.github.com/ and run `gh auth login` to authenticate.

### 1.2: Check current branch

```bash
git branch --show-current
```

Get the repo's default branch:

```bash
gh repo view --json defaultBranchRef -q '.defaultBranchRef.name'
```

**If the current branch matches the default branch**, stop and output:

> **You're on `{branch}` — create a feature branch first.**

### 1.3: Check for existing PR

```bash
gh pr list --head $(git branch --show-current) --json number,url
```

**If this returns a PR**, stop and output:

> **A PR already exists for this branch:** {url}

## Step 2: Target Branch

Ask the developer:

> **Target branch?** (default: `{default branch from Step 1.2}`)

The developer can accept the default or specify another branch. Use whatever they provide (or the default) as `$TARGET` for all subsequent steps.

## Step 3: Gather Diff

Fetch the latest state of the target branch from the remote so comparisons reflect what's actually on the remote, not a potentially stale local copy:

```bash
git fetch origin $TARGET
```

### 3.1: Resolve Comparison Ref

Default to `origin/$TARGET` (the remote tracking ref) for all diff and log comparisons. Before proceeding, check whether a local copy of the target branch exists and is ahead of the remote:

```bash
git rev-list --count origin/$TARGET..$TARGET 2>/dev/null
```

- **If the command fails** (no local branch exists), or **returns 0** (local is behind or even with remote): use `origin/$TARGET` silently. No prompt needed.
- **If the count is greater than 0**: the local branch has commits not yet on the remote. Ask the developer:

> **Your local `{$TARGET}` is {count} commit(s) ahead of `origin/{$TARGET}`.** Use local or remote for comparison? (default: remote)

Use whichever ref the developer chooses as `$COMPARE_REF` for all subsequent diff and log commands. If they accept the default or don't respond, use `origin/$TARGET`.

### 3.2: Check for Commits

Check that there are commits ahead of the comparison ref:

```bash
git log --oneline $COMPARE_REF..HEAD
```

**If no commits are returned**, stop and output:

> **No commits ahead of `{$COMPARE_REF}`. Nothing to PR.** You may need to rebase.

### 3.3: Gather Change Data

```bash
# File list with change stats
git diff --stat $COMPARE_REF...HEAD

# Full diff
git diff $COMPARE_REF...HEAD

# Commit log (excluding merges)
git log --no-merges --oneline $COMPARE_REF..HEAD
```

## Step 4: Categorize and Filter Files

Before analysis, categorize the changed files:

**Noise files (acknowledge but don't analyze deeply):**

- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` -> "lock file updated"
- `*.min.js`, `*.min.css`, `dist/*`, `build/*` -> "generated/bundled files"
- Binary files (images, fonts, etc.) -> "binary file added/modified/deleted"

**Categorize by area:**

Group changed files by top-level directory. If the repo uses workspaces (check for a `workspaces` field in `package.json` or the presence of `pnpm-workspace.yaml`), use the workspace definitions to inform grouping. Otherwise, fall back to top-level directory names.

## Step 5: Analyze Changes

### For Small PRs (fewer than 30 changed files):

Analyze **per-commit**. For each commit, produce a narrative block with:

1. **The Mental Model Shift** -- plain English explanation of how the codebase's story changed. Focus on "why" and "so what," not restating the diff. Highlight:
    - Architectural shifts or new patterns introduced
    - Patterns retired or approaches abandoned
    - Code that appears orphaned, half-finished, or disconnected

2. **What Changed Structurally** -- numbered list of concrete changes:
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
- **Note removals**: Deleted code is as important as added code -- what capability is gone?

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

Read `.ai/UnitTestGeneration.md` (if it exists) and cross-reference any test-related findings against the project's testing conventions. Do NOT flag patterns that conform to those guidelines -- they are intentional, not risks.

## Step 7: Tribal Knowledge Checks

Tribal knowledge checks are loaded dynamically from `.ai/review-checks/`. Each check file is a markdown file with YAML frontmatter.

<!-- This is the same discovery/loading flow as review-pr.md. -->

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

2. **If the directory does not exist or contains no `.md` files**, skip the entire Tribal Knowledge Checks section silently -- no error, no placeholder text. Proceed to Step 8.

3. **If files are found**, read each one:

```bash
cat .ai/review-checks/*.md
```

4. For each file, parse the YAML frontmatter to extract `name` and `applies_when`. If a file is missing frontmatter or has invalid/unparseable YAML, skip it and note: "Skipped `{filename}`: missing or invalid frontmatter."

5. Evaluate each file's `applies_when` value against the list of changed files from the diff (gathered in Step 3). Use your judgment -- `applies_when` is natural language, not a glob pattern. Match generously but sensibly.

6. For each check group where `applies_when` matches, include its checks in the output under a heading using the `name` from frontmatter. Evaluate each check against the actual diff.

7. If files exist but **none** of their `applies_when` criteria match the diff, skip the Tribal Knowledge Checks section entirely.

Display the check results to the developer as you go so they can see what passed and what needs attention.

## Step 8: Testing Recommendations

Based on the changes, provide concrete testing recommendations. This is NOT generic "write more tests" advice -- recommendations must be tied to the actual changes.

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

## Step 9: Generate Title

Analyze the diff and commit history gathered in Step 3. Generate:

- **Title**: Concise, reflects the nature of the changes (bug fix, feature, refactor, etc.). Keep it under 70 characters.

## Step 10: Collect Author Testing Notes (Optional)

Ask the developer:

> **Do you have any additional testing steps you'd like to include?** These will appear in the PR as "PR Author Testing Recommendations" alongside the generated testing analysis. Feel free to skip if the generated recommendations cover it.

If the developer provides testing steps, store them for inclusion in the PR body. If they skip or decline, proceed without them.

## Step 11: Present Full Preview

Show the developer the complete PR preview:

```
## PR Preview

**Title:** {generated title}

---

# {title}

**Branch**: {current branch} -> {$TARGET}
**Changes**: {additions} additions, {deletions} deletions across {changed file count} files

---

## Summary

[Per-commit or per-theme narrative blocks from Step 5]

---

## Risk Callouts

[Risks from Step 6, or "No significant risks identified"]

---

## Tribal Knowledge Checks

[Only if matching check files were found in Step 7. Omit section entirely otherwise.]

### [name from check file frontmatter]

- [x] [Check passed or N/A]
- [ ] **[Check failed]**: [Specific finding with file:line references]

---

## Testing Recommendations

### Manual Verification

- [Specific scenario to test manually]

### Automated Test Gaps

- [Specific test that should be written]

### Regression Risks

- [Existing functionality to regression test]
```

If the developer provided author testing notes in Step 10, also show:

```
---

## PR Author Testing Recommendations

{developer-provided testing steps}
```

Then ask:

> **Review the preview above.** Want to edit anything (title, description, testing steps), or good to go?

Let the developer make edits. Iterate until they're satisfied.

## Step 12: Push Branch

Check whether the branch has an upstream and is up to date:

```bash
git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null
```

**If no upstream exists**, or if the local branch is ahead of the remote:

```bash
git status -sb
```

Ask:

> **Branch needs to be pushed to the remote. Push now?**

If the developer confirms, push:

```bash
git push -u origin $(git branch --show-current)
```

**If the push fails**, report the error and stop. Do NOT offer `--force`.

**If the branch is already up to date with the remote**, skip this step silently.

## Step 13: Create Draft PR

Assemble the PR body using the full review content from Steps 5-8:

```
# {title}

**Branch**: {current branch} -> {$TARGET}
**Changes**: {additions} additions, {deletions} deletions across {changed file count} files

---

## Summary

{per-commit or per-theme narrative blocks}

---

## Risk Callouts

{risks, or "No significant risks identified"}
```

If tribal knowledge check results exist from Step 7, append:

```
---

## Tribal Knowledge Checks

{check results with pass/fail and file:line references}
```

If no check results (no plugin files found or none matched), omit the Tribal Knowledge Checks section entirely.

Append the testing recommendations from Step 8:

```
---

## Testing Recommendations

{testing recommendations}
```

If the developer provided author testing notes in Step 10, append:

```
---

## PR Author Testing Recommendations

{developer-provided testing steps}
```

Create the draft PR:

```bash
gh pr create --draft --base $TARGET --title "{title}" --body "{body}"
```

**If this succeeds**, display:

> **Draft PR created:** {URL}

**If this fails**, report the error and stop.
