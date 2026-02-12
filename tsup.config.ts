import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/cli.ts", "src/sync.ts", "src/manifest.ts"],
    format: ["esm"],
    target: "node22",
    outDir: "dist",
    clean: true,
    bundle: false,
    dts: true,
});
