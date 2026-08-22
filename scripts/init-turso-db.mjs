// Initializes the Turso database with db/schema.sql.
// Usage: pnpm db:init   (runs `node --env-file=.env scripts/init-turso-db.mjs`)
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error(
    "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set (put them in .env and run via `pnpm db:init`).",
  );
  process.exit(1);
}

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const client = createClient({ url, authToken });

try {
  await client.executeMultiple(schema);

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const indices = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );

  console.log("Tables:", tables.rows.map((row) => String(row["name"])).join(", "));
  console.log("Indices:", indices.rows.map((row) => String(row["name"])).join(", "));
  console.log("Schema initialized.");
} finally {
  client.close();
}
