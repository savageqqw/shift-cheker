function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Returns 'work' | 'rest' for a given date under the base rotation,
 * ignoring manual overrides.
 */
export function baseDayType(dateStr, settings) {
  if (!settings || !settings.anchor_date) return 'rest';
  const anchor = toDateOnly(new Date(settings.anchor_date));
  const date = toDateOnly(new Date(dateStr));
  const diffDays = Math.round((date - anchor) / 86400000);
  const cycleLen = settings.work_days + settings.rest_days;
  let pos = diffDays % cycleLen;
  if (pos < 0) pos += cycleLen;
  return pos < settings.work_days ? 'work' : 'rest';
}

/**
 * Returns { type: 'work'|'rest'|'unset', overridden: boolean, note } accounting
 * for manual per-day swaps (naparnyk coverage changes). Days before the anchor
 * date have no defined rotation yet, so they come back as 'unset' unless a
 * manual override was placed on them.
 */
export function effectiveDayType(dateStr, settings, overridesByDate) {
  const override = overridesByDate[dateStr];
  if (override) {
    return { type: override.is_working ? 'work' : 'rest', overridden: true, note: override.note || '' };
  }
  if (settings && settings.anchor_date && dateStr < settings.anchor_date) {
    return { type: 'unset', overridden: false, note: '' };
  }
  return { type: baseDayType(dateStr, settings), overridden: false, note: '' };
}

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentCyclePosition(dateStr, settings) {
  if (!settings || !settings.anchor_date) return null;
  const anchor = toDateOnly(new Date(settings.anchor_date));
  const date = toDateOnly(new Date(dateStr));
  const diffDays = Math.round((date - anchor) / 86400000);
  const cycleLen = settings.work_days + settings.rest_days;
  let pos = diffDays % cycleLen;
  if (pos < 0) pos += cycleLen;
  return { day: pos + 1, of: cycleLen, phase: pos < settings.work_days ? 'work' : 'rest' };
}
