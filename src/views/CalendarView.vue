<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useScheduleStore } from '../stores/schedule.js';
import { useShiftsStore } from '../stores/shifts.js';
import { effectiveDayType, dateKey, restDaysLabel, WEEKDAYS } from '../lib/scheduleEngine.js';
import DayModal from '../components/DayModal.vue';

const schedule = useScheduleStore();
const shifts = useShiftsStore();

const today = new Date();
const todayKey = dateKey(today);
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth()); // 0-based
const openDate = ref(null);
const isCurrentMonth = computed(() => viewYear.value === today.getFullYear() && viewMonth.value === today.getMonth());

// month-only format gives the nominative "жовтень" and avoids the trailing "р."
const monthLabel = computed(
  () => `${new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString('uk-UA', { month: 'long' })} ${viewYear.value}`
);

const rangeBounds = computed(() => {
  const from = dateKey(new Date(viewYear.value, viewMonth.value, 1));
  const to = dateKey(new Date(viewYear.value, viewMonth.value + 1, 0));
  return { from, to };
});

async function loadMonth() {
  if (!schedule.loaded) await schedule.load();
  const { from, to } = rangeBounds.value;
  await shifts.loadRange(from, to);
}

const monthlyGoal = computed(() => schedule.settings?.monthly_hours_goal ?? 200);

onMounted(loadMonth);
watch([viewYear, viewMonth], loadMonth);

const rates = computed(() => ({
  hourly: schedule.settings?.hourly_rate ?? 95,
  tradein: schedule.settings?.tradein_rate ?? 20,
  novaPoshta: schedule.settings?.nova_poshta_rate ?? 50,
  regular: schedule.settings?.regular_rate ?? 10
}));

const round2 = (n) => Math.round(n * 100) / 100;

function cellInfo(date) {
  const key = dateKey(date);
  const info = effectiveDayType(key, schedule.settings, schedule.overrides);
  const shift = shifts.byDate[key] || null;
  const logged = !!(shift && shift.start_time && shift.end_time);
  // Only a work day with hours actually logged turns green — a scheduled
  // work day nobody confirmed yet stays neutral so nothing is promised in advance.
  const status = info.type === 'work' ? (logged ? 'work' : 'unset') : info.type;
  let itemsCount = 0;
  let payValue = 0;
  if (shift) {
    const r = rates.value;
    itemsCount = (shift.tradein_count || 0) + (shift.nova_poshta_count || 0) + (shift.regular_count || 0);
    payValue = round2(
      (shift.total_hours || 0) * r.hourly +
        (shift.tradein_count || 0) * r.tradein +
        (shift.nova_poshta_count || 0) * r.novaPoshta +
        (shift.regular_count || 0) * r.regular
    );
  }
  return {
    key,
    day: date.getDate(),
    ...info,
    status,
    logged,
    shift,
    itemsCount,
    payValue,
    isToday: key === todayKey,
    isPast: key < todayKey
  };
}

// Calendar rows (Monday-first), each cell resolved once per render.
const weeks = computed(() => {
  if (!schedule.settings) return [];
  const first = new Date(viewYear.value, viewMonth.value, 1);
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate();
  const leadingBlank = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < leadingBlank; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(cellInfo(new Date(viewYear.value, viewMonth.value, d)));
  while (cells.length % 7 !== 0) cells.push(null);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
});

