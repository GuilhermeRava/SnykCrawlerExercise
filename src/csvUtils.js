const fs = require("fs");
const path = require("path");
const { parseArgs } = require("util");
const csv = require("csv-parser");

const getCsvPath = () => {
  const options = {
    "csv-path": {
      type: "string",
      default: path.resolve(__dirname, "..", "csvExample.csv"),
    },
  };
  const { values } = parseArgs({ options, args: process.argv.splice(2) });
  return values["csv-path"];
};

const getCsvData = (csvFilePath) => {
  return new Promise((res, rej) => {
    const results = [];
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        res(results);
      });
  });
};

module.exports.getCsvPath = getCsvPath;
module.exports.getCsvData = getCsvData;