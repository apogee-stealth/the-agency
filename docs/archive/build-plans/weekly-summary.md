# Build Plan: Weekly Summary Command

## Context Source

Product brief: `docs/briefs/weekly-summary.md`

## Problem Summary

Developers lose track of how the codebase evolves when they're not reviewing every PR. There's no quick way to rebuild a mental model after a few days away. This command synthesizes the last 7 days of merged PRs into a thematic summary — not a list of PRs, but a narrative of how the codebase shifted — with risk callouts for things that could bite you.

## Technical Approach

This is a Claude Code slash command (`/weekly-summary`), same structural pattern as the existing `review-pr` command. It lives in `src/templates/.claude/commands/weekly-summary.md` as a prompt file — no application code, no runtime logic, just prompt engineering that drives Claude's behavior when the command is invoked.

The command uses the GitHub API (via `gh` CLI) exclusively for data gathering — no local branch assumptions, no `git diff`. This is deliberate: merged branches are often deleted, and the command should work against any repo the user has `gh` access to without needing branches checked out locally. Data flows in three stages: (1) fetch merged PR list with metadata, (2) fetch per-PR file stats for diffstat equivalence, (3) synthesize into thematic output.

Output is written to `docs/reports/weekly-summary-YYYY-MM-DD.md`. The `docs/reports/` directory is already gitignored in consumer repos that follow the convention.

## Key Design Decisions

- **Decision**: API-first data gathering — no local git operations
    - **Why**: Merged branches are frequently deleted. The command should work regardless of local branch state.
    - **Trade-off**: Requires network access and a valid `gh` auth session. Can't run offline.

- **Decision**: No input cap or truncation for MVP
    - **Why**: The model should handle the synthesis; premature truncation risks losing signal. Token cost is acceptable for a command run ~weekly.
    - **Trade-off**: High-volume repos (50+ PRs/week) may produce large input payloads. We'll monitor and add truncation if costs or quality suffer.

- **Decision**: Thematic synthesis, not per-PR summaries
    - **Why**: The value is in the aggregate mental model update. Per-PR summaries are just a worse version of reading PR titles.
    - **Trade-off**: The prompt must be very explicit about this or the model will default to per-PR itemization.

- **Decision**: Overwrite on same-day re-run
    - **Why**: It's a regeneration, not a history. Running twice should give you the latest synthesis, not two files.
    - **Trade-off**: None meaningful. If someone wanted the earlier version, it wasn't committed anyway (gitignored).

## Existing Patterns to Follow

- **Command file structure**: Follow `src/templates/.claude/commands/review-pr.md` — step-by-step instructions with bash command blocks, output format specification, and behavioral guidance.
- **Manifest registration**: Add entry to `src/manifest.ts` in the `commands` array.
- **Output location**: `docs/reports/` directory, matching the convention documented in `CLAUDE.md`.
- **Tone and synthesis style**: The "Mental Model Shift" narrative voice from `review-pr` is the reference for how this command should read.

## Implementation Tasks

### Task 1: Create the weekly-summary command prompt

