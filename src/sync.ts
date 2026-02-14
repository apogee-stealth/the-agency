import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile, mkdir, access } from "node:fs/promises";
import prompts from "prompts";
import { manifest, type ManifestItem } from "./manifest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");

interface SyncFile {
    src: string;
    dest: string;
    label: string;
}

interface CategoryConfig {
    src: string;
    dest: string;
}

const categoryConfig: Record<string, CategoryConfig> = {
    agents: { src: "src/templates/.claude/agents", dest: ".claude/agents" },
    commands: { src: "src/templates/.claude/commands", dest: ".claude/commands" },
    ai: { src: "src/templates/.ai", dest: ".ai" },
};

/**
 * Resolves manifest categories into concrete source/destination file paths.
 * Only categories present in `categoryConfig` are valid — passing unknown
 * categories (e.g. `reviewPlugins`) will throw at runtime.
 */
export function getFilesToSync(categories: Record<string, ManifestItem[]>): SyncFile[] {
    const files: SyncFile[] = [];
    for (const [category, items] of Object.entries(categories)) {
        const config = categoryConfig[category];
        for (const item of items) {
            files.push({
                src: join(packageRoot, config.src, item.file),
                dest: join(process.cwd(), config.dest, item.file),
                label: `${config.dest}/${item.file}`,
            });
        }
    }
    return files;
}

/**
 * Checks whether a file exists at the given path.
 * Uses `fs.access` rather than `stat` to avoid TOCTOU overhead we don't need.
 */
export async function fileExists(path: string): Promise<boolean> {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * Copies agent, command, and AI context files from the package into the
 * consumer's project. In pick mode, presents an interactive multi-select;
 * otherwise syncs everything.
 *
 * Review plugins are deliberately excluded — they have their own install
 * flow via `install-review-plugins` since they're opt-in extras, not
 * core setup.
 */
export async function sync({ pick = false } = {}): Promise<void> {
    let selectedCategories: Record<string, ManifestItem[]>;

    if (pick) {
        // Filter to categories that have a known source/dest mapping.
        // This keeps non-sync manifest sections (e.g. reviewPlugins) out of the prompt.
        const syncableCategories = Object.entries(manifest).filter(
            ([category]) => category in categoryConfig
        );
        const choices = syncableCategories.flatMap(([category, items]) =>
            items.map((item: ManifestItem) => ({
                title: `${categoryConfig[category].dest}/${item.file}`,
                description: item.description,
                value: { category, item },
                selected: true,
            }))
        );

        const { selected } = await prompts({
            type: "multiselect",
            name: "selected",
            message: "Select files to sync",
            choices,
            instructions: false,
            hint: "- Space to toggle, Enter to confirm",
        });

        if (!selected || selected.length === 0) {
            console.log("Nothing selected. Exiting.");
            return;
        }

        selectedCategories = {};
        for (const { category, item } of selected) {
            if (!selectedCategories[category]) selectedCategories[category] = [];
            selectedCategories[category].push(item);
        }
    } else {
        // Explicitly destructure only syncable categories to avoid pulling in
        // manifest sections that don't belong in sync (e.g. reviewPlugins).
        const { agents, commands, ai } = manifest;
        selectedCategories = { agents, commands, ai };
    }

    const files = getFilesToSync(selectedCategories);

    const existing: string[] = [];
    for (const f of files) {
        if (await fileExists(f.dest)) {
            existing.push(f.label);
        }
    }

    if (existing.length > 0) {
        const { proceed } = await prompts({
            type: "confirm",
            name: "proceed",
            message: `${existing.length} destination file(s) will be overwritten. Proceed?`,
            initial: true,
        });

        if (!proceed) {
            console.log("Sync cancelled.");
            return;
        }
    }

    for (const f of files) {
        await mkdir(dirname(f.dest), { recursive: true });
        await copyFile(f.src, f.dest);
        console.log(`  ✓ ${f.label}`);
    }

    console.log(`\nSynced ${files.length} file(s).`);
}
