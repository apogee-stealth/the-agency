# Weekly Summary Command

## Goal

Synthesize the last 7 days of merged pull requests into a thematic briefing that updates a developer's mental model of how the codebase shifted — not a changelog, not a list of PRs, but a narrative of what changed and why it matters.

## Constraints

- **Group by theme, not by PR.** This is the most important constraint. If you catch yourself writing "PR #N:" at the start of a bullet, you've already failed. Restructure around themes.
- **Do NOT summarize each PR individually.** Do NOT produce a bulleted list of PR titles. Do NOT write "PR #42 did X, PR #43 did Y."
- **Think like a teammate giving a hallway briefing**, not a release notes generator. The reader was away for a week and wants to rebuild their mental model in 5 minutes.
- **Diffstats are your best friend.** PR titles can be misleading. PR descriptions can be empty. But file paths and change volumes don't lie. Lean on them.
- **Be concise.** This is a briefing, not a novel. Each thematic section should be a tight paragraph or two.
- **Be honest.** Uncertainty is fine. "Not sure what this was about" beats a confident hallucination every time.
- **Never hallucinate changes.** Only report what the data shows. If a file wasn't in any diffstat, don't claim it was changed.
- **Prioritize signal.** Not every PR deserves mention. A typo fix or a lockfile update doesn't need a thematic narrative. Focus on changes that actually shift how a developer thinks about the codebase.

## Step 1: Determine Date Range

Calculate the date 7 days ago from today. This is your cutoff — only PRs merged on or after this date are included.

```bash
# Get today's date and the date 7 days ago (macOS and Linux compatible)
date -u +%Y-%m-%d 2>/dev/null || date -u -I
```

Store these as `start_date` (7 days ago) and `end_date` (today) for use in the output header.

## Step 2: Fetch Merged PRs

```bash
gh pr list --state merged --json number,title,body,mergedAt,additions,deletions,changedFiles,commits --limit 100
```

Filter the results to only PRs where `mergedAt` falls within the last 7 days. The `--limit 100` returns recent merges, but `gh` doesn't natively filter by date — you must verify each PR's `mergedAt` timestamp against your cutoff.

## Step 3: Handle Zero PRs

If no PRs were merged in the last 7 days, create the output directory and write a short report:

```bash
mkdir -p docs/reports
```

Write to `docs/reports/weekly-summary-YYYY-MM-DD.md` (using today's date):

```markdown
# Weekly Summary: YYYY-MM-DD

**Period**: {start_date} to {end_date}
**PRs merged**: 0

---

No pull requests were merged during this period. Nothing to report.
```

**Stop here.** Do not proceed to subsequent steps.

## Step 4: Fetch Per-PR File Stats

First, get the repo's owner and name dynamically:

```bash
gh repo view --json nameWithOwner --jq .nameWithOwner
```

Then, for each merged PR in your filtered set, fetch file-level change stats:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/files?per_page=100
```

This returns per-file additions, deletions, filename, and status (added/modified/removed/renamed). This is your diffstat equivalent — it tells you _what areas_ of the codebase each PR touched, which is often more informative than the PR description itself.

⚠️ For PRs that touch more than 100 files, append `--paginate` to get the full list.

## Step 5: Synthesize

With all PR metadata and file-level stats assembled, produce the output. The output has two sections: **Mental Model Shift** and **Risk Callouts**.

### Mental Model Shift

This is the core of the report. Group changes **by theme, not by PR**.

Good themes look like:

- "Auth migrated from session cookies to JWT"
- "New caching layer introduced across API endpoints"
- "Test infrastructure overhauled — Jest replaced with Vitest"
- "Data model restructured — users and accounts split into separate tables"
- "Build pipeline rewritten around Turborepo"

Bad output looks like:

- "PR #42: Updated auth module"
- "PR #43: Added caching to user endpoint"
- "PR #44: Fixed test runner"

If multiple PRs contribute to the same theme, **weave them together** into a single narrative section. The PR numbers are supporting evidence, not the organizing principle.

**Use diffstats to inform emphasis.** High-churn areas (lots of files changed, lots of additions/deletions) deserve more attention in the narrative. A PR that touches 50 files across 3 packages is more architecturally significant than one that fixes a typo.

**Use file paths to reveal what changed.** Even when PR descriptions are sparse or absent, the file paths in the diffstat tell you which areas of the codebase were affected. A cluster of changes in `src/auth/` tells a story even without a word of description.

**Be honest about uncertainty.** If PR descriptions are vague and the diffstats are ambiguous, say so. "Several PRs touched the payments module but descriptions were sparse — worth checking with the team on what shifted" is better than fabricating a narrative.

### Risk Callouts

Flag anything that could bite a developer who wasn't watching. These are things worth knowing about _before_ they surprise you in a code review, a deploy, or a debugging session:

- **Breaking changes** — public API modifications, interface changes, removed exports
- **New patterns replacing old ones** — if a PR introduces a new way of doing X, anyone still doing it the old way will diverge
- **High-churn areas** — parts of the codebase with heavy modification across multiple PRs (potential merge conflict zones)
- **New dependencies** — added packages, especially heavy or opinionated ones
- **Removed capabilities** — deleted features, deprecated endpoints, dropped support
- **Things that will surprise you** — behavioral changes, default value shifts, renamed concepts

If there are genuinely no risks, say "No significant risks identified" — don't manufacture concern.

## Step 6: Write Output

```bash
mkdir -p docs/reports
```

Write the synthesized report to `docs/reports/weekly-summary-YYYY-MM-DD.md` (using today's date). If a file already exists at that path, overwrite it — re-running on the same day is a regeneration, not a duplicate.

## Output Format

```markdown
# Weekly Summary: YYYY-MM-DD

**Period**: {start_date} to {end_date}
**PRs merged**: {count}

---

## Mental Model Shift

[Thematic narrative sections. Each section has a descriptive heading and a prose explanation of how the codebase shifted in that area. PR numbers referenced inline as supporting evidence, not as the organizing structure.]

---

## Risk Callouts

[Bulleted risk items with enough context to understand the concern, or "No significant risks identified."]
```
