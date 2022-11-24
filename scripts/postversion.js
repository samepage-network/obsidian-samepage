const fs = require("fs");
const execSync = require("child_process").execSync;

const { version } = JSON.parse(fs.readFileSync("package.json").toString());
fs.writeFileSync(
  "manifest.json",
  fs
    .readFileSync("manifest.json")
    .toString()
    .replace(/"version": "[\d.-]+",/, `"version": "${version}",`)
);
execSync("git add --all", { stdio: "inherit" });
execSync("git commit --amend -n", { stdio: "inherit" });
// execSync("git push origin main", { stdio: "inherit" });
