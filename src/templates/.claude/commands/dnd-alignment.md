# D&D Alignment Chart Command

## Goal

Analyze recent commit history and assign a D&D alignment (Lawful Good, Neutral Good, Chaotic Good, Lawful Neutral, True Neutral, Chaotic Neutral, Lawful Evil, Neutral Evil, Chaotic Evil) to each committer based on their commit patterns, message style, and the nature of their work. This is for fun — treat it like a roast, not a performance review.

## Constraints

- **Be funny.** Dry humor, sarcasm, and well-placed jabs are mandatory. This is a comedy bit backed by data, not a Jira report.
- **Ground it in evidence.** Quote actual commit messages. The humor lands because it's _true_.
- **Every committer gets a fantasy class/title** in addition to their alignment. The title should reflect their commit personality (e.g., "The Paladin of Tech Debt," "The Test Suite Warlock").
- **Include commit counts** as supporting data for each person.
- **Don't pull punches.** If someone's commit history is chaotic, say so. If someone made one commit and vanished, that's comedy gold.
- **Don't be cruel.** Roast the commits, not the person. There's a line between "your commit history is a hostage negotiation" and actually being mean.
- **Typos in commit messages are fair game.** Always.

## Step 1: Fetch Commit History

Fetch the last ~30 days of non-merge commits:

```bash
git log --since="30 days ago" --pretty=format:"%an|%s" --no-merges
```

Also get per-author commit counts:

```bash
git log --since="30 days ago" --pretty=format:"%an" --no-merges | sort | uniq -c | sort -rn
```

## Step 2: Analyze Patterns

For each committer, look for patterns in their commit messages and work:

- **What kind of work do they do?** Feature building, bug fixing, cleanup, infrastructure, tests, docs?
- **How do they name commits?** Terse? Verbose? Chaotic capitalization?
- **What's their commit cadence?** Many small commits or few large ones?
- **Any recurring themes?** Lots of "fix" commits? Lots of "remove" commits? An endless skip/unskip cycle?
- **Anything funny in the messages?** Typos, frustration, oddly specific wording?

Use these patterns to determine alignment:

- **Lawful**: Follows process, systematic, methodical, adds tooling/enforcement
- **Chaotic**: Unpredictable patterns, high blast radius, skip/unskip cycles, inconsistent capitalization
- **Neutral**: Balanced, pragmatic, no strong lean either way
- **Good**: Improves things for others, security fixes, cleanup, documentation
- **Evil**: Breaks things (intentionally or otherwise), adds complexity, creates tech debt
- **Neutral (moral axis)**: Neither improves nor degrades, just ships what's needed

## Step 3: Write the Report

Write the output to `docs/reports/dnd-alignment-chart-YYYY-MM-DD.md` (using today's date).

If a file already exists at that path, overwrite it.

## Output Format

```markdown
# {Repo Name} — D&D Alignment Chart ({Month} {Year})

Based on ~{N} commits from the last 30 days. This is strictly for fun and not a performance review (unless your alignment is Chaotic Evil, in which case HR will be in touch).

---

## {Name} — **{Alignment}** ({Fantasy Title})

**{N} commits** | Evidence: {quoted commit message snippets}

{1-2 paragraphs of analysis with humor. Reference specific commits. Make it sting a little.}

---

[Repeat for each committer, ordered by commit count descending]

---

_Roll for initiative on that next PR._
```

## Notes

- If someone has only 1 commit, lean into the mystery of it. One commit is inherently funny.
- If the repo has a co-author bot (like Claude), don't assign it an alignment — it's an NPC.
- End with the "Roll for initiative" line. It's tradition now.
