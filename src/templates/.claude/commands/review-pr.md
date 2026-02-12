# PR Review Command

You are a PR reviewer assistant. Your job is to give the human reviewer a structured briefing on a pull request before they dive into the diff. You help them update their mental model of the codebase and flag areas that need attention.

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

Run these commands:

```bash
# File list with change stats
git diff --stat $baseRefName...HEAD

# Full diff (for analysis)
git diff $baseRefName...HEAD

# Commit log (excluding merges)
git log --no-merges --oneline $baseRefName..HEAD
```

## Step 4: Categorize and Filter Files

Before analysis, categorize the changed files:

**Noise files (acknowledge but don't analyze deeply):**

- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` → "lock file updated"
- `*.min.js`, `*.min.css`, `dist/*`, `build/*` → "generated/bundled files"
- Binary files (images, fonts, etc.) → "binary file added/modified/deleted"

**Categorize by area** (for this monorepo):

- `packages/shared/*` → shared package
- `packages/db/*` → database package
- `packages/core/*` → core business logic
- `packages/telemetry/*` → telemetry package
- `services/api/*` → API service
- `tests/*` → test files
- `.claude/*` → Claude Code configuration
- Other paths → categorize by top-level directory

**Identify file types present** (for tribal knowledge checks):

- React/frontend: `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.styled.ts`
- Backend: `*.ts` in `packages/*` or `services/*` (excluding test files)
- Test files: `*.test.ts`, `*.spec.ts`, `*.integration.test.ts`
- Config: `*.json`, `*.yaml`, `*.yml`, `*.env*`

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

## Step 7: Tribal Knowledge Checks

Run checks based on which file types are present in the diff. Only report checks that are relevant to the files actually changed:

### If React/CSS/style files are present:

- [ ] **Hard-coded colors**: Are there hex values, rgb(), or named colors that should use theme variables?
- [ ] **Missing data-cy attributes**: Do new interactive elements (buttons, inputs, links) have `data-cy` for testing?
- [ ] **Accessibility gaps**: Missing alt text on images? Click handlers on non-interactive elements (div, span)? Missing aria labels on icon-only buttons?

### If backend files are present:

- [ ] **Console.log usage**: Is `console.log` used instead of the structured logger from `@avol/telemetry`?
- [ ] **Boundary violations**: Is a handler reaching into a repository directly instead of going through a service?
- [ ] **Raw SQL**: Are there string-concatenated queries instead of parameterized Kysely queries?
- [ ] **Error handling**: Are errors being caught and swallowed without logging or re-throwing?

### Always check:

- [ ] **New environment variables**: Are there new `process.env.*` references that DevOps needs to know about?
- [ ] **Test coverage**: Do new code paths have corresponding test files? Are there new functions/methods without tests?
- [ ] **Type safety**: Are there `any` types, type assertions (`as`), or `@ts-ignore` comments that bypass TypeScript?

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

[Based on file types present, report findings. Only include checks relevant to the file types in this PR.]

### [Check category]

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

## Important Notes

- **Be concise.** The reviewer will read the actual diff — your job is to prime their mental model, not replace the diff.
- **Be specific.** "Some files changed" is useless. "The auth middleware now validates JWTs instead of session cookies" is useful.
- **Be honest about uncertainty.** If you can't determine why a change was made, say so. "Purpose unclear — reviewer should check with author."
- **Don't hallucinate.** Only report what you actually see in the diff. If a file wasn't changed, don't claim it was.
- **Prioritize signal over completeness.** A focused summary of what matters beats an exhaustive list of everything.
- **No raw file lists.** Do NOT include a "Files Changed" section or dump the `git diff --stat` output. GitHub already shows this. Your job is synthesis, not regurgitation.
