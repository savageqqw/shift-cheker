import { getDb } from './_lib/db.js';
import { ensureAccounts } from './_lib/accounts.js';
import { summarize } from '../src/lib/earnings.js';
import { requireAuth } from './_lib/auth.js';

function computeHours(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60; // overnight shift
  return Math.round((minutes / 60) * 100) / 100;
}

export default async function handler(req, res) {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const db = getDb();
  const action = req.query.action;

  try {
    await ensureAccounts();
    if (req.method === 'GET' && action === 'list') {
      const { from, to } = req.query;
      const result = await db.execute({
        sql: `SELECT * FROM account_shifts WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date`,
        args: [userId, from || '0000-01-01', to || '9999-12-31']
      });
      return res.status(200).json({ shifts: result.rows });
    }

    if (req.method === 'GET' && action === 'stats') {
      const { from, to } = req.query;
      const [rows, settings] = await Promise.all([
        db.execute({ sql: 'SELECT * FROM account_shifts WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date', args: [userId, from || '0000-01-01', to || '9999-12-31'] }),
        db.execute({ sql: 'SELECT * FROM account_settings WHERE user_id = ?', args: [userId] })
      ]);
      return res.status(200).json({ stats: summarize(rows.rows, settings.rows[0] || {}) });
    }

    if (req.method === 'POST' && action === 'upsert') {
      const { date, start_time, end_time, tradein_count, nova_poshta_count, regular_count, wholesale_count, note } = req.body || {};
      if (!date) return res.status(400).json({ error: 'Дата обов’язкова' });
      for (const count of [tradein_count, nova_poshta_count, regular_count, wholesale_count]) {
        if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) return res.status(400).json({ error: 'Кількість заявок має бути цілим невід’ємним числом' });
      }
      const total_hours = computeHours(start_time, end_time);
      const result = await db.execute({
        sql: `INSERT INTO account_shifts (user_id, date, start_time, end_time, total_hours, tradein_count, nova_poshta_count, regular_count, wholesale_count, note, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(user_id, date) DO UPDATE SET
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                total_hours = excluded.total_hours,
                tradein_count = excluded.tradein_count,
                nova_poshta_count = excluded.nova_poshta_count,
                regular_count = excluded.regular_count,
                wholesale_count = excluded.wholesale_count,
                note = excluded.note,
                updated_at = datetime('now')
              RETURNING *`,
        args: [
          userId,
          date,
          start_time || null,
          end_time || null,
          total_hours,
          tradein_count || 0,
          nova_poshta_count || 0,
          regular_count || 0,
          wholesale_count || 0,
          note || null
        ]
      });
      return res.status(200).json({ shift: result.rows[0] });
    }

    if (req.method === 'POST' && action === 'delete') {
      const { date } = req.body || {};
      if (!date) return res.status(400).json({ error: 'Дата обов’язкова' });
      await db.execute({ sql: 'DELETE FROM account_shifts WHERE user_id = ? AND date = ?', args: [userId, date] });
      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ error: 'Невідома дія' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Помилка сервера' });
  }
}