// Per-row totals with a per-type breakdown (trade-in / Nova Poshta / regular).
const weekTotals = computed(() =>
  weeks.value.map((row) => {
    const r = rates.value;
    const t = {
      hours: 0,
      tradeinCount: 0,
      novaPoshtaCount: 0,
      regularCount: 0,
      hasAnyShift: false
    };
    row.forEach((c) => {
      if (!c || !c.shift) return;
      const s = c.shift;
      t.hasAnyShift = true;
      t.hours += s.total_hours || 0;
      t.tradeinCount += s.tradein_count || 0;
      t.novaPoshtaCount += s.nova_poshta_count || 0;
      t.regularCount += s.regular_count || 0;
    });
    const days = row.filter(Boolean);
    const hoursValue = t.hours * r.hourly;
    const tradeinValue = t.tradeinCount * r.tradein;
    const novaPoshtaValue = t.novaPoshtaCount * r.novaPoshta;
    const regularValue = t.regularCount * r.regular;
    return {
      ...t,
      hours: round2(t.hours),
      hoursValue: round2(hoursValue),
      tradeinValue: round2(tradeinValue),
      novaPoshtaValue: round2(novaPoshtaValue),
      regularValue: round2(regularValue),
      itemsCount: t.tradeinCount + t.novaPoshtaCount + t.regularCount,
      itemsValue: round2(tradeinValue + novaPoshtaValue + regularValue),
      value: round2(hoursValue + tradeinValue + novaPoshtaValue + regularValue),
      range: days.length ? (days.length === 1 ? `${days[0].day}` : `${days[0].day}–${days[days.length - 1].day}`) : ''
    };
  })
);

const monthTotals = computed(() => {
  const keys = ['hours', 'hoursValue', 'tradeinCount', 'tradeinValue', 'novaPoshtaCount', 'novaPoshtaValue',
    'regularCount', 'regularValue', 'itemsCount', 'itemsValue', 'value'];
  const acc = Object.fromEntries(keys.map((k) => [k, 0]));
  weekTotals.value.forEach((w) => keys.forEach((k) => (acc[k] = round2(acc[k] + w[k]))));
  return acc;
});

const goalProgressPct = computed(() => {
  if (!monthlyGoal.value) return 0;
  return Math.min(100, Math.round((monthTotals.value.hours / monthlyGoal.value) * 1000) / 10);
});

// Work days left in the month from today on (inclusive), for the hint under the goal bar.
const workDaysLeft = computed(() => {
  let n = 0;
  weeks.value.forEach((row) =>
    row.forEach((c) => {
      if (c && c.type === 'work' && !c.isPast && !c.logged) n++;
    })
  );
  return n;
});

function shiftMonth(delta) {
  const d = new Date(viewYear.value, viewMonth.value + delta, 1);
  viewYear.value = d.getFullYear();
  viewMonth.value = d.getMonth();
}
function goToday() {
  viewYear.value = today.getFullYear();
  viewMonth.value = today.getMonth();
}

// Horizontal swipe on the grid flips months on touch screens.
let touchX = null;
let touchY = null;
function onTouchStart(e) {
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
}
function onTouchEnd(e) {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  touchX = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1);
}

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));
const money = (n) => Math.round(n).toLocaleString('uk-UA');
</script>

