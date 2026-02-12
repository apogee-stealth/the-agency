# Product Brief: PR Review Command

## Problem Statement

AI-assisted development has increased the pace of code output, but human review bandwidth hasn't scaled to match. PRs are getting larger, landing faster, and reviewers are losing their up-to-date mental model of the system. The result: orphaned code nobody knows about, architectural shifts that get lost in the volume of file changes, and tribal knowledge that only gets enforced when someone happens to remember.

The existing PR checklist template is a manual process that nobody follows — checkboxes go unchecked, and the real quality gate is "hopefully someone catches it during review."

## Target User

Developers acting as PR reviewers in a pull-based review system (reviewers opt into reviews, not assigned). They work locally — pulling PR branches to run the code — and use GitHub's diff view alongside local file inspection. They use Claude Code in both CLI and Cursor IDE contexts.

## MVP Scope

A Claude Code slash command (`/review-pr`) that a reviewer runs locally to get a structured briefing on a PR before diving into the diff. The command either operates on the currently checked-out PR branch or accepts a PR number to fetch and check out the branch.

### Output Sections

The command produces inline markdown with the following sections:

#### 1. Narrative Summary (Mental Model Update)

Each narrative block pairs two sub-sections — the mental model shift and what changed structurally — so reviewers get the "so what" and the "what" together in context.

- Organized per-commit for small/medium PRs; grouped by theme for large PRs (30+ files)
- Each block contains:
    - **The Mental Model Shift** — plain English explanation of _how the codebase's story changed_. Focuses on "why" and "so what," not restating the diff. Highlights architectural shifts, new patterns introduced, patterns retired. Calls out code that appears orphaned, half-finished, or disconnected.
    - **What Changed Structurally** — numbered list of the concrete changes, grouped and collapsed where appropriate. Mechanical/repetitive changes (e.g., "~63 files updated imports from X to Y") collapsed into single bullets. Meaningful changes called out individually with enough context to understand impact.

**Example output:**

> **The Mental Model Shift:**
>
> Previously, login/signup happened via popup windows — Keycloak auth screens would appear in a separate browser window that communicated back to the main app. Now, it's a full-page redirect — users navigate away to Keycloak and return to the app afterward.
>
> **What changed structurally:**
>
> 1. `auth.login()` and `auth.signup()` now call `signinRedirect()` instead of `signinPopup()`. The popup versions are preserved as new `loginPopup()` and `signupPopup()` methods.
> 2. `ApogeeUserManager` gained a new `signinRedirect()` override to support the `registration_first` flag for direct signup redirects.
> 3. Return types changed: `login()` and `signup()` now return `Promise<void>` instead of `Promise<User>`.
> 4. `LoginCheckWrapper` was refactored from `.catch()` chaining to proper async/await with explicit `removeUser()` calls when silent signin fails.
> 5. Dead code nuked: The entire `components/Login/` folder (~600 lines) and the custom login pages are gone — remnants of an abandoned Keycloak API integration spike.
> 6. Type extraction: Types like `UserInfo`, `ApogeeAuthContextProps`, etc. were pulled out into `types.ts` and utilities into `util.ts`.

#### 2. Risk Callouts

- Behavior changes that might have unexpected downstream consequences
- Security concerns (injection vectors, auth changes, exposed endpoints)
- Sensitive data in logs or error messages
- Broken assumptions between layers (e.g., service layer assumes something about the repository that changed)
- New dependencies or dependency changes worth scrutiny

#### 3. Tribal Knowledge Checks (File-Type-Aware)

Activated based on which file types are present in the diff. MVP ships with a small hardcoded set:

**When React/CSS/style files are changed:**

- Hard-coded color values instead of theme variables
- Missing `data-cy` attributes on major interactive elements
- Basic accessibility concerns (missing alt text, missing aria labels, click handlers on non-interactive elements)

**When backend files are changed:**

- `console.log` usage instead of structured logging
- Lib/service boundary violations
- Raw SQL or unparameterized queries

**When any files are changed:**

- New environment variables that may need DevOps communication
- Test coverage — are there tests for new code paths?

#### 4. Testing Recommendations

- Concrete suggestions for what the reviewer should test as a result of these changes
- Covers both manual verification and areas where automated test coverage should be checked
- Tied to the actual changes — not generic "write more tests" advice
- Should call out behavioral changes that may not be covered by existing tests
- If new code paths lack test coverage, recommend specific scenarios to test

### Input Handling

- **No argument**: Operates on the currently checked-out branch, diffing against the PR's base branch
- **PR number argument** (e.g., `/review-pr 42`): Fetches and checks out the PR branch, then runs the analysis

### Output Format

- Inline markdown rendered in the terminal (CLI) or chat panel (Cursor)
- No file saved to disk by default

## Explicitly Out of Scope

- **Posting output to GitHub as a PR comment** — future enhancement, not MVP
- **Saving output to a file** — future enhancement, trivial to add later
- **Configurable/pluggable check system** — MVP checks are hardcoded; designed with an eye toward configurability later
- **Auto-approval or scoring** — this tool informs the reviewer, it does not replace them
- **Line-by-line code review comments** — this is a briefing, not a detailed review
- **CI/CD integration** — this runs locally, on demand
- **Non-GitHub PR providers** (GitLab, Bitbucket, etc.) — GitHub only for now
- **Raw file-changed lists** — the diff and GitHub already provide this. The tool should summarize and synthesize, not regurgitate file paths

