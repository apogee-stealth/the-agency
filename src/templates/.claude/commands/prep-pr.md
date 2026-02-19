# Prep PR Command

## Goal

Prepare and create a draft pull request for the current branch. Run pre-submission checks, generate a PR title and description, collect testing steps, and create the draft PR.

This command takes no arguments. It operates on the currently checked-out branch.

<!-- Sibling command: review-pr.md uses the same plugin discovery/loading flow but with deeper evaluation. If the plugin format changes, update both files. -->

## Constraints

- This command is conversational. There are multiple points where you pause and wait for developer input (Step 2, Step 6, Step 7, Step 8). Don't try to rush through without their responses.
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

Check that there are commits ahead of the target branch:

```bash
git log --oneline $TARGET..HEAD
```

**If no commits are returned**, stop and output:

> **No commits ahead of `{$TARGET}`. Nothing to PR.** You may need to rebase.

Gather the change data:

```bash
# File list with change stats
git diff --stat $TARGET...HEAD

# Full diff
git diff $TARGET...HEAD

# Commit log (excluding merges)
git log --no-merges --oneline $TARGET..HEAD
```

## Step 4: Review Plugin Checks

Review plugin checks are loaded dynamically from `.ai/review-checks/`. Each check file is a markdown file with YAML frontmatter.

<!-- This is the same discovery/loading flow as review-pr.md, but with lighter evaluation: pass/fail with brief file/line pointers rather than full reviewer narrative. -->

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

2. **If the directory does not exist or contains no `.md` files**, skip the entire review plugin checks section silently — no error, no placeholder text. Proceed to Step 5.

3. **If files are found**, read each one:

```bash
cat .ai/review-checks/*.md
```

4. For each file, parse the YAML frontmatter to extract `name` and `applies_when`. If a file is missing frontmatter or has invalid/unparseable YAML, skip it and note: "Skipped `{filename}`: missing or invalid frontmatter."

5. Evaluate each file's `applies_when` value against the list of changed files from the diff (gathered in Step 3). Use your judgment — `applies_when` is natural language, not a glob pattern. Match generously but sensibly.

6. For each check group where `applies_when` matches, evaluate each check item against the diff. Output format: **pass/fail per check with brief file/line pointers for failures** — enough breadcrumb to find and fix the issue, not a full review narrative.

7. If files exist but **none** of their `applies_when` criteria match the diff, skip the check results silently.

Store the check results — they'll be included in the PR body later.

Display the check results to the developer as you go so they can see what passed and what needs attention.

## Step 5: Generate Title and Description

Analyze the diff and commit history gathered in Step 3. Generate:

- **Title**: Concise, reflects the nature of the changes (bug fix, feature, refactor, etc.). Keep it under 70 characters.
- **Description**: Summarize what changed and why. Focus on the "so what" — not a restatement of the diff. Draw from commit messages and the actual code changes.

For large diffs, prioritize analyzing `git diff --stat` and the commit log, then selectively read diffs for the most significant files rather than trying to process the entire diff.

## Step 6: Collect Testing Steps

Ask the developer:

> **Testing steps — how should a reviewer verify these changes?**

The developer provides their own testing steps as free-form text. These are NOT AI-generated. Wait for their input before proceeding.

## Step 7: Present Full Preview

Show the developer the complete PR preview:

```
## PR Preview

**Title:** {generated title}

---

## Summary

{generated description}

## Test Plan

{developer-provided testing steps}
```

If check results exist from Step 4, also show:

```
<details>
<summary>Pre-submission Checks</summary>

{check results — pass/fail with names}

</details>
```

Then ask:

> **Review the preview above.** Want to edit anything (title, description, testing steps), or good to go?

Let the developer make edits. Iterate until they're satisfied.

## Step 8: Push Branch

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

## Step 9: Create Draft PR

Assemble the PR body:

```
## Summary

{description}

## Test Plan

{testing steps}
```

If check results exist from Step 4, append:

```
<details>
<summary>Pre-submission Checks</summary>

{check results — pass/fail with names}

</details>
```

If no check results (no plugin files found or none matched), omit the `<details>` section entirely.

Create the draft PR:

```bash
gh pr create --draft --base $TARGET --title "{title}" --body "{body}"
```

**If this succeeds**, display:

> **Draft PR created:** {URL}

**If this fails**, report the error and stop.