<template>
  <div class="calendar-page">
    <div class="calendar-toolbar">
      <button class="btn btn-ghost btn-icon" @click="shiftMonth(-1)" aria-label="Попередній місяць">‹</button>
      <div class="month-label">{{ monthLabel }}</div>
      <button class="btn btn-ghost btn-icon" @click="shiftMonth(1)" aria-label="Наступний місяць">›</button>
      <button class="btn btn-sm today-btn" :disabled="isCurrentMonth" @click="goToday">Сьогодні</button>
    </div>

    <div v-if="!schedule.settings" class="empty-hint card">Завантаження графіка…</div>

    <div v-else class="calendar-layout">
      <div class="calendar-main">
        <div class="summary card">
          <div class="summary-top">
            <div>
              <div class="summary-label">Відпрацьовано</div>
              <div class="summary-hours">
                {{ fmt(monthTotals.hours) }}<span class="summary-of"> / {{ monthlyGoal }} год</span>
              </div>
            </div>
            <div class="summary-money">
              <div class="summary-label">Заробіток</div>
              <div class="summary-value">{{ money(monthTotals.value) }} ₴</div>
            </div>
          </div>
          <div class="goal-bar">
            <div class="goal-bar-fill" :style="{ width: goalProgressPct + '%' }"></div>
          </div>
          <div class="summary-foot">
            <span>{{ goalProgressPct }}% цілі</span>
            <span v-if="workDaysLeft">ще {{ workDaysLeft }} робочих днів</span>
            <span>вихідні: {{ restDaysLabel(schedule.settings) }}</span>
          </div>
        </div>

        <div class="calendar card" @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
          <div class="weekday-row">
            <span v-for="w in WEEKDAYS" :key="w.idx">{{ w.short }}</span>
          </div>

          <div class="grid">
            <template v-for="(row, ri) in weeks" :key="ri">
              <template v-for="(c, ci) in row" :key="ci">
                <button
                  v-if="c"
                  type="button"
                  class="cell"
                  :class="[c.status, { today: c.isToday, overridden: c.overridden, past: c.isPast }]"
                  :aria-label="`${c.day}, ${c.type === 'work' ? 'робочий' : 'вихідний'}`"
                  @click="openDate = c.key"
                >
                  <span class="cell-day">{{ c.day }}</span>
                  <span v-if="c.overridden" class="cell-marker" title="Заміна графіка"></span>
                  <span v-if="c.shift" class="cell-readout">
                    <span v-if="c.shift.total_hours" class="cell-hours">{{ fmt(c.shift.total_hours) }}г</span>
                    <span v-if="c.itemsCount" class="cell-items">{{ c.itemsCount }}шт</span>
                    <span v-if="c.payValue" class="cell-value">{{ money(c.payValue) }}₴</span>
                  </span>
                </button>
                <div v-else class="cell blank"></div>
              </template>
              <div class="week-summary" :class="{ empty: !weekTotals[ri].hasAnyShift }">
                <span class="week-summary-label">тиждень {{ weekTotals[ri].range }}</span>
                <span class="week-summary-values">
                  <span>{{ fmt(weekTotals[ri].hours) }}г</span>
                  <span v-if="weekTotals[ri].itemsCount">{{ weekTotals[ri].itemsCount }}шт</span>
                  <span v-if="weekTotals[ri].value" class="week-summary-value">{{ money(weekTotals[ri].value) }}₴</span>
                </span>
              </div>
            </template>
          </div>

          <div class="legend">
            <span><i class="swatch work"></i>відпрацьовано</span>
            <span><i class="swatch unset"></i>робочий</span>
            <span><i class="swatch rest"></i>вихідний</span>
            <span><i class="swatch marker"></i>заміна</span>
          </div>
        </div>
      </div>

      <aside class="calendar-sidebar">
        <div class="stats-card card">
          <p class="panel-title">Разом за місяць</p>
          <div class="stats-line">
            <span>Години</span>
            <span>{{ fmt(monthTotals.hours) }}г <span class="stats-money">{{ money(monthTotals.hoursValue) }}₴</span></span>
          </div>
          <div class="stats-line">
            <span>Трейд-ін</span>
            <span>{{ monthTotals.tradeinCount }}шт <span class="stats-money">{{ money(monthTotals.tradeinValue) }}₴</span></span>
          </div>
          <div class="stats-line">
            <span>Нова Пошта</span>
            <span>
              {{ monthTotals.novaPoshtaCount }}шт <span class="stats-money">{{ money(monthTotals.novaPoshtaValue) }}₴</span>
            </span>
          </div>
          <div class="stats-line">
            <span>Заявки</span>
            <span>{{ monthTotals.regularCount }}шт <span class="stats-money">{{ money(monthTotals.regularValue) }}₴</span></span>
          </div>
          <div class="stats-line stats-grand-total">
            <span>Всього</span>
            <span>{{ money(monthTotals.value) }}₴</span>
          </div>

          <details class="weeks-details">
            <summary>По тижнях</summary>
            <div class="stats-week" v-for="(w, i) in weekTotals" :key="i">
              <div class="stats-week-header">
                <span>Тиждень {{ w.range }}</span>
                <span class="stats-week-total">{{ money(w.value) }}₴</span>
              </div>
              <div class="stats-line">
                <span>Години</span>
                <span>{{ fmt(w.hours) }}г <span class="stats-money">{{ money(w.hoursValue) }}₴</span></span>
              </div>
              <div class="stats-line">
                <span>Трейд-ін</span>
                <span>{{ w.tradeinCount }}шт <span class="stats-money">{{ money(w.tradeinValue) }}₴</span></span>
              </div>
              <div class="stats-line">
                <span>Нова Пошта</span>
                <span>{{ w.novaPoshtaCount }}шт <span class="stats-money">{{ money(w.novaPoshtaValue) }}₴</span></span>
              </div>
              <div class="stats-line">
                <span>Заявки</span>
                <span>{{ w.regularCount }}шт <span class="stats-money">{{ money(w.regularValue) }}₴</span></span>
              </div>
            </div>
          </details>
        </div>
      </aside>
    </div>

    <DayModal v-if="openDate" :date="openDate" @close="openDate = null" />
  </div>
