export const REQUEST_TYPES = { tradein: 'Трейд-ін', regular: 'Заявки', wholesale: 'Оптові', nova_poshta: 'Нова Пошта' };
export function parseBonusRules(value) {
  try { return typeof value === 'string' ? JSON.parse(value) : structuredClone(value || []); }
  catch { return []; }
}
export function validBonusRules(rules) {
  return Array.isArray(rules) && rules.length <= 50 && rules.every(r =>
    r && typeof r.name === 'string' && r.name.trim().length > 0 && r.name.length <= 100 &&
    Number.isInteger(r.threshold) && r.threshold > 0 && Number.isFinite(r.amount) && r.amount >= 0 &&
    Array.isArray(r.types) && r.types.length > 0 && new Set(r.types).size === r.types.length && r.types.every(t => Object.hasOwn(REQUEST_TYPES, t)));
}
const round = n => Math.round(n * 100) / 100;
export function summarize(rows, settings) {
  const result = { shift_count: rows.length, total_hours: 0, hours_value: 0, bonus_value: 0, total_value: 0, bonuses: [] };
  const months = new Map();
  for (const type of Object.keys(REQUEST_TYPES)) { result['total_' + type] = 0; result[type + '_value'] = 0; }
  for (const row of rows) {
    result.total_hours += Number(row.total_hours) || 0;
    const month = row.date.slice(0, 7);
    if (!months.has(month)) months.set(month, {});
    for (const type of Object.keys(REQUEST_TYPES)) {
      const count = Number(row[type + '_count']) || 0;
      result['total_' + type] += count;
      months.get(month)[type] = (months.get(month)[type] || 0) + count;
    }
  }
  const defaults = { tradein: 20, regular: 10, wholesale: 10, nova_poshta: 50 };
  result.hours_value = round(result.total_hours * (settings.hourly_rate ?? 95));
  result.total_value = result.hours_value;
  for (const type of Object.keys(REQUEST_TYPES)) {
    result[type + '_value'] = round(result['total_' + type] * (settings[type + '_rate'] ?? defaults[type]));
    result.total_value += result[type + '_value'];
  }
  const rules = parseBonusRules(settings.bonus_rules);
  if (validBonusRules(rules)) for (const [month, counts] of months) for (const rule of rules) {
    const count = rule.types.reduce((sum, type) => sum + (counts[type] || 0), 0);
    const earned = count >= rule.threshold;
    result.bonuses.push({ ...rule, month, count, earned });
    if (earned) result.bonus_value += rule.amount;
  }
  result.bonus_value = round(result.bonus_value);
  result.total_value = round(result.total_value + result.bonus_value);
  result.avg_hours = rows.length ? result.total_hours / rows.length : 0;
  result.total_hours = round(result.total_hours);
  return result;
}
