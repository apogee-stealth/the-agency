# Retrospective — Interactive Consolidation

## Goal

Consolidate per-feature retro files into shared lessons in `.ai/lessons-learned.md`. You present findings, the user decides what stays.

## Flow

### Step 1: Discovery

Glob for `.ai/retro/retro-*.md` files. Exclude anything under `.ai/retro/archive/`.

If no retro files are found, tell the user there's nothing to consolidate and stop.

### Step 2: Summarize

Read all unprocessed retro files. Group findings across features by lessons-learned category:

- **Review Patterns** — recurring review findings across features
- **Common Fix Loop Triggers** — what keeps sending code back for fixes
- **Test Coverage Priorities** — gaps that keep appearing
- **Code Patterns** — deviations and practices worth codifying

For each proposed lesson, show which feature(s) contributed the finding. If two retro files contain contradictory patterns, surface both and let the user decide.

Present the grouped findings to the user before proceeding.

### Step 3: Curate

Walk through each proposed lesson interactively. For each one, ask the user to:

- **Accept** — add it as-is to lessons-learned
- **Modify** — user provides revised wording, then accept
- **Reject** — skip it
- **Merge** — combine with an existing lesson in lessons-learned (show candidates)

Do not batch these. One at a time. The user needs to see each lesson in context.

### Step 4: Write

Update `.ai/lessons-learned.md` with accepted and modified lessons. If the file doesn't exist, create it with the standard section headers first.

**Merge into existing sections.** Do not overwrite existing lessons. Append new lessons under the appropriate section header.

Each lesson follows this format:

```
- **[Pattern]**: [What to do or avoid] — *Source: [feature-name(s)]*
```

### Step 5: Archive

Move all processed retro files to `.ai/retro/archive/`:

```bash
mkdir -p .ai/retro/archive
mv .ai/retro/retro-*.md .ai/retro/archive/
```

### Step 6: Remind

After archiving, print:

> Reminder: `lessons-learned.md` grows over time. Periodically review it and prune lessons that are no longer relevant or have been superseded. There is no automated staleness detection — you are the quality gate.

## `lessons-learned.md` Schema

```markdown
# Lessons Learned

## Review Patterns

- **[Pattern]**: [What to do or avoid] — _Source: [feature-name(s)]_

## Common Fix Loop Triggers

- **[Trigger]**: [How to avoid it] — _Source: [feature-name(s)]_

## Test Coverage Priorities

- **[Area/Pattern]**: [What to watch for] — _Source: [feature-name(s)]_

## Code Patterns

- **[Pattern]**: [Guidance] — _Source: [feature-name(s)]_
```
