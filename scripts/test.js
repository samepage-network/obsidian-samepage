const test = require("samepage/scripts/test").default;
const args = require("./args");

test({ ...args, forward: process.argv.slice(2) });
