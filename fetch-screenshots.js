const path = require("path");
const fs = require("fs-extra");

const screenshots = require("./screenshots");

const NodeJsonDb = require("node-json-db");

const outDir = path.resolve(__dirname, "out");
const outScreenshotsDir = path.resolve(outDir, "screenshots");

fs.ensureDirSync(outScreenshotsDir);

// load database
const db = new NodeJsonDb.JsonDB("out");

// get data
const data = Object.values(db.getData("/"));

screenshots.startService().then(close => {
  data.forEach(obj => {
    screenshots.queue(obj.url, path.join(outScreenshotsDir, obj.fileName));
  });

  close();
});
