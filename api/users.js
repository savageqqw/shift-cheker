import { randomUUID } from 'node:crypto';
import { requireAuth, hashPassword } from './_lib/auth.js';
import { ensureAccounts, OWNER_ID } from './_lib/accounts.js';
import { getDb } from './_lib/db.js';

export default async function handler(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    await ensureAccounts();
    const db = getDb();
    if (req.method === 'GET') {
      const { rows } = await db.execute({ sql: 'SELECT id, username, display_name FROM users WHERE id = ?', args: [userId] });
      if (!rows.length) return res.status(401).json({ error: 'Увійди ще раз' });
      return res.status(200).json({ user: rows[0] });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не підтримується' });
    if (userId !== OWNER_ID) return res.status(403).json({ error: 'Створювати акаунти може лише власник' });
    const { password, display_name } = req.body || {};
    const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    if (!/^[a-z0-9_-]{3,32}$/.test(username) || username === 'owner') return res.status(400).json({ error: 'Логін: 3–32 латинські літери, цифри, _ або -. Логін owner зарезервований.' });
    if (typeof password !== 'string' || password.length < 10 || password.length > 256) return res.status(400).json({ error: 'Пароль: від 10 до 256 символів' });
    if (typeof display_name !== 'string' || !display_name.trim() || display_name.trim().length > 80) return res.status(400).json({ error: 'Вкажи ім’я до 80 символів' });
    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    await db.batch([
      { sql: 'INSERT INTO users (id, username, display_name, password_hash) VALUES (?, ?, ?, ?)', args: [id, username, display_name.trim(), passwordHash] },
      { sql: `INSERT INTO account_settings (user_id, anchor_date) VALUES (?, date('now'))`, args: [id] }
    ], 'write');
    return res.status(201).json({ user: { id, username, display_name: display_name.trim() } });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Цей логін уже зайнятий' });
    console.error('Account creation failed:', error.code || error.name);
    return res.status(500).json({ error: 'Не вдалося зберегти акаунт' });
  }
}
