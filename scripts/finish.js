const fs = require("fs");

module.exports = () => {
  const { version } = JSON.parse(
    fs.readFileSync("dist/package.json").toString()
  );
  fs.writeFileSync(
    "dist/manifest.json",
    fs
      .readFileSync("dist/manifest.json")
      .toString()
      .replace(/"version": "[\d.-]+",/, `"version": "${version}",`)
  );
};
