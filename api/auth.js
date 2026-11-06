import { signToken, equalPasswords, checkPassword } from './_lib/auth.js';
import { getDb } from './_lib/db.js';
import { ensureAccounts, OWNER_ID } from './_lib/accounts.js';

export default async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не підтримується' });
  const { password } = req.body || {};
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : 'owner';
  if (typeof password !== 'string' || !password || password.length > 256 || !/^[a-z0-9_-]{3,32}$/.test(username)) {
    return res.status(400).json({ error: 'Введи логін і пароль' });
  }
  try {
    await ensureAccounts();
    const db = getDb();
    const now = Date.now();
    const limits = await db.execute({
      sql: `INSERT INTO login_limits (username, attempts, started_at) VALUES (?, 1, ?)
        ON CONFLICT(username) DO UPDATE SET
          attempts = CASE WHEN started_at < ? THEN 1 ELSE attempts + 1 END,
          started_at = CASE WHEN started_at < ? THEN excluded.started_at ELSE started_at END
        RETURNING attempts`,
      args: [username, now, now - 900000, now - 900000]
    });
    if (limits.rows[0].attempts > 10) return res.status(429).json({ error: 'Забагато спроб входу. Спробуй через 15 хвилин.' });
    const { rows } = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
    const user = rows[0];
    const valid = user?.id === OWNER_ID
      ? !!process.env.APP_PASSWORD && equalPasswords(password, process.env.APP_PASSWORD)
      : await checkPassword(password, user?.password_hash);
    if (!user || !valid) return res.status(401).json({ error: 'Невірний логін або пароль' });
    await db.execute({ sql: 'DELETE FROM login_limits WHERE username = ?', args: [username] });
    return res.status(200).json({ token: signToken(user.id), user: { id: user.id, username: user.username, display_name: user.display_name } });
  } catch (error) {
    console.error('Login failed:', error.code || error.name);
    return res.status(500).json({ error: 'Не вдалося увійти. Спробуй ще раз.' });
  }
}
