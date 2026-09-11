import { getDb, ensureSchema } from './_lib/db.js';
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
  if (!requireAuth(req, res)) return;
  await ensureSchema();
  const db = getDb();
  const action = req.query.action;

  try {
    if (req.method === 'GET' && action === 'list') {
      const { from, to } = req.query;
      const result = await db.execute({
        sql: `SELECT * FROM shifts WHERE date >= ? AND date <= ? ORDER BY date`,
        args: [from || '0000-01-01', to || '9999-12-31']
      });
      return res.status(200).json({ shifts: result.rows });
    }

    if (req.method === 'GET' && action === 'stats') {
      const { from, to } = req.query;
      const [statsRes, ratesRes] = await Promise.all([
        db.execute({
          sql: `SELECT COUNT(*) as shift_count, COALESCE(SUM(total_hours), 0) as total_hours,
                       COALESCE(SUM(tradein_count), 0) as total_tradein,
                       COALESCE(SUM(nova_poshta_count), 0) as total_nova_poshta,
                       COALESCE(SUM(regular_count), 0) as total_regular,
                       COALESCE(AVG(total_hours), 0) as avg_hours
                FROM shifts WHERE date >= ? AND date <= ?`,
          args: [from || '0000-01-01', to || '9999-12-31']
        }),
        db.execute('SELECT tradein_rate, nova_poshta_rate, regular_rate FROM settings WHERE id = 1')
      ]);
      const stats = statsRes.rows[0];
      const rates = ratesRes.rows[0] || { tradein_rate: 20, nova_poshta_rate: 50, regular_rate: 10 };
      const tradein_value = Math.round(stats.total_tradein * rates.tradein_rate * 100) / 100;
      const nova_poshta_value = Math.round(stats.total_nova_poshta * rates.nova_poshta_rate * 100) / 100;
      const regular_value = Math.round(stats.total_regular * rates.regular_rate * 100) / 100;
      return res.status(200).json({
        stats: {
          ...stats,
          tradein_value,
          nova_poshta_value,
          regular_value,
          total_value: tradein_value + nova_poshta_value + regular_value
        }
      });
    }

    if (req.method === 'POST' && action === 'upsert') {
      const { date, start_time, end_time, tradein_count, nova_poshta_count, regular_count, note } = req.body || {};
      if (!date) return res.status(400).json({ error: 'Дата обов’язкова' });
      const total_hours = computeHours(start_time, end_time);
      const result = await db.execute({
        sql: `INSERT INTO shifts (date, start_time, end_time, total_hours, tradein_count, nova_poshta_count, regular_count, note, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(date) DO UPDATE SET
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                total_hours = excluded.total_hours,
                tradein_count = excluded.tradein_count,
                nova_poshta_count = excluded.nova_poshta_count,
                regular_count = excluded.regular_count,
                note = excluded.note,
                updated_at = datetime('now')
              RETURNING *`,
        args: [
          date,
          start_time || null,
          end_time || null,
          total_hours,
          tradein_count || 0,
          nova_poshta_count || 0,
          regular_count || 0,
          note || null
        ]
      });
      return res.status(200).json({ shift: result.rows[0] });
    }

    if (req.method === 'POST' && action === 'delete') {
      const { date } = req.body || {};
      if (!date) return res.status(400).json({ error: 'Дата обов’язкова' });
      await db.execute({ sql: 'DELETE FROM shifts WHERE date = ?', args: [date] });
      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ error: 'Невідома дія' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Помилка сервера' });
  }
}
