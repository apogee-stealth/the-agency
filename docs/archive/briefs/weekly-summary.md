# Product Brief: Weekly Summary Command

## Problem Statement

Developers lose track of how the codebase has changed when they're not involved in every PR. Whether returning from PTO or just missing a few reviews, there's no quick way to rebuild a mental model of what shifted in the last week. The existing `review-pr` command solves this at the single-PR level — this command solves it at the weekly aggregate level.

## Target User

Developers on the team who need to catch up on changes they weren't part of.

## MVP Scope

A Claude Code slash command (`/weekly-summary`) that:

- Queries merged PRs from the last 7 rolling days
- Collects PR metadata for each: title, body, commit messages, and diffstat (`--stat`)
- Synthesizes a thematic summary across all PRs (not per-PR summaries)
- Produces two sections:
    - **Mental Model Shift** — How the codebase changed, grouped by theme (e.g., "Auth migrated from sessions to JWT," "15 components moved as part of FSD migration")
    - **Risk Callouts** — Things that could bite you: breaking changes, new patterns that replaced old ones, areas of high churn
- Writes output as a markdown file to `docs/reports/weekly-summary-YYYY-MM-DD.md`
- No arguments or flags — just run it

### Input Strategy

Full diffs are off the table for token budget reasons. The model works from:

1. PR titles
2. PR bodies/descriptions
3. Commit messages
4. Diffstat (file paths, lines changed, add/remove ratio)

This is sufficient for thematic synthesis. As PR descriptions improve (via the `review-pr` command adoption), the quality of weekly summaries will improve with them.

## Explicitly Out of Scope

- **CTO/devops-oriented views** — architectural drift, operational risk, etc. Desired for the future, not now.
- **Configurable time range** — no `--days` flag. Always 7 days for MVP.
- **Open/draft PRs** — only merged PRs. The developer wants to know what the codebase _is_, not what it might become.
- **Full diff analysis** — token budget constraint. Metadata + diffstat only.
- **Per-PR summaries** — the value is in the synthesis, not the itemization.

## User Stories

- As a developer returning from time away, I want a synthesized summary of the last week's merged changes so that I can quickly rebuild my mental model of the codebase without reading every PR.
    - Acceptance Criteria:
        - [ ] Command queries merged PRs from the last 7 rolling days
        - [ ] Output includes a "Mental Model Shift" section grouped by theme
        - [ ] Output includes a "Risk Callouts" section
        - [ ] Output is written to `docs/reports/weekly-summary-YYYY-MM-DD.md`
        - [ ] Token input is constrained to PR metadata + diffstat (no full diffs)
        - [ ] If no PRs were merged in the last 7 days, the command handles it gracefully (states so, doesn't produce an empty/broken report)

## Edge Cases & Open Questions

- **Repos with very high PR volume**: A busy repo could have 50+ merged PRs in a week. Even metadata-only, that's a lot of input. May need to test and see if there's a practical upper bound, or if the model handles it fine.
- **Repos with zero merged PRs**: Should produce a short file or a message, not an error.
- **File naming collisions**: If run twice on the same day, does it overwrite or append a suffix? Overwrite seems fine — it's a regeneration, not a history.
- **Cross-repo awareness**: Not relevant for MVP, but worth noting that some teams work across multiple repos. Out of scope.

## Success Metrics

- Developer can run the command and get a useful summary in under 2 minutes
- The summary accurately reflects the themes of that week's changes (spot-check against actual PRs)
- Developers voluntarily use it (the real test)

## Handoff Notes for Architect

- This is a Claude Code slash command, same pattern as `review-pr`. Lives in `src/templates/.claude/commands/`.
- The command will need to use `gh` CLI to query merged PRs and `git diff --stat` for diffstats. Both are safe assumptions for the target environment.
- The `review-pr` command is a good reference for structure and tone — this is its weekly-scale sibling.
- `docs/reports/` is already gitignored, so output files won't clutter the repo.
- Token budget is the primary technical constraint. The input strategy (metadata + diffstat, no full diffs) is a product decision, not just a technical one — the synthesized view is more valuable than per-PR detail at this time scale.
