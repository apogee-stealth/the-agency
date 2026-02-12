# Build Plan: PR Review Command

## Context Source

Product brief at `docs/briefs/pr-review-command.md`, plus design conversation with architect.

## Problem Summary

AI-assisted development has increased code output velocity, but reviewer bandwidth hasn't scaled. PRs land faster, reviewers lose their mental model of the system, and tribal knowledge gets enforced inconsistently. The existing PR checklist is manual and ignored.

We're building a `/review-pr` Claude Code command that gives reviewers a structured briefing before they dive into the diff — narrative summary of what changed and why, risk callouts, and file-type-aware checks for team conventions.

## Technical Approach

This is a **Claude Code slash command** implemented as a markdown file at `.claude/commands/review-pr.md`. It's prompt engineering, not application code.

The command operates in a single invocation with multi-step internal processing:

1. **Input handling**: Accept optional PR number argument. If provided, fetch and checkout the branch via `gh pr checkout`. If not provided, operate on current branch.

2. **PR metadata retrieval**: Use `gh pr view --json` to get base branch, title, change stats. Fail with helpful message if no PR exists for the current branch.

3. **Diff analysis**: Get file list and diff content. Categorize files by package/area and file type. Filter noise (lock files, binaries, generated code).

4. **Chunked analysis for large PRs**: For PRs with 30+ files, chunk by package/area. Analyze each chunk against actual diff content, then synthesize into coherent narrative.

5. **Output generation**: Produce inline markdown with narrative summary, risk callouts, and tribal knowledge checks.

## Key Design Decisions

- **Project-local command**
    - **Why**: Tribal knowledge checks are codebase-specific. A global command would need to be generic or read from per-project config.
    - **Trade-off**: Every repo needs its own copy of the command.

- **Chunked analysis (Option B) over tiered/metadata-first**
    - **Why**: Commit messages are unreliable. The diff itself is the source of truth for understanding what changed.
    - **Trade-off**: Burns more context on synthesis, but produces higher-fidelity narratives.

- **Single command with multi-step prompting (not subagents)**
    - **Why**: This is fundamentally "read diff, write summary." Subagent overhead is unnecessary.
    - **Trade-off**: Complex prompt, but self-contained.

- **Fail if no PR exists (not fallback to main)**
    - **Why**: The command is `/review-pr`, not `/review-branch`. The PR mental model doesn't apply without a PR.
    - **Trade-off**: Users must create a PR before using the command.

- **Tribal knowledge checks inline in prompt (not separate file)**
    - **Why**: MVP check list is small. Self-contained command is easier to understand and maintain.
    - **Trade-off**: If checks grow significantly, will need extraction later.

## Existing Patterns to Follow

- Command file structure matches existing `.claude/commands/*.md` files
- Uses `gh` CLI for GitHub operations (consistent with project's GitHub-first tooling)
- Output is inline markdown (matches brief requirement, consistent with CLI/Cursor rendering)

## Implementation Tasks

This is prompt engineering, not code. The "implementation" is crafting the command markdown file.

### Task 1: Command skeleton and input handling

- **What**: Create `.claude/commands/review-pr.md` with argument parsing and PR checkout logic
- **Files**: `.claude/commands/review-pr.md`
- **Done when**: Command can accept PR number or no argument, fetch/checkout PR branch, fail gracefully if no PR exists

### Task 2: PR metadata and diff gathering

- **What**: Add instructions for gathering PR metadata via `gh pr view` and diff content via `git diff`
- **Files**: `.claude/commands/review-pr.md`
- **Done when**: Command retrieves base branch, file list, change stats, and diff content

### Task 3: Chunking logic for large PRs

- **What**: Add branching logic for small (<30 files) vs large (30+) PRs. Large PRs chunk by package/area.
- **Files**: `.claude/commands/review-pr.md`
- **Done when**: Command handles both small and large PRs with appropriate analysis depth

### Task 4: Narrative summary generation

- **What**: Add prompt instructions for generating the mental model shift + structural changes narrative
- **Files**: `.claude/commands/review-pr.md`
- **Done when**: Command produces narrative blocks with "why/so what" emphasis, collapses repetitive changes, flags orphaned code

### Task 5: Risk callouts

- **What**: Add prompt instructions for identifying and reporting risks (security, behavioral, architectural)
- **Files**: `.claude/commands/review-pr.md`
- **Done when**: Command produces risk section covering security concerns, behavior changes, broken assumptions, dependency changes

### Task 6: Tribal knowledge checks

- **What**: Add file-type-aware checks inline in the prompt (React/CSS, backend, general)
- **Files**: `.claude/commands/review-pr.md`
- **Done when**: Command runs appropriate checks based on file types in diff

### Task 7: Testing recommendations

- **What**: Add prompt instructions for generating testing recommendations tied to the actual changes
- **Files**: `.claude/commands/review-pr.md`
- **Done when**: Command produces testing section with specific test scenarios for new code paths, identifies behavioral changes that may lack test coverage, covers both manual verification and automated test gaps

### Task 8: Output formatting and noise filtering

- **What**: Add output template and instructions for handling lock files, binaries, generated code. Explicitly exclude raw file-changed lists (GitHub provides this already).
- **Files**: `.claude/commands/review-pr.md`
- **Done when**: Command produces well-formatted markdown output, noisy files acknowledged but not over-analyzed, no raw file lists in output

## Technical Risks

- **Context window limits on very large PRs**
    - **Mitigation**: Chunking by package/area, aggressive collapsing of repetitive changes, noise filtering
    - **Likelihood**: Medium (monorepo PRs can get big)

- **Prompt quality affects output quality**
    - **Mitigation**: Iterative testing against real PRs, refinement based on output
    - **Likelihood**: High (this is the nature of prompt engineering)

- **`gh` CLI authentication issues**
    - **Mitigation**: Fail with helpful message if `gh` commands fail
    - **Likelihood**: Low (users of this command likely already use `gh`)

## Dependencies

- GitHub CLI (`gh`) — must be installed and authenticated
- Git — standard, assumed available
- Claude Code — the runtime environment

## Handoff Notes for Developer

This isn't handed off to a dev agent. It's prompt engineering done directly in conversation.

**Testing approach**: Run the command against real PRs of varying sizes. Evaluate output quality. Refine prompt based on results.

**Key prompt engineering challenges**:

- Getting the narrative to explain "why" not just "what"
- Collapsing noise without losing signal
- Making chunked analysis synthesize into coherent whole
- Balancing thoroughness with context budget

**Iteration expectation**: The first version won't be perfect. Plan for 2-3 refinement passes based on real usage.