## User Stories

- As a reviewer, I want a narrative briefing that pairs the mental model shift with a structural summary of what changed so that I understand both the "so what" and the "what" together in context.
    - Acceptance Criteria:
        - [ ] Running `/review-pr` on a checked-out PR branch produces narrative blocks, each containing a "Mental Model Shift" and "What Changed Structurally" sub-section
        - [ ] Small PRs (<30 files) produce per-commit narrative blocks
        - [ ] Large PRs (30+ files) produce blocks grouped by theme/area
        - [ ] Repetitive/mechanical changes are collapsed into single summary bullets
        - [ ] Meaningful changes are called out individually with enough context to understand impact
        - [ ] Orphaned, half-finished, or disconnected code is flagged
        - [ ] Narrative explains the "why" and "so what," not just restating the diff
        - [ ] Output renders correctly as markdown in both CLI and Cursor

- As a reviewer, I want risk callouts for security, behavioral, and architectural concerns so that I know where to focus my detailed review time.
    - Acceptance Criteria:
        - [ ] Security concerns (auth changes, injection vectors, sensitive data in logs) are flagged
        - [ ] Behavior changes with potential downstream impact are identified
        - [ ] Broken cross-layer assumptions are called out
        - [ ] New dependencies or dependency changes are highlighted

- As a reviewer, I want file-type-aware checks based on team conventions so that tribal knowledge gets enforced consistently without relying on memory.
    - Acceptance Criteria:
        - [ ] Checks activate only when relevant file types are present in the diff
        - [ ] React/CSS checks flag hard-coded colors, missing `data-cy` attributes, and accessibility gaps
        - [ ] Backend checks flag `console.log` usage, boundary violations, and unparameterized queries
        - [ ] General checks flag missing tests and undocumented env vars

- As a reviewer, I want testing recommendations tied to the changes so that I know what to verify and where test coverage may be lacking.
    - Acceptance Criteria:
        - [ ] Recommendations are specific to the actual changes, not generic advice
        - [ ] Behavioral changes that may not be covered by existing tests are called out
        - [ ] Suggestions cover both manual verification and automated test gaps
        - [ ] New code paths without test coverage are identified with specific scenarios to test

- As a reviewer, I want to provide a PR number and have the tool fetch the branch for me so that I can start a review without manually fetching.
    - Acceptance Criteria:
        - [ ] `/review-pr 42` fetches and checks out PR #42
        - [ ] Tool correctly identifies the base branch for diffing
        - [ ] Works when the branch is already checked out locally (no redundant fetch)

## Edge Cases & Open Questions

1. **Very large PRs (100+ files)**: The narrative summary needs to avoid being as long as reading the diff itself. Should we cap output length, or let the model use its judgment on grouping/collapsing? _Recommendation: let the model use judgment but provide strong prompting to be concise._

2. **Merge commits vs. squash commits**: If a PR has merge commits from pulling in the base branch, those shouldn't be included in the narrative. Need to correctly identify only the PR's own commits.

3. **Binary files, lock files, generated code**: These should be acknowledged ("package-lock.json updated") but not analyzed in depth.

4. **Base branch detection**: When running on a local branch, how do we reliably determine the base branch (main, develop, etc.)? `gh pr view` can provide this if the PR exists on GitHub.

5. **Rate/context limits**: Large PRs may exceed context window limits. Need a strategy for chunking or prioritizing which files get deep analysis vs. surface-level summary.

6. **Monorepo considerations**: This project is a monorepo — changes spanning multiple packages should be summarized per-package as well as holistically.

7. **First-time reviewer vs. regular contributor**: Should the depth of the mental model summary adjust? _Recommendation: not for MVP. Keep it consistent._

## Success Metrics

- **Adoption**: Reviewers actually use the command regularly (self-reported or observable through team retros)
- **Review speed**: Reduction in time-to-first-review-comment after adopting the tool
- **Surprise reduction**: Fewer instances of "I didn't know this code existed" or "I didn't realize this changed X"
- **Tribal knowledge enforcement**: Decrease in review comments about things the tool should have caught (hard-coded colors, missing tests, etc.)

## Handoff Notes for Architect

- This will be implemented as a Claude Code slash command (custom skill). Familiarize yourself with how Claude Code skills are defined and invoked.
- The tool needs access to git operations (diff, log, fetch) and the GitHub CLI (`gh`) for PR metadata.
- The "tribal knowledge checks" should be structured in a way that's easy to extend later — even though MVP is hardcoded, the architect should design for eventual configurability without over-engineering now.
- Output is markdown. The prompt engineering for the narrative summary is the hardest part of this — getting the model to collapse noise, highlight signal, and explain architectural impact requires careful prompting.
- Consider whether the checks (section 3) and testing recommendations (section 4) should run as a separate pass from the narrative/risk analysis (sections 1-2), since they're fundamentally different operations (pattern matching vs. synthesis).
- The output must NOT include raw file-changed lists — GitHub and the diff already provide that. Every piece of output should be synthesis, not regurgitation.
- The base branch detection needs to be robust — `gh pr view --json baseRefName` is the most reliable source when the PR exists on GitHub.
- Context window management for large PRs is a real constraint. The architect should plan a strategy for this (chunking, prioritization, or tiered analysis).
