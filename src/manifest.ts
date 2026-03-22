export interface ManifestItem {
    file: string;
    description: string;
}

export interface Manifest {
    agents: ManifestItem[];
    commands: ManifestItem[];
    ai: ManifestItem[];
    reviewPlugins: ManifestItem[];
}

export const manifest: Manifest = {
    agents: [
        { file: "architect.md", description: "Designs technical approach, produces build plans" },
        { file: "dev.md", description: "Implements features from build plans" },
        { file: "explorer.md", description: "Explores and maps unfamiliar codebases" },
        { file: "pm.md", description: "Produces product briefs from requirements" },
        {
            file: "auto-prep-pr.md",
            description: "Non-interactive PR preparation and draft creation",
        },
        { file: "reviewer.md", description: "Adversarial code review with pass/fail verdict" },
        { file: "test-hardener.md", description: "Hardens test coverage, finds edge cases" },
        {
            file: "retrospective.md",
            description: "Extracts patterns from pipeline reports into per-feature retro files",
        },
    ],
    commands: [
        { file: "architect.md", description: "Interactive architecture design sessions" },
        {
            file: "auto-build.md",
            description: "Fully autonomous build + commit + draft PR pipeline",
        },
        { file: "auto-prep-pr.md", description: "Non-interactive PR prep via auto-prep-pr agent" },
        { file: "build.md", description: "Build orchestrator pipeline (manually-gated)" },
        { file: "pm.md", description: "Interactive product requirements discovery" },
        { file: "prep-pr.md", description: "Pre-submission PR prep and draft creation" },
        { file: "review-pr.md", description: "Structured PR review briefing" },
        { file: "weekly-summary.md", description: "Weekly synthesis of merged PRs" },
        { file: "dnd-alignment.md", description: "D&D alignment chart from commit history" },
        {
            file: "retrospective.md",
            description: "Interactive consolidation of retro files into lessons-learned",
        },
    ],
    ai: [
        { file: "UnitTestGeneration.md", description: "TypeScript/Jest unit testing style guide" },
        { file: "UnitTestExamples.md", description: "Reference examples for the test style guide" },
        { file: "workflow.md", description: "Multi-agent development workflow guide" },
        {
            file: "lessons-learned.md",
            description: "Accumulated lessons from retrospective analysis",
        },
    ],
    reviewPlugins: [
        {
            file: "general.md",
            description:
                "General checks: env vars, type safety, dead code, debugging leftovers, breaking changes, binary assets",
        },
        {
            file: "node-backend.md",
            description:
                "Node.js backend checks: API design, error handling, security, database patterns",
        },
        {
            file: "react-frontend.md",
            description: "React frontend checks: component design, hooks, rendering, accessibility",
        },
        {
            file: "unit-test.md",
            description: "Unit test checks: test quality, coverage, mocking patterns, assertions",
        },
    ],
};
