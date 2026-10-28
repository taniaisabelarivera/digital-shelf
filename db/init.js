import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { hashPassword } from "../server/password.js";

const db = new DatabaseSync(new URL("./shelf.db", import.meta.url).pathname);
db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));

if (process.argv.includes("--seed")) {
  db.exec(readFileSync(new URL("./seed.sql", import.meta.url), "utf8"));
  const setHash = db.prepare("UPDATE users SET password_hash = ? WHERE id = ?");
  for (const { id } of db.prepare("SELECT id FROM users WHERE password_hash = 'placeholder'").all()) {
    setHash.run(hashPassword("password123"), id);
  }
  console.log("Demo logins: alex@csu.fullerton.edu / password123 (also bree@, cam@, dani@)");
}
console.log("Database ready: db/shelf.db");