# Build Plan: Pluggable Review Checks

## Context Source

Product brief at `docs/briefs/pluggable-review-checks.md`, plus architecture conversation.

## Problem Summary

The `/review-pr` command has hardcoded "Tribal Knowledge Checks" baked into the prompt — Kysely queries, `@avol/telemetry`, `data-cy` attributes — that only make sense for one team. Any other team consuming `@apogeelabs/the-agency` gets irrelevant noise with no way to customize.

This feature makes tribal knowledge checks pluggable. Teams define their own checks as markdown files in `.ai/review-checks/`, and the `/review-pr` command discovers and loads them at runtime. Pre-packaged plugins ship as reference material for teams to copy and adapt.

## Technical Approach

All changes are prompt-level — no TypeScript code changes, no manifest updates, no new dependencies.

The `/review-pr` command prompt (`src/templates/.claude/commands/review-pr.md`) gets two modifications: Step 4 becomes generic (no hardcoded monorepo paths), and Step 7 switches from hardcoded checks to a discovery-and-load sequence that reads markdown files from `.ai/review-checks/` at runtime.

Pre-packaged plugin files live in `src/review-plugins/` (outside the `src/templates/` tree, so they're not symlinked or synced). These are reference material — teams browse the README and copy what they need.

## Key Design Decisions

- **Plugins live in `src/review-plugins/`, not `src/templates/.ai/review-plugins/`**
    - **Why**: `src/templates/.ai/` is symlinked into the repo root for dogfooding. Plugins are source material, not configuration — they shouldn't appear in `.ai/` via the symlink. Keeping them in `src/review-plugins/` also sets up cleanly for the future CLI install command.
    - **Trade-off**: Slightly unconventional path (not under `templates/`), but the separation is worth it.

- **Prescriptive shell commands in the prompt for file discovery**
    - **Why**: Explicit `ls` and `cat` commands reduce ambiguity about how Claude should find and read check files. Declarative instructions ("discover and load") leave too much room for the LLM to improvise.
    - **Trade-off**: More verbose prompt, but more reliable behavior.

- **Step 4 made generic — categorize by top-level directory / workspaces**
    - **Why**: The hardcoded path categories (`packages/shared/*`, `services/api/*`) are as team-specific as the tribal knowledge checks. Generic categorization works for any repo.
    - **Trade-off**: Slightly less structured output for the original team, but they can compensate with check files that reference their specific paths.

- **Inline example of check file format in the prompt**
    - **Why**: Cheap insurance — helps the LLM parse YAML frontmatter reliably. ~10 lines of prompt for significantly more consistent behavior.
    - **Trade-off**: Slightly longer prompt, negligible cost.

- **`applies_when` matching is LLM-interpreted, not deterministic**
    - **Why**: Per the brief, this is intentionally fuzzy. Natural language criteria ("`.tsx` files in `apps/web-client/`") are interpreted by the LLM against the diff's file list. No glob/regex DSL.
    - **Trade-off**: Possible inconsistency on edge cases, but these are advisory checks, not CI gates.

## Existing Patterns to Follow

- Command files are pure markdown, no frontmatter — the check files use frontmatter, but the command file itself does not.
- The existing prompt uses explicit bash code blocks for shell commands Claude should run (see Steps 1-3).
- The `.ai/` directory convention is already established for AI context files (unit test guides, workflow docs).

## Implementation Tasks

### Task 1: Create pre-packaged plugin files

- **What**: Create three markdown check files in `src/review-plugins/`, seeded from the existing hardcoded checks in Step 7. Each file gets YAML frontmatter (`name`, `applies_when`) and the checks as a markdown body.
- **Files**:
    - Create `src/review-plugins/react-frontend.md`
    - Create `src/review-plugins/node-backend.md`
    - Create `src/review-plugins/general.md`
- **Details**:
    - `react-frontend.md`: `applies_when` targets `.tsx, .jsx, .css, .scss, .styled.ts` files. Checks: hard-coded colors, missing data-cy attributes, accessibility gaps.
    - `node-backend.md`: `applies_when` targets `.ts` files in backend/service directories (not test files). Checks: console.log usage, boundary violations, raw SQL, error swallowing. Generalize away from team-specific references — replace "Kysely" with "parameterized queries" and "`@avol/telemetry`" with "the project's structured logger".
    - `general.md`: `applies_when` is unconditional (always applies). Checks: new environment variables, test coverage gaps, type safety (`any`, `as`, `@ts-ignore`).
- **Basic Tests**: Manual — copy a plugin file to `.ai/review-checks/`, run `/review-pr` on a test PR, verify it gets picked up.
- **Done when**: Three well-formed plugin files exist in `src/review-plugins/` with correct frontmatter and generalized check content.

### Task 2: Rewrite Step 4 of `review-pr.md` — generic file categorization

- **What**: Strip the hardcoded monorepo path categories from Step 4. Replace with generic categorization logic.
- **Files**:
    - Modify `src/templates/.claude/commands/review-pr.md` (Step 4, lines ~56-82)
- **Details**:
    - Keep the noise file filtering (lock files, dist/build, binaries) — it's universal.
    - Remove the hardcoded "Categorize by area" block (`packages/shared/*`, `packages/db/*`, etc.).
    - Replace with: categorize changed files by top-level directory. If workspace definitions exist (`package.json` workspaces field or `pnpm-workspace.yaml`), use those to inform grouping.
    - Remove the "Identify file types present" block — this was only needed to drive the hardcoded checks in Step 7. With pluggable checks, `applies_when` handles file-type relevance.
- **Basic Tests**: Run `/review-pr` on a PR and verify the file categorization is sensible without the hardcoded paths.
- **Done when**: Step 4 contains no team-specific path references and produces reasonable categorization for any repo structure.

### Task 3: Replace Step 7 of `review-pr.md` — pluggable check discovery

- **What**: Remove the hardcoded tribal knowledge checks. Replace with instructions to discover, load, and evaluate check files from `.ai/review-checks/`.
- **Files**:
    - Modify `src/templates/.claude/commands/review-pr.md` (Step 7, lines ~148-170, plus output format section)
- **Details**:
    - New Step 7 flow:
        1. List markdown files: `ls .ai/review-checks/*.md 2>/dev/null`
        2. If no directory or no `.md` files, skip the entire Tribal Knowledge Checks section (no heading, no placeholder text).
        3. If files found, read each file.
        4. Parse the YAML frontmatter to extract `name` and `applies_when`. If a file is missing frontmatter or has invalid YAML, skip it and note in output: "Skipped `{filename}`: missing or invalid frontmatter."
        5. Evaluate `applies_when` against the list of files from the diff (gathered in Step 3). Use the LLM's interpretation — no deterministic matching.
        6. For each check group where `applies_when` matches, include its checks in the output under a heading using `name` from frontmatter.
        7. If files exist but none match the diff, skip the Tribal Knowledge Checks section entirely.
    - Include an inline example of the expected check file format (frontmatter + body) so the LLM knows exactly what it's parsing.
    - Use explicit bash commands: `ls` for discovery, read each file for content.
    - Update the output format section: make the Tribal Knowledge Checks heading and content conditional. Add a note that this section only appears when matching check files are found.
- **Basic Tests**:
    - No `.ai/review-checks/` directory → no Tribal Knowledge Checks section in output
    - Empty `.ai/review-checks/` directory → no Tribal Knowledge Checks section in output
    - Check file with `applies_when` that matches the diff → checks appear under `name` heading
    - Check file with `applies_when` that doesn't match → checks don't appear
    - Malformed file (no frontmatter) → skipped with note
- **Done when**: Step 7 is fully dynamic — no hardcoded checks remain, and the section appears only when matching check files exist.

### Task 4: Update the README

- **What**: Document the `.ai/review-checks/` convention and list the available pre-packaged plugins.
- **Files**:
    - Modify `README.md`
- **Details**:
    - Add a section explaining the review checks folder convention (`.ai/review-checks/`), the file format (frontmatter + body), and how `applies_when` works.
    - List each pre-packaged plugin from `src/review-plugins/` with its name, what it checks, and what file types it targets.
    - Include brief instructions: "Copy any of these files to `.ai/review-checks/` in your repo to activate them."
    - Keep it concise — this is reference documentation, not a tutorial.
- **Basic Tests**: Read the README and verify the plugin descriptions match the actual file contents.
- **Done when**: README documents the convention and lists all available plugins with accurate descriptions.

## Technical Risks

- **Risk**: LLM inconsistently interprets `applies_when` criteria, leading to checks firing (or not firing) unexpectedly.
    - **Mitigation**: Use clear, specific language in the pre-packaged plugin `applies_when` fields as examples of good practice. Include the inline example in the prompt to anchor the LLM's parsing. Accept that edge cases will exist — these are advisory, not gates.
    - **Likelihood**: Medium (but low impact — worst case is a slightly noisy or slightly incomplete review)

- **Risk**: LLM fails to parse YAML frontmatter correctly from the check files.
    - **Mitigation**: Include an inline example of the exact format in the Step 7 prompt instructions. Keep the frontmatter minimal (two fields only).
    - **Likelihood**: Low

- **Risk**: The `ls .ai/review-checks/*.md` command behaves differently across shells or OS environments (e.g., zsh glob no-match errors).
    - **Mitigation**: The `2>/dev/null` redirect handles the "no files" case. Test on both bash and zsh. If needed, use `find` as a fallback.
    - **Likelihood**: Low

## Dependencies

None. No new packages, services, or APIs.

## Handoff Notes for Developer

- **The canonical files live in `src/templates/`**. Because of the dogfooding symlinks, editing `src/templates/.claude/commands/review-pr.md` and `.claude/commands/review-pr.md` are the same file. Edit via the `src/templates/` path.
- **Don't touch `src/manifest.ts`**. The review-plugins directory is not synced to consumers.
- **Generalize the plugin content**. The existing hardcoded checks reference team-specific tools (`@avol/telemetry`, Kysely). The pre-packaged plugins should use generic language ("structured logger", "parameterized queries") so they're useful to any team.
- **The output format section** (at the bottom of `review-pr.md`) needs updating too — it currently shows Tribal Knowledge Checks as a fixed section. Make it conditional with a note.
- **For testing**: you can create `.ai/review-checks/` in this repo (it'll actually be `src/templates/.ai/review-checks/` via the symlink) and run `/review-pr` against a real PR to verify the discovery flow works. Clean up after testing — don't commit test check files unless we want them for dogfooding.
