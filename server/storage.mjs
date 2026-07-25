import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

export async function openStateStore() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return new JsonStateStore(process.env.GENERATION_LEAGUE_DATA ?? fileURLToPath(new URL('./.world-state.json', import.meta.url)));

  const pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS generation_league_state (
      id smallint PRIMARY KEY CHECK (id = 1),
      state jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  return new PostgresStateStore(pool);
}

class JsonStateStore {
  constructor(path) { this.path = path; }
  async load() {
    if (!existsSync(this.path)) return null;
    try { return JSON.parse(readFileSync(this.path, 'utf8')); } catch (error) { console.warn(`Could not load local world state: ${error.message}`); return null; }
  }
  async save(state) {
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify(state), 'utf8');
    renameSync(temporary, this.path);
  }
  async close() {}
}

class PostgresStateStore {
  constructor(pool) { this.pool = pool; }
  async load() {
    const result = await this.pool.query('SELECT state FROM generation_league_state WHERE id = 1');
    return result.rows[0]?.state ?? null;
  }
  async save(state) {
    await this.pool.query(
      `INSERT INTO generation_league_state (id, state, updated_at)
       VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [JSON.stringify(state)],
    );
  }
  async close() { await this.pool.end(); }
}
