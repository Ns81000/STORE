// Runs oxlint with Node's type stripping enabled so the anti-slop TS plugin
// (tools/oxlint/anti-slop/index.ts) loads without bun.
import { spawnSync } from "node:child_process";

process.env["NODE_OPTIONS"] = "--experimental-strip-types";
const result = spawnSync("oxlint", ["--config", ".oxlintrc.json"], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
