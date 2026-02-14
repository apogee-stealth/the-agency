import { jest } from "@jest/globals";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");

// Mock fs/promises
const mockAccess = jest.fn<() => Promise<void>>();
const mockMkdir = jest.fn<() => Promise<string | undefined>>();
const mockCopyFile = jest.fn<() => Promise<void>>();

jest.unstable_mockModule("node:fs/promises", () => ({
    access: mockAccess,
    mkdir: mockMkdir,
    copyFile: mockCopyFile,
}));

// Mock prompts
const mockPrompts = jest.fn<() => Promise<Record<string, unknown>>>();
jest.unstable_mockModule("prompts", () => ({
    default: mockPrompts,
}));

// Import after mocks are set up
const { getFilesToSync, fileExists, sync } = await import("./sync.js");
const { manifest } = await import("./manifest.js");

beforeEach(() => {
    jest.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);
});

describe("getFilesToSync", () => {
    it("resolves source and destination paths for a category", () => {
        const files = getFilesToSync({
            agents: [{ file: "architect.md", description: "test" }],
        });

        expect(files).toHaveLength(1);
        expect(files[0].src).toBe(
            join(packageRoot, "src/templates/.claude/agents", "architect.md")
        );
        expect(files[0].dest).toBe(join(process.cwd(), ".claude/agents", "architect.md"));
        expect(files[0].label).toBe(".claude/agents/architect.md");
    });

    it("handles multiple categories", () => {
        const files = getFilesToSync({
            agents: [{ file: "dev.md", description: "test" }],
            ai: [{ file: "workflow.md", description: "test" }],
        });

        expect(files).toHaveLength(2);
        expect(files[0].label).toBe(".claude/agents/dev.md");
        expect(files[1].label).toBe(".ai/workflow.md");
    });

    it("returns empty array for empty input", () => {
        expect(getFilesToSync({})).toEqual([]);
    });

    it("handles the full manifest", () => {
        const { agents, commands, ai } = manifest;
        const files = getFilesToSync({ agents, commands, ai });
        const totalItems = agents.length + commands.length + ai.length;
        expect(files).toHaveLength(totalItems);
    });
});

describe("fileExists", () => {
    it("returns true when access succeeds", async () => {
        mockAccess.mockResolvedValue(undefined);
        expect(await fileExists("/some/path")).toBe(true);
    });

    it("returns false when access throws", async () => {
        mockAccess.mockRejectedValue(new Error("ENOENT"));
        expect(await fileExists("/nonexistent")).toBe(false);
    });
});

describe("sync", () => {
    it("copies all manifest files when no conflicts exist", async () => {
        mockAccess.mockRejectedValue(new Error("ENOENT")); // no existing files

        await sync();

        const totalItems = manifest.agents.length + manifest.commands.length + manifest.ai.length;
        expect(mockCopyFile).toHaveBeenCalledTimes(totalItems);
        expect(mockMkdir).toHaveBeenCalledTimes(totalItems);
    });

    it("prompts for overwrite when destination files exist", async () => {
        mockAccess.mockResolvedValue(undefined); // all files exist
        mockPrompts.mockResolvedValue({ proceed: true });

        await sync();

        // Should have been called with a confirm prompt
        expect(mockPrompts).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "confirm",
                name: "proceed",
            })
        );

        const totalItems = manifest.agents.length + manifest.commands.length + manifest.ai.length;
        expect(mockCopyFile).toHaveBeenCalledTimes(totalItems);
    });

    it("aborts when user declines overwrite", async () => {
        mockAccess.mockResolvedValue(undefined); // all files exist
        mockPrompts.mockResolvedValue({ proceed: false });

        await sync();

        expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it("skips overwrite prompt when no conflicts exist", async () => {
        mockAccess.mockRejectedValue(new Error("ENOENT"));

        await sync();

        // prompts should not have been called at all (no pick, no conflicts)
        expect(mockPrompts).not.toHaveBeenCalled();
    });

    it("respects pick mode selection", async () => {
        mockAccess.mockRejectedValue(new Error("ENOENT"));
        mockPrompts.mockResolvedValue({
            selected: [{ category: "agents", item: { file: "dev.md", description: "test" } }],
        });

        await sync({ pick: true });

        expect(mockPrompts).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "multiselect",
                name: "selected",
            })
        );
        expect(mockCopyFile).toHaveBeenCalledTimes(1);
    });

    it("exits cleanly when nothing selected in pick mode", async () => {
        mockPrompts.mockResolvedValue({ selected: [] });

        await sync({ pick: true });

        expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it("exits cleanly when pick prompt is cancelled", async () => {
        mockPrompts.mockResolvedValue({ selected: undefined });

        await sync({ pick: true });

        expect(mockCopyFile).not.toHaveBeenCalled();
    });
});
