import { Pool } from "pg";

const globalPool = globalThis as typeof globalThis & { __eMomentPool?: Pool };

export function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return globalPool.__eMomentPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
}
