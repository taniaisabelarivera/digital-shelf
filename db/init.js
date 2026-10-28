import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const db = new DatabaseSync(new URL("./shelf.db", import.meta.url).pathname);
db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
if (process.argv.includes("--seed")) {
  db.exec(readFileSync(new URL("./seed.sql", import.meta.url), "utf8"));
}
console.log("Database ready: db/shelf.db");