const fs = require("fs");

module.exports = () => {
  const { version } = JSON.parse(
    fs.readFileSync("package.json").toString()
  );
  fs.writeFileSync(
    "manifest.json",
    fs
      .readFileSync("manifest.json")
      .toString()
      .replace(/"version": "[\d.-]+",/, `"version": "${version}",`)
  );
};