</template>

<style scoped>
.calendar-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  min-width: 0;
}

.calendar-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}
.calendar-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}
.calendar-sidebar {
  min-width: 0;
}

/* Sidebar sits to the right on desktop; mobile shows calendar first. */
@media (min-width: 900px) {
  .calendar-layout {
    flex-direction: row;
    align-items: flex-start;
  }
  .calendar-main {
    flex: 1;
  }
  .calendar-sidebar {
    flex: 0 0 290px;
    position: sticky;
    top: 84px;
  }
}

.calendar-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.month-label {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-transform: capitalize;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 var(--space-1);
}
.today-btn {
  margin-left: auto;
}

/* Month summary */
.summary {
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.summary-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-3);
}
.summary-label {
  font-size: 12px;
  color: var(--ink-2);
  margin-bottom: 2px;
}
.summary-hours,
.summary-value {
  font-family: var(--font-num);
  font-size: 24px;
  font-weight: 700;
  white-space: nowrap;
}
.summary-of {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-2);
}
.summary-money {
  text-align: right;
}
.summary-value {
  color: var(--accent);
}
.goal-bar {
  height: 8px;
  border-radius: 999px;
  background: var(--bg-3);
  overflow: hidden;
}
.goal-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.4s var(--ease);
}
.summary-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 12px;
  color: var(--ink-3);
}

/* Calendar grid */
.calendar {
  padding: var(--space-4);
}
.weekday-row,
.grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}
.weekday-row {
  margin-bottom: 8px;
}
.weekday-row span {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-3);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cell {
  min-width: 0;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: var(--bg-2);
  color: var(--ink-2);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8px;
  font: inherit;
  font-family: var(--font-num);
  text-align: left;
  position: relative;
  user-select: none;
  transition: border-color 0.15s var(--ease), background 0.15s var(--ease), transform 0.1s var(--ease);
}
.cell:hover {
  border-color: var(--line-strong);
}
.cell:active {
  transform: scale(0.95);
}
.cell.blank {
  visibility: hidden;
  cursor: default;
}
.cell.work {
  background: var(--state-work-bg);
  color: var(--state-work-text);
  border-color: var(--state-work-border);
}
.cell.rest {
  background: var(--state-rest-bg);
  color: var(--state-rest-text);
  border-color: transparent;
}
.cell.unset .cell-day {
  color: var(--ink-0);
}
.cell.past.unset {
  border-style: dashed;
  border-color: var(--line);
}
.cell.today {
  box-shadow: 0 0 0 2px var(--surface-today-ring);
}

