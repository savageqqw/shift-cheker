import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('migrate old schema, persist settings/counts, reload and aggregate via API', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shiftly-test-'));
  process.env.TURSO_DATABASE_URL = 'file:' + join(dir, 'test.db').replaceAll('\\', '/');
  process.env.JWT_SECRET = 'local-test-only';
  const { getDb, ensureSchema } = await import('../api/_lib/db.js');
  const db = getDb();
  const { default: shifts } = await import('../api/shifts.js');
  const { default: schedule } = await import('../api/schedule.js');
  const { signToken } = await import('../api/_lib/auth.js');
  const headers = { authorization: 'Bearer ' + signToken() };
  async function call(handler, method, action, body, query = {}) {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler({ method, headers, query: { action, ...query }, body }, res);
    return res;
  }
  try {
    await db.execute('CREATE TABLE shifts (id INTEGER PRIMARY KEY, date TEXT UNIQUE, start_time TEXT, end_time TEXT, total_hours REAL, tradein_count INTEGER DEFAULT 0, note TEXT, updated_at TEXT)');
    await ensureSchema();
    const rules = [{ name: '500', threshold: 500, amount: 1000, types: ['regular', 'tradein'] }];
    assert.equal((await call(schedule, 'POST', 'update-settings', { bonus_rules: rules, wholesale_rate: 10 })).code, 200);
    assert.equal((await call(shifts, 'POST', 'upsert', { date: '2026-11-01', regular_count: 300, tradein_count: 200, wholesale_count: 7 })).code, 200);
    const list = await call(shifts, 'GET', 'list');
    assert.equal(list.data.shifts[0].wholesale_count, 7);
    const stats = await call(shifts, 'GET', 'stats');
    assert.equal(stats.data.stats.wholesale_value, 70);
    assert.equal(stats.data.stats.bonus_value, 1000);
    assert.equal((await call(shifts, 'POST', 'upsert', { date: '2026-11-02', wholesale_count: -1 })).code, 400);
    assert.equal((await call(schedule, 'POST', 'update-settings', { bonus_rules: [{ name: 'bad', threshold: 0 }] })).code, 400);
  } finally { db.close(); await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
});
