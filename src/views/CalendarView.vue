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
      <button v-if="!isCurrentMonth" class="btn btn-sm today-btn" @click="goToday" aria-label="До поточного місяця">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
        </svg>
        <span class="today-text">Сьогодні</span>
      </button>
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
  gap: var(--space-5);
  min-width: 0;
}
.calendar-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
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
    flex: 0 0 300px;
    position: sticky;
    top: 92px;
  }
}

.calendar-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.calendar-toolbar > .btn-ghost {
  background: var(--card);
  border-color: var(--ink);
  box-shadow: var(--shadow-sm);
  font-size: 22px;
  font-weight: 800;
}
.calendar-toolbar > .btn-ghost:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}
.month-label {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  text-transform: uppercase;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 var(--space-1);
}
.today-btn {
  margin-left: auto;
}

/* Month summary: the loud yellow block */
.summary {
  background: var(--yellow);
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
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}
.summary-hours,
.summary-value {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 800;
  white-space: nowrap;
  line-height: 1.05;
}
.summary-of {
  font-family: var(--font-ui);
  font-size: 15px;
  font-weight: 700;
}
.summary-money {
  text-align: right;
}
.goal-bar {
  height: 16px;
  border-radius: 999px;
  background: var(--card);
  border: var(--bw-sm) solid var(--ink);
  overflow: hidden;
}
.goal-bar-fill {
  height: 100%;
  background: repeating-linear-gradient(-45deg, var(--ink) 0 6px, var(--teal) 6px 12px);
  transition: width 0.4s var(--ease);
}
.summary-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 13px;
  font-weight: 700;
}

/* Calendar grid */
.calendar {
  padding: var(--space-4);
}
.weekday-row,
.grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 7px;
}
.weekday-row {
  margin-bottom: 10px;
}
.weekday-row span {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
}

.cell {
  min-width: 0;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: var(--radius-sm);
  border: var(--bw-sm) solid var(--ink);
  box-shadow: var(--shadow-sm);
  background: var(--day-pending);
  color: var(--ink);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 7px;
  font: inherit;
  text-align: left;
  position: relative;
  user-select: none;
  transition: transform var(--press) var(--ease), box-shadow var(--press) var(--ease);
}
.cell:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}
.cell.blank {
  visibility: hidden;
}
.cell.work {
  background: var(--day-work);
}
.cell.rest {
  background: var(--day-rest);
}
/* Past work day with no hours: hatched, reads as "forgot to log" */
.cell.past.unset {
  background: repeating-linear-gradient(-45deg, var(--card) 0 5px, var(--sunk) 5px 10px);
}

.cell-day {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
  line-height: 1;
}
.cell.today {
  border-width: var(--bw);
  box-shadow: 3px 3px 0 var(--ink);
}
.cell.today .cell-day {
  background: var(--ink);
  color: var(--yellow);
  padding: 3px 5px;
  border-radius: 5px;
  margin: -3px 0 0 -3px;
}
/* swap marker: small yellow diamond with a black outline */
.cell-marker {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 10px;
  height: 10px;
  background: var(--day-swap);
  border: var(--bw-sm) solid var(--ink);
  transform: rotate(45deg);
}
.cell-readout {
  font-size: 11px;
  font-weight: 800;
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

.week-summary {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 4px 2px 10px;
  font-size: 12px;
  font-weight: 800;
}
.week-summary-label {
  color: var(--ink-3);
  font-weight: 700;
  white-space: nowrap;
}
.week-summary-values {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.week-summary-value {
  background: var(--yellow);
  border: var(--bw-sm) solid var(--ink);
  border-radius: 4px;
  padding: 0 5px;
}
.week-summary.empty {
  opacity: 0.5;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 13px;
  font-weight: 700;
  margin-top: var(--space-2);
}
.legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  display: inline-block;
  border: var(--bw-sm) solid var(--ink);
  background: var(--day-pending);
}
.swatch.work {
  background: var(--day-work);
}
.swatch.rest {
  background: var(--day-rest);
}
.swatch.marker {
  width: 10px;
  height: 10px;
  border-radius: 0;
  background: var(--day-swap);
  transform: rotate(45deg);
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
  font-size: 14px;
  font-weight: 800;
  padding: 5px 0;
}
.stats-line > span:first-child {
  font-weight: 600;
  color: var(--ink-2);
  white-space: nowrap;
}
.stats-money {
  color: var(--ink-3);
  font-weight: 700;
  margin-left: 6px;
}
.stats-grand-total {
  align-items: center;
  margin-top: 8px;
  padding: 10px 12px;
  background: var(--yellow);
  border: var(--bw-sm) solid var(--ink);
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 16px;
}
.stats-grand-total > span:first-child {
  font-family: var(--font-ui);
  font-weight: 800;
  color: var(--ink);
}
.weeks-details {
  margin-top: var(--space-3);
}
.weeks-details summary {
  cursor: pointer;
  font-size: 14px;
  font-weight: 800;
  padding: 10px 12px;
  list-style: none;
  display: flex;
  justify-content: space-between;
  border: var(--bw-sm) solid var(--ink);
  border-radius: var(--radius-sm);
  background: var(--sunk);
}
.weeks-details summary::-webkit-details-marker {
  display: none;
}
.weeks-details summary::after {
  content: '+';
  font-family: var(--font-display);
}
.weeks-details[open] summary::after {
  content: '−';
}
.stats-week {
  padding: 10px 0;
  border-bottom: var(--bw-sm) dashed var(--ink);
}
.stats-week:last-child {
  border-bottom: none;
}
.stats-week-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 4px;
}
.stats-week .stats-line {
  font-size: 13px;
  padding: 2px 0;
}

.empty-hint {
  padding: var(--space-5);
  font-weight: 700;
  text-align: center;
}

@media (max-width: 640px) {
  .month-label {
    font-size: 16px;
    flex: 1;
    text-align: center;
  }
  .today-btn {
    order: 3;
    width: 44px;
    min-height: 44px;
    padding: 0;
    margin-left: 0;
  }
  .today-text {
    display: none;
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
    gap: 5px;
  }
  .weekday-row span {
    font-size: 10px;
  }
  .cell {
    padding: 5px;
    border-radius: 6px;
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
  .cell-marker {
    top: 5px;
    right: 5px;
    width: 8px;
    height: 8px;
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
    font-size: 10px;
  }
  .summary-hours,
  .summary-value {
    font-size: 18px;
  }
}
</style>
