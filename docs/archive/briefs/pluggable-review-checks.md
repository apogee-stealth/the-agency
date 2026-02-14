# Product Brief: Pluggable Review Checks

You must read the `src/templates/.claude/commands/review-pr.md` file before proceeding.

## Problem Statement

The `/review-pr` command ships with hardcoded "Tribal Knowledge Checks" that are specific to one team's conventions (Kysely queries, `@avol/telemetry`, `data-cy` attributes). For any other team consuming `@apogeelabs/the-agency`, these checks are irrelevant noise — and there's no way to add checks that match their own conventions.

Teams need a way to define their own review checks that reflect their codebase's conventions, tech stack, and architectural boundaries.

## Target User

Engineering teams using `@apogeelabs/the-agency` who run `/review-pr` as part of their code review workflow. Specifically, the team member(s) responsible for defining and maintaining the team's code standards and review conventions.

## MVP Scope

### 1. Review checks folder convention

A new folder at `.ai/review-checks/` in the consumer's repo. The presence of markdown files in this folder activates the Tribal Knowledge Checks section of the `/review-pr` command. No files = no tribal knowledge checks section in the output.

### 2. Check file format

Each file is a markdown document grouped by domain (e.g., `react-frontend.md`, `node-backend.md`, `api-services.md`). Each file contains:

- **YAML frontmatter** with:
    - `name` — display name for the check group (e.g., "React & Frontend")
    - `applies_when` — natural language description of when this check group activates, interpreted by the LLM against the diff's file list. Supports file extensions, path-based targeting, or combinations (e.g., `".tsx files in apps/web-client/"`, `".ts files under services/ directories"`)
- **Markdown body** — the checks themselves, written as a list of things to look for and flag

Example:

```markdown
---
name: React & Frontend
applies_when: ".tsx, .jsx, .css, .scss, or .styled.ts files are present in the diff"
---

- **Hard-coded colors**: Are there hex values, rgb(), or named colors that should use theme variables?
- **Missing data-cy attributes**: Do new interactive elements (buttons, inputs, links) have `data-cy` for testing?
- **Accessibility gaps**: Missing alt text on images? Click handlers on non-interactive elements (div, span)? Missing aria labels on icon-only buttons?
```

### 3. Update the `/review-pr` command

- Remove all hardcoded tribal knowledge checks from the command prompt (Step 7)
- Replace with instructions to discover and load check files from `.ai/review-checks/`
- For each check file, evaluate the `applies_when` criteria against the files in the diff
- Only include check groups in the output where the criteria match
- If no check files exist or no criteria match, omit the Tribal Knowledge Checks section entirely

### 4. Pre-packaged review plugins

A new folder at `src/templates/.ai/review-plugins/` containing ready-made check files that teams can copy into their `.ai/review-checks/` folder. These are the starting catalog, seeded from the existing hardcoded checks:

- `react-frontend.md` — hard-coded colors, missing data-cy, accessibility gaps
- `node-backend.md` — console.log usage, boundary violations, raw SQL, error swallowing
- `general.md` — new environment variables, test coverage gaps, type safety (`any`, `as`, `@ts-ignore`)

These files are **not synced** to consumer repos by `the-agency sync`. They live in the source repo as reference material.

### 5. Documentation

Update the README to list the available pre-packaged plugins with descriptions, so consumers know what's available to copy into their repo.

## Explicitly Out of Scope

- **CLI install command** (e.g., `npx the-agency install-review-plugins`) — future enhancement for plugin discovery and installation
- **Syncing review-plugins to consumer repos** — consumers browse the README and copy what they need
- **Formal glob/regex matching DSL for `applies_when`** — the LLM interprets natural language criteria; no deterministic pattern matching
- **Plugin dependencies or ordering** — check files are independent; no composition or inheritance
- **Check severity levels** (warning vs. error) — all checks are advisory and equal in weight
- **Disabling individual checks within a file** — granularity is at the file level; if you don't want a check, remove it from the file

## User Stories

