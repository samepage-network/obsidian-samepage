module.exports = {
  external: "obsidian",
  include: ["manifest.json", "node_modules/samepage/samepage.css"],
  mirror: `${process.env.HOME}/Documents/obsidian/obsidian-vargas/.obsidian/plugins/obsidian-samepage`,
  css: "styles",
  format: "cjs",
  finish: "./scripts/finish.js",
};