.cell-day {
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
.cell.rest .cell-day {
  color: var(--state-rest-text);
}
.cell.work .cell-day {
  color: var(--ink-0);
}
.cell-marker {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fbbf24;
}
.cell-readout {
  font-size: 10.5px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  max-width: 100%;
  line-height: 1.2;
}
.cell-readout span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cell-value {
  font-weight: 700;
}

.week-summary {
  grid-column: 1 / -1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 2px 4px 8px;
  font-family: var(--font-num);
  font-size: 11px;
  color: var(--ink-2);
}
.week-summary-label {
  color: var(--ink-3);
  font-family: var(--font-ui);
  font-size: 11px;
  white-space: nowrap;
}
.week-summary-values {
  display: flex;
  gap: 8px;
  color: var(--ink-1);
  white-space: nowrap;
}
.week-summary-value {
  color: var(--accent);
  font-weight: 600;
}
.week-summary.empty {
  opacity: 0.45;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  font-size: 12px;
  color: var(--ink-2);
  margin-top: var(--space-2);
}
.legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.swatch {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  display: inline-block;
  border: 1px solid var(--line);
  background: var(--bg-2);
}
.swatch.work {
  background: var(--state-work-bg);
  border-color: var(--state-work-border);
}
.swatch.rest {
  background: var(--state-rest-bg);
  border-color: var(--state-rest-border);
}
.swatch.marker {
  width: 7px;
  height: 7px;
  border: none;
  border-radius: 50%;
  background: #fbbf24;
}

/* Sidebar stats */
.stats-card {
  padding: var(--space-4) var(--space-5);
}
.stats-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  font-family: var(--font-num);
  font-size: 13px;
  color: var(--ink-0);
  padding: 4px 0;
}
.stats-line > span:first-child {
  font-family: var(--font-ui);
  color: var(--ink-2);
  white-space: nowrap;
}
.stats-money {
  color: var(--ink-3);
  margin-left: 6px;
}
.stats-grand-total {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  font-weight: 700;
  font-size: 15px;
}
.stats-grand-total > span:first-child {
  color: var(--ink-0);
}
.stats-grand-total > span:last-child {
  color: var(--accent);
}
.weeks-details {
  margin-top: var(--space-3);
  border-top: 1px solid var(--line-soft);
  padding-top: var(--space-2);
}
.weeks-details summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-1);
  padding: 8px 0;
  list-style: none;
  display: flex;
  justify-content: space-between;
}
.weeks-details summary::-webkit-details-marker {
  display: none;
}
.weeks-details summary::after {
  content: '▾';
  color: var(--ink-3);
  transition: transform 0.2s var(--ease);
}
.weeks-details[open] summary::after {
  transform: rotate(180deg);
}
.stats-week {
  padding: 10px 0;
  border-top: 1px solid var(--line-soft);
}
.stats-week-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-1);
  margin-bottom: 4px;
}
.stats-week-total {
  font-family: var(--font-num);
  color: var(--accent);
}
.stats-week .stats-line {
  font-size: 12px;
  padding: 2px 0;
}

.empty-hint {
  padding: var(--space-5);
  color: var(--ink-2);
  text-align: center;
}

@media (max-width: 640px) {
  .month-label {
    font-size: 18px;
  }
  .summary {
    padding: var(--space-4);
  }
  .summary-hours,
  .summary-value {
    font-size: 21px;
  }
  .calendar {
    padding: var(--space-3) 10px;
  }
  .weekday-row,
  .grid {
    gap: 4px;
  }
  .cell {
    padding: 5px;
    border-radius: 8px;
    aspect-ratio: auto;
    min-height: 54px;
  }
  .cell-day {
    font-size: 13px;
  }
  /* On a phone a cell only fits the hours; money lives in the week row. */
  .cell-items,
  .cell-value {
    display: none;
  }
  .cell-readout {
    font-size: 10.5px;
    font-weight: 600;
  }
  .cell-marker {
    top: 5px;
    right: 5px;
  }
  .stats-card {
    padding: var(--space-4);
  }
}

@media (max-width: 360px) {
  .cell {
    min-height: 48px;
    padding: 4px;
  }
  .cell-day {
    font-size: 12px;
  }
  .cell-readout {
    font-size: 9.5px;
  }
  .summary-hours,
  .summary-value {
    font-size: 18px;
  }
}
</style>
