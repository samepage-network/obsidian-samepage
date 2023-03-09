const fs = require("fs");
const esbuild = require("esbuild").build;

const packageJson = JSON.parse(
  fs.readFileSync("node_modules/obsidian/package.json").toString()
);
packageJson.main = packageJson.main || "index.js";
fs.writeFileSync(
  "node_modules/obsidian/package.json",
  JSON.stringify(packageJson, null, 2)
);

esbuild({
  entryPoints: ["./tests/mockObsidianEnvironment.ts"],
  outfile: `node_modules/obsidian/${packageJson.main}`,
  bundle: true,
  platform: "node",
  external: ["./node_modules/jsdom/*"],
  allowOverwrite: true,
});
