import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile, mkdir } from "node:fs/promises";
import prompts from "prompts";
import { manifest } from "./manifest.js";
import { fileExists } from "./sync.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");

/** Where plugin source files live inside the published package. */
const srcDir = join(packageRoot, "src/review-plugins");

/** Destination matches what the `review-pr` command expects to find. */
const destDir = ".ai/review-checks";

/**
 * Presents an interactive multi-select of available review plugins and
 * copies the selected ones into the consumer's project.
 *
 * This is deliberately separate from `sync` — sync handles core setup
 * (agents, commands, AI context), while review plugins are optional
 * extras that users pick à la carte.
 */
export async function installReviewPlugins(): Promise<void> {
    const choices = manifest.reviewPlugins.map((plugin) => ({
        title: plugin.file,
        description: plugin.description,
        value: plugin.file,
        selected: true,
    }));

    const { selected } = await prompts({
        type: "multiselect",
        name: "selected",
        message: "Select review plugins to install",
        choices,
        instructions: false,
        hint: "- Space to toggle, Enter to confirm",
    });

    // `prompts` returns undefined when the user hits Ctrl-C
    if (!selected || selected.length === 0) {
        console.log("Nothing selected. Exiting.");
        return;
    }

    const destBase = join(process.cwd(), destDir);

    // Check for conflicts before copying so we can ask once rather than per-file
    const existing: string[] = [];
    for (const file of selected) {
        const dest = join(destBase, file);
        if (await fileExists(dest)) {
            existing.push(file);
        }
    }

    if (existing.length > 0) {
        console.log(`\nExisting files that will be overwritten:`);
        for (const file of existing) {
            console.log(`  - ${destDir}/${file}`);
        }

        const { proceed } = await prompts({
            type: "confirm",
            name: "proceed",
            message: `Overwrite ${existing.length} existing file(s)?`,
            initial: true,
        });

        if (!proceed) {
            console.log("Install cancelled.");
            return;
        }
    }

    await mkdir(destBase, { recursive: true });

    for (const file of selected) {
        const src = join(srcDir, file);
        const dest = join(destBase, file);
        await copyFile(src, dest);
        console.log(`  \u2713 ${destDir}/${file}`);
    }

    console.log(`\nInstalled ${selected.length} review plugin(s).`);
}
