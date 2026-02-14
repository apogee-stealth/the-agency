# Build Plan: Install Review Plugins Command

## Context Source

Voice conversation with project owner. No product brief — requirements gathered interactively.

## Problem Summary

The agency package ships reference review-check files (`src/review-plugins/`) that consumers can use to enhance their PR review process. Currently there's no CLI command to install these — users have to manually copy them. We need a new `the-agency install-review-plugins` command that presents an interactive multi-select of available review plugins and copies the selected ones to `.ai/review-checks/` in the consumer's project.

This is deliberately separate from the existing `sync` command. Sync handles the core setup (agents, commands, AI context files); review plugins are optional extras that users pick à la carte.

## Technical Approach

Add a new standalone module (`src/install-review-plugins.ts`) that follows the same structural patterns as `sync.ts` but is self-contained. It reads from a review plugins manifest, presents a multi-select prompt, handles overwrite confirmation, and copies files to the destination directory. The CLI entry point gets a new `install-review-plugins` command that delegates to this module.

The manifest gets a new `reviewPlugins` section using the same `ManifestItem` shape. The review plugins source directory is already in the package but needs to be explicitly included in `package.json`'s `files` array so it ships to consumers.

## Key Design Decisions

- **Standalone module, not an extension of sync**
    - **Why**: Different semantics — sync is "give me the full setup," review plugins are "let me pick optional extras." Keeping them separate avoids muddying the sync abstraction.
    - **Trade-off**: Some pattern duplication between `sync.ts` and `install-review-plugins.ts`. Acceptable given the small codebase and the clarity it provides.

- **Manifest-based with hand-written descriptions (not frontmatter parsing)**
    - **Why**: Consistent with existing manifest pattern. Four files don't justify adding YAML parsing at runtime.
    - **Trade-off**: Descriptions could drift from frontmatter. Manageable at this scale.

- **Always interactive (multi-select)**
    - **Why**: Review plugins are opt-in by nature. A "copy all" default doesn't match the use case — users should consciously choose which checks apply to their stack.
    - **Trade-off**: No non-interactive/CI mode. Can add `--all` flag later if needed.

## Existing Patterns to Follow

- `sync.ts` — file copy pattern: build file list → check for existing → overwrite prompt → copy with `mkdir -p`
- `manifest.ts` — `ManifestItem` interface for `{ file, description }`
- `cli.ts` — command routing pattern (simple if/else on `args[0]`)
- `sync.test.ts` — testing pattern: mock `fs/promises` and `prompts`, use `jest.unstable_mockModule`
- `prompts` library for interactive selection (already a dependency)

## Implementation Tasks

### Task 1: Extend Manifest with Review Plugins

- **What**: Add a `reviewPlugins` array to the manifest and update the `Manifest` interface.
- **Files**: `src/manifest.ts`
- **Details**:
    - Add `reviewPlugins: ManifestItem[]` to the `Manifest` interface
    - Add entries for all four plugins:
        - `general.md` — "General checks: env vars, type safety, dead code, debugging leftovers, breaking changes, binary assets"
        - `node-backend.md` — "Node.js backend checks: API design, error handling, security, database patterns"
        - `react-frontend.md` — "React frontend checks: component design, hooks, rendering, accessibility"
        - `unit-test.md` — "Unit test checks: test quality, coverage, mocking patterns, assertions"
    - Descriptions should be concise since they appear in the multi-select prompt
- **Basic Tests**: Existing manifest test (if any) still passes; new entries are present
- **Done when**: `manifest.reviewPlugins` has all four entries with accurate descriptions

### Task 2: Create Install Review Plugins Module

- **What**: New standalone module that handles the interactive install flow.
- **Files**: Create `src/install-review-plugins.ts`
- **Details**:
    - Export `installReviewPlugins()` async function
    - Source path: `src/review-plugins/` (relative to package root)
    - Destination path: `.ai/review-checks/` (relative to cwd)
    - Build choices from `manifest.reviewPlugins` — all selected by default
    - Present multi-select prompt via `prompts`
    - Check which destination files already exist
    - If any exist, show overwrite confirmation prompt
    - Copy selected files, creating directories as needed
    - Log each copied file and a summary count
    - Handle empty selection and cancelled prompts gracefully
    - Reuse the `fileExists` helper — import from `sync.ts` or duplicate (it's 5 lines)
- **Basic Tests**: Multi-select presented, files copied for selection, overwrite flow works, empty selection exits cleanly
- **Done when**: `installReviewPlugins()` copies selected plugin files to `.ai/review-checks/`

### Task 3: Wire Up CLI Command

- **What**: Add `install-review-plugins` command to the CLI entry point and update help text.
- **Files**: `src/cli.ts`
- **Details**:
    - Add `install-review-plugins` to the command routing
    - Import and call `installReviewPlugins()` from the new module
    - Update help text to include the new command with a brief description
- **Basic Tests**: N/A (CLI wiring is thin; covered by integration/manual testing)
- **Done when**: `npx the-agency install-review-plugins` launches the interactive flow

### Task 4: Update Package Files

- **What**: Ensure review plugin source files are included in the published package.
- **Files**: `package.json`
- **Details**:
    - Add `"src/review-plugins/"` to the `files` array
    - Verify with `pnpm pack --dry-run` that the review plugin files appear in the tarball
- **Basic Tests**: Dry-run pack includes `src/review-plugins/*.md`
- **Done when**: `pnpm pack` includes review plugin files

### Task 5: Tests for Install Review Plugins

- **What**: Unit tests following the same mocking pattern as `sync.test.ts`.
- **Files**: Create `src/install-review-plugins.test.ts`
- **Details**:
    - Mock `fs/promises` (access, mkdir, copyFile) and `prompts`
    - Test cases:
        - Copies selected files to `.ai/review-checks/`
        - Presents multi-select with all plugins
        - Prompts for overwrite when destination files exist
        - Aborts when user declines overwrite
        - Skips overwrite prompt when no conflicts
        - Exits cleanly on empty selection
        - Exits cleanly on cancelled prompt (undefined)
- **Basic Tests**: All the above
- **Done when**: All tests pass, coverage mirrors sync test coverage

## Technical Risks

- **Risk**: `src/review-plugins/` path resolution differs between local dev (symlinks) and installed package
    - **Mitigation**: Use the same `packageRoot` pattern as `sync.ts` — `resolve(__dirname, "..")` — which resolves correctly in both contexts. Verify with a local `pnpm pack` + install test.
    - **Likelihood**: Low (same pattern already works for sync)

- **Risk**: New manifest field could break existing sync if not handled carefully
    - **Mitigation**: `sync` explicitly references `manifest.agents`, `.commands`, and `.ai` — it doesn't iterate all keys. Adding `reviewPlugins` won't affect it.
    - **Likelihood**: Low

## Dependencies

None new. Uses existing `prompts` package and Node.js built-ins.

## Handoff Notes for Developer

- The `fileExists` helper in `sync.ts` is already exported. Import it rather than duplicating.
- Review plugin files have YAML frontmatter — they're copied as-is, no parsing needed.
- The destination `.ai/review-checks/` matches what the `review-pr` command expects to find. Don't change this path without checking that command.
- Keep the test file structure parallel to `sync.test.ts` — same mock setup pattern, same describe/it structure. Future maintainers will thank you.
- The existing `sync.test.ts` has an `import` for manifest that verifies the manifest shape works at test time. Consider a similar smoke test for the review plugins manifest entries.
