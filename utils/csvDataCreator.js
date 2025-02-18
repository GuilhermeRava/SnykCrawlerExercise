const path = require("path");
const fs = require("fs");

const DOMAINS = [
  "https://private.barao.pt",
];

const PATHS = [
  "/",
  "/login",
  "/admin",
  "/backoffice",
  "/dashboard",
  "/api",
  "/wp-admin",
  "/search",
  "/robots.txt",
  "/humans.txt",
  "/sitemap.xml",
  "/.well-known/security.txt",
];

const csvPath = path.resolve(__dirname, "..", "csvExample.csv");

let csvData = "domain,path\n";

DOMAINS.forEach((domain) => {
  PATHS.forEach((path) => {
    csvData += `${domain},${path}\n`;
  });
});

fs.writeFileSync(csvPath, csvData, { encoding: "utf8", flag: "w+" });
