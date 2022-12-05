import fs from "fs";
import esbuild from "esbuild";

export const setup = async () => {
  const packageJson = JSON.parse(fs.readFileSync(".json").toString());
  packageJson.main = packageJson.main || "index.js";
  fs.writeFileSync(
    "node_modules/obsidian/package.json",
    JSON.stringify(packageJson, null, 2)
  );

  await esbuild.build({
    entryPoints: ["./tests/mockObsidianEnvironment.ts"],
    outfile: `node_modules/obsidian/${packageJson.main}`,
    bundle: true,
    platform: "node",
    external: ["./node_modules/jsdom/*"],
    allowOverwrite: true,
  });
};
