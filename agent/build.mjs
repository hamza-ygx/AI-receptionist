import { build } from "esbuild";

await build({
  entryPoints: ["src/agent.ts", "src/scripts/provisionSip.ts"],
  outdir: "dist",
  outbase: "src",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  sourcemap: true,
  logLevel: "info",
});