- **What**: Create `src/templates/.claude/commands/weekly-summary.md` — the full slash command prompt that drives Claude's behavior when `/weekly-summary` is invoked.
- **Files**: Create `src/templates/.claude/commands/weekly-summary.md`
- **Structure**:

    **Step 1 — Determine date range**: Calculate the date 7 days ago from today. Use this as the cutoff for merged PRs.

    **Step 2 — Fetch merged PRs**: Use `gh pr list --state merged --json number,title,body,mergedAt,additions,deletions,changedFiles,commits --limit 100`. Filter results to only PRs where `mergedAt` is within the last 7 days (the `--state merged` flag returns recent merges, but Claude must verify dates since `gh` doesn't have a native date filter on `pr list`).

    **Step 3 — Handle zero PRs**: If no PRs match the date range, write a short file to the output path stating no PRs were merged in the last 7 days. Stop.

    **Step 4 — Fetch per-PR file stats**: For each merged PR, run `gh api repos/{owner}/{repo}/pulls/{number}/files` to get file-level change stats (filename, additions, deletions, status). This is the diffstat equivalent. Use `gh repo view --json owner,name` (or parse from `gh repo view --json nameWithOwner`) to get the owner/repo values dynamically.

    **Step 5 — Synthesize**: With all data assembled, produce the two output sections:
    - **Mental Model Shift**: Thematic grouping of how the codebase changed. NOT per-PR summaries. The prompt must aggressively reinforce: "Group by theme, not by PR. A developer reading this should understand the narrative of what shifted, not get a changelog." Examples of good themes: "Auth migrated from X to Y," "New caching layer introduced," "Test infrastructure overhauled."
    - **Risk Callouts**: Breaking changes, new patterns replacing old ones, high-churn areas, new dependencies, removed capabilities, things that will surprise someone who wasn't watching.

    **Step 6 — Write output**: Write the synthesized markdown to `docs/reports/weekly-summary-YYYY-MM-DD.md` (using today's date). Create `docs/reports/` if it doesn't exist.

    **Output format**:

    ```
    # Weekly Summary: YYYY-MM-DD

    **Period**: {start_date} to {end_date}
    **PRs merged**: {count}

    ---

    ## Mental Model Shift

    [Thematic narrative sections]

    ---

    ## Risk Callouts

    [Bulleted risk items, or "No significant risks identified"]
    ```

    **Behavioral guidance in the prompt**:
    - Think like a teammate giving a hallway briefing, not a release notes generator
    - If multiple PRs contribute to the same theme, weave them together — don't enumerate
    - Diffstats inform emphasis: high-churn areas get more attention
    - File paths in diffstats reveal what _areas_ changed, even when PR descriptions are sparse
    - Be honest about uncertainty: if PR descriptions are vague and diffstats are ambiguous, say so
    - Never hallucinate changes — only report what the data shows

- **Done when**: Command file exists, follows the step-by-step structure of `review-pr.md`, and is a self-contained prompt that Claude Code can execute.

### Task 2: Register command in manifest

- **What**: Add the `weekly-summary.md` command to the manifest so the sync CLI distributes it.
- **Files**: Modify `src/manifest.ts`
- **Change**: Add `{ file: "weekly-summary.md", description: "Weekly synthesis of merged PRs" }` to the `commands` array.
- **Done when**: Manifest includes the new entry, `pnpm build` succeeds.

## Technical Risks

- **Risk**: GitHub API rate limiting on repos with many merged PRs
    - **Mitigation**: The per-PR file stats call is the bottleneck (one call per PR). For 50 PRs, that's 50 API calls — well within GitHub's rate limits for authenticated users (5000/hour). Only a concern if someone runs this against a repo with 200+ weekly merges, which is an extreme edge case.
    - **Likelihood**: Low

- **Risk**: PR descriptions are sparse/empty, leading to thin summaries
    - **Mitigation**: The command also ingests commit messages and file-level diffstats. Even with empty PR bodies, the diffstat reveals what areas of the codebase changed, and commit messages often carry useful context. The prompt should instruct the model to lean on diffstats when descriptions are sparse.
    - **Likelihood**: Medium (varies wildly by team culture)

- **Risk**: Model falls back to per-PR itemization despite thematic prompting
    - **Mitigation**: Strong prompt reinforcement with explicit negative examples ("Do NOT summarize each PR individually"). Test against real data and iterate on prompt wording.
    - **Likelihood**: Medium

- **Risk**: `docs/reports/` doesn't exist in consumer repos
    - **Mitigation**: Command includes a step to `mkdir -p docs/reports/` before writing. Trivial.
    - **Likelihood**: Medium

## Dependencies

- `gh` CLI — authenticated and available in the user's shell. Same assumption as `review-pr`.
- No new packages or external services.

## Handoff Notes for Developer

- The hardest part of this is the synthesis prompt in Step 5. Expect to iterate on the wording. The first draft will probably produce per-PR summaries despite instructions — tighten the language until it consistently produces thematic output.
- Look at `review-pr.md` Step 5 for the "Mental Model Shift" voice — this command should read like the same author.
- The `gh api` call for per-PR files returns paginated results (30 per page by default). For PRs with many files, you may need `--paginate` or a higher `per_page` param. Add `?per_page=100` to the API URL.
- The date filtering happens client-side (in Claude's logic), not in the `gh` query. The `--limit 100` on `gh pr list` should be sufficient for most repos — if a repo merges more than 100 PRs in a week, the oldest ones in the window may get dropped. Acceptable for MVP.
- The owner/repo for the API call should be derived dynamically — don't hardcode anything. `gh repo view --json nameWithOwner --jq .nameWithOwner` gives you `owner/repo` in one shot.
- Re-running on the same day overwrites. This is intentional.
