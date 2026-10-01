// Weekday indexes follow Date#getDay(): 0 = Sunday … 6 = Saturday.
export const DEFAULT_REST_WEEKDAYS = [0, 1]; // неділя + понеділок

// Monday-first order for UI pickers and the calendar header.
export const WEEKDAYS = [
  { idx: 1, short: 'Пн', long: 'понеділок' },
  { idx: 2, short: 'Вт', long: 'вівторок' },
  { idx: 3, short: 'Ср', long: 'середа' },
  { idx: 4, short: 'Чт', long: 'четвер' },
  { idx: 5, short: 'Пт', long: 'пʼятниця' },
  { idx: 6, short: 'Сб', long: 'субота' },
  { idx: 0, short: 'Нд', long: 'неділя' }
];

/** Parses the stored "0,1" string (or an array) into a list of weekday indexes. */
export function parseRestWeekdays(value) {
  if (Array.isArray(value)) return value.map(Number);
  if (value === '') return [];
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  }
  return [...DEFAULT_REST_WEEKDAYS];
}

function parseDate(dateStr) {
  // Parse as local midnight — `new Date('YYYY-MM-DD')` would be UTC and can
  // slip to the previous day in negative offsets.
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Returns 'work' | 'rest' for a given date under the weekly pattern,
 * ignoring manual overrides.
 */
export function baseDayType(dateStr, settings) {
  const rest = parseRestWeekdays(settings?.rest_weekdays);
  return rest.includes(parseDate(dateStr).getDay()) ? 'rest' : 'work';
}

/**
 * Returns { type: 'work'|'rest', overridden: boolean, note } accounting
 * for manual per-day swaps (naparnyk coverage changes).
 */
export function effectiveDayType(dateStr, settings, overridesByDate) {
  const override = overridesByDate[dateStr];
  if (override) {
    return { type: override.is_working ? 'work' : 'rest', overridden: true, note: override.note || '' };
  }
  return { type: baseDayType(dateStr, settings), overridden: false, note: '' };
}

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Short list of rest days in Monday-first order, e.g. "Пн, Нд". */
export function restDaysLabel(settings) {
  const rest = parseRestWeekdays(settings?.rest_weekdays);
  const names = WEEKDAYS.filter((w) => rest.includes(w.idx)).map((w) => w.short);
  return names.length ? names.join(', ') : 'без вихідних';
}
