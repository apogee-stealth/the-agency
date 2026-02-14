import { sync } from "./sync.js";
import { installReviewPlugins } from "./install-review-plugins.js";

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "help" || command === "--help") {
    console.log(`
Usage: the-agency <command> [options]

Commands:
  sync                    Sync all Claude Code files to the current project
  sync --pick             Interactively select which files to sync
  install-review-plugins  Install optional review check plugins
`);
    process.exit(0);
}

if (command === "sync") {
    const pick = args.includes("--pick");
    await sync({ pick });
} else if (command === "install-review-plugins") {
    await installReviewPlugins();
} else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
