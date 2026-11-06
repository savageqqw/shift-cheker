import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import jwt from 'jsonwebtoken';

test('existing history migrates once; accounts isolate every read and mutation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'shiftly-accounts-'));
  process.env.TURSO_DATABASE_URL = pathToFileURL(join(dir, 'test.db')).href;
  process.env.JWT_SECRET = 'test-only-secret';
  process.env.APP_PASSWORD = 'owner-test-password';
  const { getDb, ensureSchema } = await import('../api/_lib/db.js');
  const { ensureAccounts } = await import('../api/_lib/accounts.js');
  const { signToken, verifyToken } = await import('../api/_lib/auth.js');
  const { default: auth } = await import('../api/auth.js');
  const { default: users } = await import('../api/users.js');
  const { default: schedule } = await import('../api/schedule.js');
  const { default: shifts } = await import('../api/shifts.js');
  const db = getDb();
  async function call(handler, token, method = 'GET', action, body, query = {}) {
    const res = { code: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler({ method, headers: { authorization: token ? `Bearer ${token}` : '' }, query: { action, ...query }, body }, res);
    return res;
  }
  try {
    await ensureSchema();
    await db.execute("UPDATE settings SET hourly_rate = 123, rest_weekdays = '2,3'");
    await db.execute("INSERT INTO shifts (date, total_hours, regular_count, wholesale_count, note) VALUES ('2026-11-01', 8, 4, 7, 'original history')");
    await db.execute("INSERT INTO overrides (date, is_working, note) VALUES ('2026-11-01', 0, 'original override')");
    await Promise.all([ensureAccounts(), ensureAccounts()]);
    // Simulate a new serverless instance to verify the migration marker.
    await (await import('../api/_lib/accounts.js?fresh=1')).ensureAccounts();
    assert.equal((await db.execute('SELECT COUNT(*) n FROM account_shifts')).rows[0].n, 1);
    assert.equal((await db.execute('SELECT COUNT(*) n FROM shifts')).rows[0].n, 1);
    const legacyToken = jwt.sign({ scope: 'shiftly' }, process.env.JWT_SECRET);
    assert.equal(verifyToken(legacyToken), null);
    assert.equal((await call(shifts, legacyToken, 'GET', 'list')).code, 401);
    assert.equal((await call(schedule, null, 'GET', 'state')).code, 401);
    const ownerLogin = await call(auth, null, 'POST', null, { username: 'OWNER', password: process.env.APP_PASSWORD });
    assert.equal(ownerLogin.code, 200);
    const owner = ownerLogin.data.token;
    const created = await call(users, owner, 'POST', null, { username: 'Friend', display_name: 'Друг', password: 'friend-test-password' });
    assert.equal(created.code, 201);
    assert.equal(created.data.user.username, 'friend');
    assert.equal(JSON.stringify(created.data).includes('password'), false);
    const stored = (await db.execute("SELECT password_hash FROM users WHERE username = 'friend'")).rows[0].password_hash;
    assert.notEqual(stored, 'friend-test-password');
    assert.equal((await call(users, owner, 'POST', null, { username: 'friend', display_name: 'Друг', password: 'friend-test-password' })).code, 409);
    const login = await call(auth, null, 'POST', null, { username: 'friend', password: 'friend-test-password' });
    assert.equal(login.code, 200);
    const friend = login.data.token;
    assert.equal((await call(users, friend)).data.user.username, 'friend');
    assert.equal((await call(users, friend, 'POST', null, { username: 'third', display_name: 'Another', password: 'third-password' })).code, 403);
    assert.equal((await call(auth, null, 'POST', null, { username: 'friend', password: process.env.APP_PASSWORD })).code, 401);
    const ownerState = await call(schedule, owner, 'GET', 'state');
    assert.equal(ownerState.data.settings.hourly_rate, 123);
    assert.equal(ownerState.data.overrides[0].note, 'original override');
    const friendState = await call(schedule, friend, 'GET', 'state');
    assert.equal(friendState.data.settings.hourly_rate, 95);
    assert.deepEqual(friendState.data.overrides, []);
    assert.deepEqual((await call(shifts, friend, 'GET', 'list')).data.shifts, []);
    await call(shifts, friend, 'POST', 'upsert', { user_id: 'owner', date: '2026-11-01', start_time: '09:00', end_time: '17:00', regular_count: 9, note: 'friend history' });
    assert.equal((await call(shifts, owner, 'GET', 'list')).data.shifts[0].note, 'original history');
    assert.equal((await call(shifts, friend, 'GET', 'list', null, { user_id: 'owner' })).data.shifts[0].note, 'friend history');
    await call(schedule, friend, 'POST', 'update-settings', { hourly_rate: 10, user_id: 'owner', bonus_rules: [] });
    assert.equal((await call(schedule, owner, 'GET', 'state')).data.settings.hourly_rate, 123);
    assert.equal((await call(shifts, friend, 'GET', 'stats')).data.stats.hours_value, 80);
    assert.equal((await call(shifts, owner, 'GET', 'stats')).data.stats.hours_value, 984);
    await call(schedule, friend, 'POST', 'set-override', { date: '2026-11-01', is_working: true, note: 'friend override' });
    await call(schedule, friend, 'POST', 'delete-override', { date: '2026-11-01', user_id: 'owner' });
    assert.equal((await call(schedule, owner, 'GET', 'state')).data.overrides.length, 1);
    await call(shifts, friend, 'POST', 'delete', { date: '2026-11-01', user_id: 'owner' });
    assert.equal((await call(shifts, owner, 'GET', 'list')).data.shifts.length, 1);
    assert.equal((await call(shifts, friend, 'GET', 'list')).data.shifts.length, 0);
    // Reopening migration does not resurrect deleted or overwrite edited rows.
    await (await import('../api/_lib/accounts.js?fresh=2')).ensureAccounts();
    assert.equal((await call(schedule, friend, 'GET', 'state')).data.settings.hourly_rate, 10);
    assert.equal((await call(shifts, friend, 'GET', 'list')).data.shifts.length, 0);
    for (let i = 0; i < 10; i++) await call(auth, null, 'POST', null, { username: 'nobody', password: 'wrong-password' });
    assert.equal((await call(auth, null, 'POST', null, { username: 'nobody', password: 'wrong-password' })).code, 429);
    assert.equal((await call(auth, null, 'POST', null, { username: 'owner', password: process.env.APP_PASSWORD })).code, 200);
    assert.equal((await call(shifts, signToken('owner'), 'GET', 'list')).headers['Cache-Control'], 'private, no-store');
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
