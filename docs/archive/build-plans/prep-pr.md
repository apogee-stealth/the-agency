# Build Plan: Prep PR Command

## Context Source

Product brief at `docs/briefs/prep-pr.md`, plus design conversation with Jim covering plugin evaluation depth, target branch timing, PR body template, and edge case handling.

## Problem Summary

Developers need a pre-submission quality gate for pull requests. Before opening a PR, they want to run checks against their changes, get an AI-generated description, add testing steps, and create a draft PR — all from a single command. The existing `/review-pr` command serves reviewers after a PR exists; `/prep-pr` serves the author before one does.

## Technical Approach

This is a single markdown command file (`src/templates/.claude/commands/prep-pr.md`) following the same pattern as existing commands. The command is conversational and interactive — it prompts the developer at multiple points during the flow.

The review plugin loading logic is duplicated from `/review-pr` with adjusted evaluation instructions: same discovery and YAML frontmatter parsing, but check evaluation produces pass/fail with brief file/line pointers rather than the full reviewer narrative. This keeps both commands self-contained (important since commands run in isolated contexts) while giving authors enough information to find and fix issues.

The command creates draft PRs exclusively via `gh pr create --draft`.

## Key Design Decisions

- **Duplicate plugin loading instructions (lighter evaluation)**
    - **Why**: Commands are self-contained markdown running in isolated contexts — no import mechanism. Author needs actionable pass/fail with file pointers, not reviewer-depth analysis.
    - **Trade-off**: Two places to update if plugin format changes. Acceptable for MVP; extraction would require architectural changes to the command system.

