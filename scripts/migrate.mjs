import pg from "pg";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(fileURLToPath(new URL("../apps/web", import.meta.url)), true, console, true);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try { await client.query(await readFile(new URL("../db/migrations/001_accounts_gallery.sql", import.meta.url), "utf8")); }
finally { await client.end(); }
