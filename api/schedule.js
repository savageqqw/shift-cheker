import { getDb, ensureSchema } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  await ensureSchema();
  const db = getDb();
  const action = req.query.action;

  try {
    if (req.method === 'GET' && action === 'state') {
      const [settingsRes, overridesRes] = await Promise.all([
        db.execute('SELECT * FROM settings WHERE id = 1'),
        db.execute('SELECT date, is_working, note FROM overrides ORDER BY date')
      ]);
      return res.status(200).json({
        settings: settingsRes.rows[0] || null,
        overrides: overridesRes.rows.map((r) => ({
          date: r.date,
          is_working: !!r.is_working,
          note: r.note || ''
        }))
      });
    }

    if (req.method === 'POST' && action === 'update-settings') {
      const {
        rest_weekdays,
        timezone,
        monthly_hours_goal,
        tradein_rate,
        nova_poshta_rate,
        regular_rate,
        hourly_rate
      } = req.body || {};
      let restWeekdays = null;
      if (rest_weekdays !== undefined) {
        if (!Array.isArray(rest_weekdays) || rest_weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
          return res.status(400).json({ error: 'Некоректні вихідні дні' });
        }
        restWeekdays = [...new Set(rest_weekdays)].sort().join(',');
      }
      const result = await db.execute({
        sql: `UPDATE settings SET rest_weekdays = COALESCE(?, rest_weekdays),
                     timezone = COALESCE(?, timezone),
                     monthly_hours_goal = COALESCE(?, monthly_hours_goal),
                     tradein_rate = COALESCE(?, tradein_rate),
                     nova_poshta_rate = COALESCE(?, nova_poshta_rate),
                     regular_rate = COALESCE(?, regular_rate),
                     hourly_rate = COALESCE(?, hourly_rate)
              WHERE id = 1 RETURNING *`,
        args: [
          restWeekdays,
          timezone || null,
          monthly_hours_goal || null,
          tradein_rate ?? null,
          nova_poshta_rate ?? null,
          regular_rate ?? null,
          hourly_rate ?? null
        ]
      });
      return res.status(200).json({ settings: result.rows[0] });
    }

    if (req.method === 'POST' && action === 'set-override') {
      const { date, is_working, note } = req.body || {};
      if (!date || typeof is_working !== 'boolean') {
        return res.status(400).json({ error: 'Некоректні дані заміни' });
      }
      const result = await db.execute({
        sql: `INSERT INTO overrides (date, is_working, note) VALUES (?, ?, ?)
              ON CONFLICT(date) DO UPDATE SET is_working = excluded.is_working, note = excluded.note
              RETURNING date, is_working, note`,
        args: [date, is_working ? 1 : 0, note || null]
      });
      const row = result.rows[0];
      return res.status(200).json({ override: { date: row.date, is_working: !!row.is_working, note: row.note || '' } });
    }

    if (req.method === 'POST' && action === 'delete-override') {
      const { date } = req.body || {};
      if (!date) return res.status(400).json({ error: 'Дата обов’язкова' });
      await db.execute({ sql: 'DELETE FROM overrides WHERE date = ?', args: [date] });
      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ error: 'Невідома дія' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Помилка сервера' });
  }
}
