import { createClient } from '@libsql/client';

let client;
export function getDb() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });
  }
  return client;
}

let migrated = null;
export async function ensureSchema() {
  if (migrated) return migrated;
  const db = getDb();
  migrated = (async () => {
    await db.batch(
      [
        `CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          work_days INTEGER NOT NULL DEFAULT 5,
          rest_days INTEGER NOT NULL DEFAULT 2,
          anchor_date TEXT NOT NULL,
          timezone TEXT NOT NULL DEFAULT 'Europe/Kyiv'
        )`,
        `CREATE TABLE IF NOT EXISTS overrides (
          date TEXT PRIMARY KEY,
          is_working INTEGER NOT NULL,
          note TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS shifts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL UNIQUE,
          start_time TEXT,
          end_time TEXT,
          total_hours REAL,
          tradein_count INTEGER NOT NULL DEFAULT 0,
          note TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `INSERT OR IGNORE INTO settings (id, work_days, rest_days, anchor_date, timezone)
         VALUES (1, 5, 2, date('now'), 'Europe/Kyiv')`
      ],
      'write'
    );

    // Schema evolution: add columns for installs created before they existed.
    // Guarded by a column check since SQLite/libSQL has no
    // "ADD COLUMN IF NOT EXISTS".
    const settingsCols = await db.execute('PRAGMA table_info(settings)');
    const settingsColNames = settingsCols.rows.map((r) => r.name);
    if (!settingsColNames.includes('monthly_hours_goal')) {
      await db.execute('ALTER TABLE settings ADD COLUMN monthly_hours_goal INTEGER NOT NULL DEFAULT 200');
    }
    if (!settingsColNames.includes('tradein_rate')) {
      await db.execute('ALTER TABLE settings ADD COLUMN tradein_rate REAL NOT NULL DEFAULT 20');
    }
    if (!settingsColNames.includes('nova_poshta_rate')) {
      await db.execute('ALTER TABLE settings ADD COLUMN nova_poshta_rate REAL NOT NULL DEFAULT 50');
    }
    if (!settingsColNames.includes('regular_rate')) {
      await db.execute('ALTER TABLE settings ADD COLUMN regular_rate REAL NOT NULL DEFAULT 10');
    }

    const shiftsCols = await db.execute('PRAGMA table_info(shifts)');
    const shiftsColNames = shiftsCols.rows.map((r) => r.name);
    if (!shiftsColNames.includes('nova_poshta_count')) {
      await db.execute('ALTER TABLE shifts ADD COLUMN nova_poshta_count INTEGER NOT NULL DEFAULT 0');
    }
    if (!shiftsColNames.includes('regular_count')) {
      await db.execute('ALTER TABLE shifts ADD COLUMN regular_count INTEGER NOT NULL DEFAULT 0');
    }

    return true;
  })();
  return migrated;
}
