import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

if (typeof window !== "undefined") {
  throw new Error("DB client should only be used on the server.");
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

const pool = mysql.createPool(DATABASE_URL);

export const db = drizzle(pool, { schema, mode: "default" });
