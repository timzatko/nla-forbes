const path = require("path");

const fs = require("fs-extra");

const CsvWriteStream = require("csv-write-stream");
const NodeJsonDb = require("node-json-db");

const outFile = path.resolve(__dirname, "out.csv");

fs.removeSync(outFile);

// output to csv
const csvWriter = CsvWriteStream();
csvWriter.pipe(fs.createWriteStream(outFile));

// load database
const db = new NodeJsonDb.JsonDB("out");

// get data
const data = Object.values(db.getData('/'));

function parseObj(obj, index) {
  return {
    "#": index + 1,
    "titulok článku": obj.title,
    URL: obj.url,
    "uvádzaní autori": obj.author,
    "dátum a čas vydania": obj.parsedDate,
    "dátum a čas analýzy obsahu": "",
    "uvádzaný zdroj/zdroje - meno a link": obj.credits,
    "zdroje, z ktorých by mohol byť obsah - linky": "",
    "názov uloženého článku (PDF/obrázok)": obj.fileName,
    "Kto analyzoval obsah": ""
  };
}

data.sort((a, b) => a.timestamp - b.timestamp);

data.forEach((obj, index) => {
  csvWriter.write(parseObj(obj, index));
});
