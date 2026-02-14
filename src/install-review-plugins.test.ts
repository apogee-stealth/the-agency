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
const { installReviewPlugins } = await import("./install-review-plugins.js");
const { manifest } = await import("./manifest.js");

beforeEach(() => {
    jest.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);
});

describe("installReviewPlugins", () => {
    it("presents multi-select with all review plugins", async () => {
        mockPrompts.mockResolvedValue({ selected: ["general.md"] });
        mockAccess.mockRejectedValue(new Error("ENOENT"));

        await installReviewPlugins();

        expect(mockPrompts).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "multiselect",
                name: "selected",
                choices: expect.arrayContaining(
                    manifest.reviewPlugins.map((plugin) =>
                        expect.objectContaining({
                            title: plugin.file,
                            value: plugin.file,
                            selected: true,
                        })
                    )
                ),
            })
        );
    });

    it("copies selected files to .ai/review-checks/", async () => {
        const selected = ["general.md", "unit-test.md"];
        mockPrompts.mockResolvedValue({ selected });
        mockAccess.mockRejectedValue(new Error("ENOENT"));

        await installReviewPlugins();

        expect(mockCopyFile).toHaveBeenCalledTimes(2);
        for (const file of selected) {
            expect(mockCopyFile).toHaveBeenCalledWith(
                join(packageRoot, "src/review-plugins", file),
                join(process.cwd(), ".ai/review-checks", file)
            );
        }
    });

    it("creates destination directory", async () => {
        mockPrompts.mockResolvedValue({ selected: ["general.md"] });
        mockAccess.mockRejectedValue(new Error("ENOENT"));

        await installReviewPlugins();

        expect(mockMkdir).toHaveBeenCalledWith(join(process.cwd(), ".ai/review-checks"), {
            recursive: true,
        });
    });

    it("prompts for overwrite when destination files exist", async () => {
        const selected = ["general.md", "unit-test.md"];
        mockPrompts.mockResolvedValueOnce({ selected }).mockResolvedValueOnce({ proceed: true });
        mockAccess.mockResolvedValue(undefined); // all files exist

        await installReviewPlugins();

        expect(mockPrompts).toHaveBeenCalledTimes(2);
        expect(mockPrompts).toHaveBeenLastCalledWith(
            expect.objectContaining({
                type: "confirm",
                name: "proceed",
            })
        );
        expect(mockCopyFile).toHaveBeenCalledTimes(2);
    });

    it("aborts when user declines overwrite", async () => {
        mockPrompts
            .mockResolvedValueOnce({ selected: ["general.md"] })
            .mockResolvedValueOnce({ proceed: false });
        mockAccess.mockResolvedValue(undefined);

        await installReviewPlugins();

        expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it("skips overwrite prompt when no conflicts", async () => {
        mockPrompts.mockResolvedValue({ selected: ["general.md"] });
        mockAccess.mockRejectedValue(new Error("ENOENT"));

        await installReviewPlugins();

        // Only the multiselect prompt, no confirm
        expect(mockPrompts).toHaveBeenCalledTimes(1);
    });

    it("exits cleanly on empty selection", async () => {
        mockPrompts.mockResolvedValue({ selected: [] });

        await installReviewPlugins();

        expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it("exits cleanly on cancelled prompt", async () => {
        mockPrompts.mockResolvedValue({ selected: undefined });

        await installReviewPlugins();

        expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it("manifest has all four review plugin entries", () => {
        expect(manifest.reviewPlugins).toHaveLength(4);
        const files = manifest.reviewPlugins.map((p) => p.file);
        expect(files).toContain("general.md");
        expect(files).toContain("node-backend.md");
        expect(files).toContain("react-frontend.md");
        expect(files).toContain("unit-test.md");
    });
});
