# Product Brief: Prep PR Command

## Problem Statement

Developers want a pre-submission quality gate for pull requests. Before opening a PR, they need to run checks against their changes, generate a meaningful description, and create the PR — all without context-switching between multiple tools and manual steps. Today this requires manually running checks, writing a description from memory, and cobbling together the `gh pr create` invocation. The existing `review-pr` command serves a _reviewer_ after a PR exists; this serves the _author_ before one does.

## Target User

Any developer using The Agency who is ready to open a pull request and wants to verify their changes and streamline PR creation.

## MVP Scope

A new slash command `/prep-pr` that:

1. **Validates preconditions** — refuses to run if the current branch is `main` (or the repo's default branch) or if a PR already exists for the current branch.
2. **Runs review plugin checks** — loads and evaluates the same `.ai/review-checks/*.md` plugin files used by `/review-pr`. Displays results with pass/fail status. Check failures are informational, not blocking.
3. **Generates a draft PR title and description** — analyzes the diff against the target branch and produces a summary of what changed and why.
4. **Prompts the developer for testing steps** — the developer enters their own testing steps, which get formatted into the PR body.
5. **Presents a full PR preview** — title, description, testing steps, and check results are shown together. The developer can review and edit before proceeding.
6. **Asks for target branch** — prompts the developer to specify which branch they're targeting.
7. **Pushes the branch if needed** — if the branch isn't pushed to the remote (or is behind), offers to push it.
8. **Creates a draft PR via GitHub CLI** — always creates the PR as a draft using `gh pr create --draft`.

## Explicitly Out of Scope

- **Reviewer assignment** — no `--reviewer` flag or team assignment.
- **Labels, milestones, or project boards** — no metadata beyond title, body, base branch.
- **Ready-for-review PRs** — always creates as draft. No option to toggle.
- **Uncommitted change warnings** — if the developer has uncommitted work, that's their problem.
- **Updating existing PRs** — if a PR already exists for this branch, the command bails with a message.
- **Auto-generated testing steps** — testing steps come from the developer, not from diff analysis.

## User Stories

- As a developer, I want to run quality checks against my changes before opening a PR so that I catch issues before reviewers do.
    - Acceptance Criteria:
        - [ ] Review plugin checks from `.ai/review-checks/*.md` are loaded and evaluated against the diff
        - [ ] Check results are displayed with clear pass/fail indicators
        - [ ] Failed checks do not block PR creation

- As a developer, I want an AI-generated PR title and description so that I don't have to write one from scratch.
    - Acceptance Criteria:
        - [ ] Title is concise and reflects the nature of the changes
        - [ ] Description summarizes what changed and why, based on the diff and commit history
        - [ ] Both title and description are editable before PR creation

- As a developer, I want to add my own testing steps so that reviewers know how to verify my changes.
    - Acceptance Criteria:
        - [ ] The command prompts the developer for testing steps
        - [ ] Testing steps are formatted and included in the PR body

- As a developer, I want to preview the complete PR before it's created so that I can catch mistakes.
    - Acceptance Criteria:
        - [ ] Full preview shows title, description, testing steps, and check results
        - [ ] Developer can edit the preview before proceeding

- As a developer, I want the command to handle branch pushing so that I don't have to do it separately.
    - Acceptance Criteria:
        - [ ] If the branch is not pushed, the command offers to push it
        - [ ] If the branch is already up to date, this step is skipped

- As a developer, I want the PR created as a draft so that I can continue iterating before requesting review.
    - Acceptance Criteria:
        - [ ] PR is always created with `--draft` flag
        - [ ] PR URL is displayed after creation

## Edge Cases & Open Questions

- **Branch is `main`**: Command refuses to run with a clear message ("You're on main — create a feature branch first").
- **PR already exists**: Command bails with a message ("A PR already exists for this branch: [URL]").
- **No review check files exist**: Skip the checks step entirely — no error, no placeholder output.
- **No commits ahead of target branch**: Should the command warn that there's nothing to PR? (Recommendation: yes, bail with a message.)
- **`gh` CLI not installed or not authenticated**: Fail early with a helpful message.
- **Push fails (e.g., force push needed)**: Report the error and stop. Don't offer `--force`.

## Success Metrics

- Developers use `/prep-pr` as their default way to open PRs in repos using The Agency.
- Time from "ready to PR" to "draft PR exists" is reduced to a single command invocation.
- PR descriptions are more consistent and informative than manually written ones.

## Handoff Notes for Architect

- The review plugin system already exists and is documented in `/review-pr`. The plugin loading logic (discover `.ai/review-checks/*.md`, parse YAML frontmatter, evaluate `applies_when`) should be reusable. Consider whether to extract shared logic or duplicate the relevant prompt instructions.
- This is a slash command, so it lives in `src/templates/.claude/commands/prep-pr.md` and needs a manifest entry in `src/manifest.ts`.
- The command is conversational — it prompts the developer at multiple points (testing steps, preview editing, target branch, push confirmation). This is intentional and matches the interactive nature of slash commands.
- The PR body template should include sections for: Summary (AI-generated), Test Plan (developer-provided), and optionally a collapsed section for check results.
- Always use `gh pr create --draft`.
