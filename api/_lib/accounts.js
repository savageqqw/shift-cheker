import { getDb, ensureSchema } from './db.js';

export const OWNER_ID = 'owner';
let ready;
export function ensureAccounts() {
  if (!ready) ready = migrate().catch((error) => { ready = null; throw error; });
  return ready;
}

async function migrate() {
  await ensureSchema();
  const db = getDb();
  // Copy existing data once, atomically. Original tables remain intact.
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL, password_hash TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS account_migrations (name TEXT PRIMARY KEY)`,
    `INSERT OR IGNORE INTO users (id, username, display_name) VALUES ('owner', 'owner', 'Власник')`,
    `CREATE TABLE IF NOT EXISTS login_limits (username TEXT PRIMARY KEY, attempts INTEGER NOT NULL, started_at INTEGER NOT NULL)`
  ];
  for (const table of ['settings', 'overrides', 'shifts']) {
    const { rows } = await db.execute(`PRAGMA table_info(${table})`);
    const definitions = rows.map((column) => {
      if (column.name === 'id' && table === 'shifts') return 'id INTEGER PRIMARY KEY AUTOINCREMENT';
      if (column.name === 'id') return 'id INTEGER NOT NULL DEFAULT 1';
      return `"${column.name}" ${column.type}${column.notnull ? ' NOT NULL' : ''}${column.dflt_value !== null ? ` DEFAULT (${column.dflt_value})` : ''}`;
    });
    const constraint = table === 'settings' ? 'PRIMARY KEY (user_id)' : table === 'overrides' ? 'PRIMARY KEY (user_id, date)' : 'UNIQUE (user_id, date)';
    statements.push(`CREATE TABLE IF NOT EXISTS account_${table} (user_id TEXT NOT NULL REFERENCES users(id), ${definitions.join(', ')}, ${constraint})`);
    const columns = rows.map((column) => `"${column.name}"`).join(', ');
    statements.push(`INSERT INTO account_${table} (user_id, ${columns}) SELECT 'owner', ${columns} FROM ${table}
      WHERE NOT EXISTS (SELECT 1 FROM account_migrations WHERE name = 'separate-accounts-v1')`);
  }
  statements.push(`INSERT OR IGNORE INTO account_migrations (name) VALUES ('separate-accounts-v1')`);
  await db.batch(statements, 'write');
}