- As a team lead, I want to define review checks that match my team's conventions so that tribal knowledge gets enforced consistently during PR review.
    - Acceptance Criteria:
        - [ ] Markdown files in `.ai/review-checks/` are discovered and loaded by `/review-pr`
        - [ ] Each file's `applies_when` criteria is evaluated against the diff's file list
        - [ ] Only matching check groups appear in the output
        - [ ] Check output uses the `name` from frontmatter as the section heading

- As a team lead, I want to target checks by file type and path so that I can apply different standards to different parts of a monorepo.
    - Acceptance Criteria:
        - [ ] `applies_when` supports file extension targeting (e.g., ".tsx files")
        - [ ] `applies_when` supports path-based targeting (e.g., "files under services/")
        - [ ] `applies_when` supports combined criteria (e.g., ".ts files in packages/shared/")
        - [ ] Checks for `services/api/` don't fire when only `packages/shared/` files changed

- As a reviewer, I want the review output to skip tribal knowledge checks entirely when no check files are configured so that I don't see an empty or irrelevant section.
    - Acceptance Criteria:
        - [ ] No `.ai/review-checks/` folder = no Tribal Knowledge Checks section in output
        - [ ] Empty `.ai/review-checks/` folder = no Tribal Knowledge Checks section in output
        - [ ] Check files present but none matching the diff = no Tribal Knowledge Checks section in output

- As a new consumer of the-agency, I want to browse available pre-packaged checks so that I can quickly set up review checks without writing everything from scratch.
    - Acceptance Criteria:
        - [ ] Pre-packaged check files exist in `src/templates/.ai/review-plugins/`
        - [ ] README documents available plugins with descriptions
        - [ ] Copying a plugin file to `.ai/review-checks/` activates it with no further configuration

## Edge Cases & Open Questions

1. **Malformed check files**: If a file in `review-checks/` is missing frontmatter or has invalid YAML, the command should skip it and note the issue in output rather than failing entirely.

2. **Overlapping criteria**: Multiple check files could match the same diff files (e.g., a `node-backend.md` and an `api-services.md` both matching `.ts` files in `services/`). This is fine — both run, and the reviewer gets both sets of checks. No deduplication needed.

3. **Very large number of check files**: Unlikely in practice, but if a team has 20+ check files, the Tribal Knowledge section could dominate the output. No mitigation needed for MVP — trust teams to be reasonable.

4. **Non-markdown files in the folder**: Ignore anything that isn't a `.md` file.

5. **LLM interpretation of `applies_when`**: Since matching is non-deterministic, edge cases in criteria phrasing could produce inconsistent results. Acceptable trade-off — these are advisory checks, not a CI gate.

## Success Metrics

- **Adoption**: Consumer repos actually create `.ai/review-checks/` files (observable when supporting consumers)
- **Relevance**: Tribal knowledge checks in review output are relevant to the repo's actual conventions (qualitative, gathered from team feedback)
- **Reduction in false matches**: Checks don't fire for irrelevant file changes (qualitative)
- **Plugin reuse**: Pre-packaged plugins are copied and adapted by consumers rather than written from scratch

## Handoff Notes for Architect

- The main implementation target is `src/templates/.claude/commands/review-pr.md` — the prompt itself needs to be rewritten to discover and load check files dynamically instead of using hardcoded checks.
- The `.ai/review-checks/` folder is in the consumer's repo, not in this package. The command prompt needs to instruct Claude to look for it at runtime.
- The `.ai/review-plugins/` folder lives in `src/templates/.ai/review-plugins/` but is NOT added to the sync manifest. It's reference material only.
- YAML frontmatter parsing happens at the LLM level — Claude reads the file and interprets the frontmatter. No code-level parsing needed.
- The `applies_when` matching is intentionally fuzzy (LLM-interpreted). The architect should write clear prompting to make this as reliable as possible, but it does not need to be deterministic.
- The manifest in `src/manifest.ts` should NOT include the `review-plugins/` folder. These files don't sync.
- Consider whether the command prompt should include an example of what a well-formed check file looks like, to help the LLM parse them correctly.
