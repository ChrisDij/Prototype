import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { openDatabase } from "./database.mjs";
const path = fileURLToPath(
  new URL("../.local/shoplytics.sqlite", import.meta.url),
);
const db = openDatabase(path);
try {
  if (db.userCount()) {
    console.log(
      "Database and accounts already exist. Existing passwords and feedback preserved.",
    );
  } else {
    const credentials = [];
    for (const [username, name, role] of [
      ["manager", "Primary user", "manager"],
      ["reporting", "Reporting user", "reporting"],
    ]) {
      const password = randomBytes(18).toString("base64url");
      db.addUser({ username, name, role, password });
      credentials.push(`Username: ${username}\nPassword: ${password}`);
    }
    writeFileSync(
      new URL("../.local/accounts.txt", import.meta.url),
      `Local prototype accounts\nDo not commit or share this file.\n\n${credentials.join("\n\n")}\n`,
      { mode: 0o600 },
    );
    console.log(
      "Database created with synthetic data. Account credentials saved to .local/accounts.txt.",
    );
  }
} finally {
  db.close();
}
