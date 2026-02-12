import { sync } from "./sync.js";

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "help" || command === "--help") {
    console.log(`
Usage: the-agency <command> [options]

Commands:
  sync          Sync all Claude Code files to the current project
  sync --pick   Interactively select which files to sync
`);
    process.exit(0);
}

if (command === "sync") {
    const pick = args.includes("--pick");
    await sync({ pick });
} else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