- **Target branch asked early, defaults to repo default branch**
    - **Why**: Need the base branch to generate the diff for analysis. Asking early with a sensible default (repo's default branch) avoids friction for the 90% case while letting the developer override.
    - **Trade-off**: Slightly more upfront interaction before the interesting stuff, but cleaner data flow.

- **Collapsed check results in PR body**
    - **Why**: Check results are useful context for reviewers but shouldn't dominate the PR description. A `<details>` block keeps them accessible without cluttering.
    - **Trade-off**: May remove this if it feels noisy in practice. Keeping for MVP to evaluate.

- **Bail on no commits ahead with rebase suggestion**
    - **Why**: A PR with no diff is meaningless. Suggesting a rebase points the developer toward the likely fix.
    - **Trade-off**: None meaningful — this is a clear error case.

## Existing Patterns to Follow

- Command file structure from `review-pr.md` — step-numbered sections, bash code blocks for commands, conditional flow based on command output
- Plugin discovery flow from `review-pr.md` Steps 7.1–7.7 — `ls .ai/review-checks/*.md`, parse YAML frontmatter, evaluate `applies_when`
- Manifest entry format from `src/manifest.ts`
- Interactive/conversational tone matching existing commands (e.g., `architect.md`, `pm.md`)

## Implementation Tasks

### Task 1: Create the command file with precondition checks

- **What**: Create `src/templates/.claude/commands/prep-pr.md` with Step 1 (precondition validation). This includes checking whether `gh` is installed and authenticated, whether the current branch is `main` (or the repo's default branch), and whether a PR already exists for the current branch. Each failure case produces a clear message and stops execution.
- **Files**: `src/templates/.claude/commands/prep-pr.md` (create)
- **Implementation notes**:
    - Use `gh auth status` to verify `gh` CLI is installed and authenticated
    - Use `git branch --show-current` to get current branch
    - Use `gh repo view --json defaultBranchRef -q '.defaultBranchRef.name'` to get default branch name
    - Use `gh pr list --head <branch> --json number,url` to check for existing PRs
    - If on default branch: bail with "You're on [branch] — create a feature branch first"
    - If PR exists: bail with "A PR already exists for this branch: [URL]"
- **Done when**: Command file exists with precondition checks that bail correctly for each failure case.

### Task 2: Add target branch prompt and diff gathering

- **What**: Add Step 2 (target branch selection) and Step 3 (diff gathering). Prompt the developer for target branch, defaulting to the repo's default branch. Then gather the diff and commit log against that base.
- **Files**: `src/templates/.claude/commands/prep-pr.md` (modify)
- **Implementation notes**:
    - Default target branch is the repo's default branch (from Task 1's `gh repo view` query)
    - Prompt: "Target branch? (default: [default branch])" — developer can accept default or specify another
    - Check that there are commits ahead of the target branch. If not, bail with: "No commits ahead of [target branch]. Nothing to PR. You may need to rebase."
    - Gather: `git diff --stat <target>...HEAD`, `git diff <target>...HEAD`, `git log --no-merges --oneline <target>..HEAD`
- **Done when**: Command prompts for target branch, gathers diff successfully, and bails correctly when no commits ahead.

### Task 3: Add review plugin checks

- **What**: Add Step 4 (review plugin evaluation). Discover and load `.ai/review-checks/*.md` files, parse YAML frontmatter, evaluate `applies_when` against changed files, and run applicable checks against the diff.
- **Files**: `src/templates/.claude/commands/prep-pr.md` (modify)
- **Implementation notes**:
    - Discovery: `ls .ai/review-checks/*.md 2>/dev/null`
    - If no directory or no files, skip silently — no error, no placeholder
    - Read each file, parse YAML frontmatter for `name` and `applies_when`
    - Skip files with missing/invalid frontmatter (note in output: "Skipped `{filename}`: missing or invalid frontmatter")
    - Evaluate `applies_when` against changed file list from the diff
    - For matching check groups: evaluate each check item against the diff
    - Output format: pass/fail per check with brief file/line pointers for failures — enough breadcrumb to find and fix, not a full reviewer narrative
    - Store check results for inclusion in PR body later
- **Done when**: Plugin checks load, evaluate, and produce actionable pass/fail output with location pointers.

### Task 4: Add title/description generation and testing steps prompt

- **What**: Add Step 5 (AI-generated title and description) and Step 6 (developer testing steps). Analyze the diff and commit history to generate a PR title and description. Then prompt the developer for testing steps.
- **Files**: `src/templates/.claude/commands/prep-pr.md` (modify)
- **Implementation notes**:
    - Title: concise, reflects the nature of the changes (bug fix, feature, refactor, etc.)
    - Description: summarize what changed and why, based on diff and commit messages. Focus on the "so what" not a restatement of the diff.
    - Prompt developer: "Enter your testing steps (how should a reviewer verify these changes?):"
    - Developer provides free-form testing steps — these are NOT AI-generated
- **Done when**: Command generates title and description from the diff and collects testing steps from the developer.

### Task 5: Add PR preview, push, and creation

- **What**: Add Step 7 (full preview), Step 8 (push if needed), and Step 9 (draft PR creation). Present the complete PR preview for developer review/editing. Push the branch if not already pushed. Create the draft PR via `gh`.
- **Files**: `src/templates/.claude/commands/prep-pr.md` (modify)
- **Implementation notes**:
    - Preview format shows: title, description, testing steps, and check results (if any)
    - Developer can review and request edits to any section before proceeding
    - PR body template:

        ```
        ## Summary
        [AI-generated description]

        ## Test Plan
        [Developer-provided testing steps]

        <details>
        <summary>Pre-submission Checks</summary>

        [Check results — pass/fail with names]

        </details>
        ```

    - If no check results (no plugin files or none matched), omit the `<details>` section entirely
    - Check push status: `git rev-parse --abbrev-ref --symbolic-full-name @{u}` — if no upstream or local is ahead, offer to push
    - Push with: `git push -u origin <branch>`
    - If push fails, report the error and stop. Do NOT offer `--force`.
    - Create PR: `gh pr create --draft --base <target> --title "<title>" --body "<body>"`
    - Display the PR URL on success

- **Done when**: Command shows preview, handles push, creates draft PR, and displays the URL.

### Task 6: Add manifest entry

- **What**: Add the new command to the file manifest so it gets distributed by `the-agency sync`.
- **Files**: `src/manifest.ts` (modify)
- **Implementation notes**:
    - Add to the `commands` array: `{ file: "prep-pr.md", description: "Pre-submission PR prep and draft creation" }`
- **Done when**: Manifest includes the new command entry and `pnpm build` succeeds.

## Technical Risks

- **Risk**: Plugin loading instructions diverge between `prep-pr` and `review-pr` over time
    - **Mitigation**: Keep the discovery/loading flow identical; only the evaluation depth differs. Comment in both files referencing the other as the sibling implementation.
    - **Likelihood**: Medium (will happen eventually, but is manageable)

- **Risk**: `gh` CLI edge cases (not installed, not authenticated, wrong repo)
    - **Mitigation**: Fail early in precondition checks with specific, helpful error messages
    - **Likelihood**: Low (well-understood failure modes)

- **Risk**: Diff too large for context window during title/description generation
    - **Mitigation**: Use `git diff --stat` for overview + selective reading of key files rather than dumping the entire diff. The command prompt should instruct analysis of the stat summary and commit log first, then selectively read diffs for the most significant files.
    - **Likelihood**: Medium (large PRs exist, but the command already has all context available as a slash command)

## Dependencies

- `gh` CLI (GitHub CLI) — must be installed and authenticated in the consuming repo
- `.ai/review-checks/*.md` — optional, plugin files for tribal knowledge checks (already part of the existing system)

## Handoff Notes for Developer

- This is a **prompt engineering** task, not a code task. The entire implementation is a single markdown file. Write it like you're writing instructions for a very capable but literal assistant.
- Look at `review-pr.md` as your primary reference for style and structure. Match its level of specificity in bash commands and conditional logic.
- The command is intentionally conversational. There are multiple points where you pause and wait for developer input. Don't try to make it fully autonomous.
- The `<details>` block for check results in the PR body is provisional — we may remove it after seeing it in practice.
- ⚠️ Don't forget to cross-reference with `review-pr.md` when writing the plugin discovery/loading section. Same flow, lighter evaluation.
- The command should NOT reference `$ARGUMENTS` — unlike `review-pr`, this command takes no arguments. It operates on the current branch.
