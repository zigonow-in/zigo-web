import pg from "pg";
import { env } from "../config/env.js";
export const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
});
export async function checkDatabaseConnection() {
    const result = await pool.query("select now()");
    return result.rows[0];
}
