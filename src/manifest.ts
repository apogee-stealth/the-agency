export interface ManifestItem {
    file: string;
    description: string;
}

export interface Manifest {
    agents: ManifestItem[];
    commands: ManifestItem[];
    ai: ManifestItem[];
}

export const manifest: Manifest = {
    agents: [
        { file: "architect.md", description: "Designs technical approach, produces build plans" },
        { file: "dev.md", description: "Implements features from build plans" },
        { file: "explorer.md", description: "Explores and maps unfamiliar codebases" },
        { file: "pm.md", description: "Produces product briefs from requirements" },
        { file: "reviewer.md", description: "Adversarial code review with pass/fail verdict" },
        { file: "test-hardener.md", description: "Hardens test coverage, finds edge cases" },
    ],
    commands: [
        { file: "architect.md", description: "Interactive architecture design sessions" },
        { file: "build.md", description: "Build orchestrator pipeline" },
        { file: "pm.md", description: "Interactive product requirements discovery" },
        { file: "review-pr.md", description: "Structured PR review briefing" },
    ],
    ai: [
        { file: "UnitTestGeneration.md", description: "TypeScript/Jest unit testing style guide" },
        { file: "UnitTestExamples.md", description: "Reference examples for the test style guide" },
        { file: "workflow.md", description: "Multi-agent development workflow guide" },
    ],
};
