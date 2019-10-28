const fs = require("fs-extra");
const path = require("path");

fs.removeSync(path.resolve(__dirname, "out"));
fs.removeSync(path.resolve(__dirname, "out.csv"));
