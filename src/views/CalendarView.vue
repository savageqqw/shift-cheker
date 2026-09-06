<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useScheduleStore } from '../stores/schedule.js';
import { useShiftsStore } from '../stores/shifts.js';
import { effectiveDayType, dateKey } from '../lib/scheduleEngine.js';
import DayModal from '../components/DayModal.vue';

const schedule = useScheduleStore();
const shifts = useShiftsStore();

const today = new Date();
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth()); // 0-based
const openDate = ref(null);

const monthLabel = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
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

const monthTotalHours = computed(() => {
  const { from, to } = rangeBounds.value;
  let sum = 0;
  for (const [key, shift] of Object.entries(shifts.byDate)) {
    if (key >= from && key <= to && shift.total_hours) sum += shift.total_hours;
  }
  return Math.round(sum * 100) / 100;
});

const goalProgressPct = computed(() => {
  if (!monthlyGoal.value) return 0;
  return Math.min(100, Math.round((monthTotalHours.value / monthlyGoal.value) * 1000) / 10);
});

onMounted(loadMonth);
watch([viewYear, viewMonth], loadMonth);

const weeks = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1);
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate();
  // Monday-first week
  const leadingBlank = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < leadingBlank; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear.value, viewMonth.value, d);
    cells.push(date);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
});

function cellInfo(date) {
  if (!date || !schedule.settings) return null;
  const key = dateKey(date);
  const info = effectiveDayType(key, schedule.settings, schedule.overrides);
  const shift = shifts.byDate[key] || null;
  const isToday = key === dateKey(today);
  const logged = !!(shift && shift.start_time && shift.end_time);
  // Only a work day with hours actually logged turns green — a scheduled
  // work day nobody confirmed yet stays neutral so nothing is promised in advance.
  const status = info.type === 'work' ? (logged ? 'work' : 'unset') : info.type;
  let itemsValue = 0;
  if (shift) {
    itemsValue =
      (shift.tradein_count || 0) * (schedule.settings.tradein_rate ?? 20) +
      (shift.nova_poshta_count || 0) * (schedule.settings.nova_poshta_rate ?? 50);
  }
  return { key, ...info, status, logged, shift, itemsValue, isToday };
}

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11;
    viewYear.value -= 1;
  } else {
    viewMonth.value -= 1;
  }
}
function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0;
    viewYear.value += 1;
  } else {
    viewMonth.value += 1;
  }
}
function goToday() {
  viewYear.value = today.getFullYear();
  viewMonth.value = today.getMonth();
}

const weekdayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
</script>

<template>
  <div class="calendar-page">
    <div class="calendar-toolbar">
      <div class="month-nav">
        <button class="btn btn-ghost btn-sm" @click="prevMonth" aria-label="Попередній місяць">←</button>
        <span class="month-label">{{ monthLabel }}</span>
        <button class="btn btn-ghost btn-sm" @click="nextMonth" aria-label="Наступний місяць">→</button>
      </div>
      <button class="btn btn-sm" @click="goToday">Сьогодні</button>
    </div>

    <div v-if="!schedule.settings" class="empty-hint card">Завантаження графіка…</div>

    <template v-else>
      <div class="goal-card card">
        <div class="goal-top">
          <span class="goal-label">Відпрацьовано за {{ monthLabel }}</span>
          <span class="goal-value">{{ monthTotalHours }}<span class="goal-of">/ {{ monthlyGoal }} год</span></span>
        </div>
        <div class="goal-bar">
          <div class="goal-bar-fill" :style="{ width: goalProgressPct + '%' }"></div>
        </div>
      </div>

      <div class="weekday-row">
        <span v-for="w in weekdayLabels" :key="w">{{ w }}</span>
      </div>

      <div class="grid">
        <template v-for="(row, ri) in weeks" :key="ri">
          <div
            v-for="(date, ci) in row"
            :key="ci"
            class="cell"
            :class="[
              date ? cellInfo(date).status : 'blank',
              { today: date && cellInfo(date).isToday, overridden: date && cellInfo(date).overridden }
            ]"
            :role="date ? 'button' : undefined"
            :tabindex="date ? 0 : -1"
            @click="date && (openDate = cellInfo(date).key)"
            @keydown.enter="date && (openDate = cellInfo(date).key)"
          >
            <template v-if="date">
              <span class="cell-day">{{ date.getDate() }}</span>
              <span v-if="cellInfo(date).overridden" class="cell-marker" title="Заміна графіка">◇</span>
              <span v-if="cellInfo(date).shift" class="cell-readout">
                <span v-if="cellInfo(date).shift.total_hours">{{ cellInfo(date).shift.total_hours }}г</span>
                <span v-if="cellInfo(date).itemsValue">· {{ cellInfo(date).itemsValue }}₴</span>
              </span>
            </template>
          </div>
        </template>
      </div>

      <div class="legend">
        <span><i class="swatch work"></i> відпрацьовано (є години)</span>
        <span><i class="swatch rest"></i> вихідний</span>
        <span><i class="swatch unset"></i> робочий, ще не внесено години</span>
        <span><i class="swatch marker">◇</i> заміна графіка</span>
      </div>
    </template>

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

.calendar-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
}
.month-nav {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.month-label {
  font-size: 16px;
  font-weight: 600;
  text-transform: capitalize;
  text-align: center;
  white-space: nowrap;
}

.goal-card {
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.goal-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.goal-label {
  font-size: 13px;
  color: var(--ink-2);
  text-transform: capitalize;
}
.goal-value {
  font-family: var(--font-num);
  font-size: 18px;
  font-weight: 700;
  color: var(--ink-0);
  white-space: nowrap;
}
.goal-of {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-2);
  margin-left: 6px;
}
.goal-bar {
  height: 8px;
  border-radius: 5px;
  background: var(--bg-2);
  border: 1px solid var(--line);
  overflow: hidden;
}
.goal-bar-fill {
  height: 100%;
  background: var(--state-work-border);
  border-radius: 5px;
  transition: width 0.3s var(--ease);
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  width: 100%;
  min-width: 0;
}
.weekday-row span {
  font-size: 11px;
  color: var(--ink-3);
  text-align: center;
  min-width: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.cell {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
  aspect-ratio: 1 / 0.82;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-soft);
  background: var(--surface-rest);
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
  transition: border-color 0.15s var(--ease), background 0.15s var(--ease);
}
.cell:focus-visible {
  outline: 2px solid var(--ink-0);
  outline-offset: 1px;
}
.cell:hover {
  border-color: var(--ink-2);
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
  border-color: var(--state-rest-border);
}
.cell.unset {
  background: var(--bg-2);
  color: var(--ink-2);
  border-color: var(--line);
}
.cell.unset .cell-day {
  color: var(--ink-1);
}
.cell.overridden {
  border-style: dashed;
  border-color: var(--line-strong);
}
.cell.today {
  box-shadow: 0 0 0 1.5px var(--surface-today-ring) inset;
}

.cell-day {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-0);
}
.cell-marker {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 10px;
  color: var(--ink-0);
}
.cell-readout {
  font-size: 10.5px;
  color: inherit;
  display: flex;
  gap: 4px;
  opacity: 0.85;
  min-width: 0;
  max-width: 100%;
  flex-wrap: wrap;
}
.cell-readout span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.cell.work .cell-readout {
  color: inherit;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  row-gap: 8px;
  font-size: 12px;
  color: var(--ink-2);
  margin-top: var(--space-3);
}
.legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
  border: 1px solid var(--line);
}
.swatch.work {
  background: var(--state-work-bg);
  border-color: var(--state-work-border);
}
.swatch.rest {
  background: var(--state-rest-bg);
  border-color: var(--state-rest-border);
}
.swatch.unset {
  background: var(--bg-2);
  border-color: var(--line);
}
.swatch.marker {
  border: none;
  font-style: normal;
  color: var(--ink-1);
  width: auto;
  height: auto;
}

.empty-hint {
  padding: var(--space-5);
  color: var(--ink-2);
  text-align: center;
}

@media (max-width: 640px) {
  .grid,
  .weekday-row {
    gap: 4px;
  }
  .cell {
    padding: 6px;
    border-radius: 4px;
  }
  .cell-day {
    font-size: 12px;
  }
  .cell-readout {
    font-size: 9px;
    flex-direction: column;
    gap: 0;
    line-height: 1.25;
  }
  .cell-readout span:first-child::after {
    content: '';
  }
  .legend {
    gap: var(--space-3);
    font-size: 11px;
    flex-wrap: wrap;
    row-gap: 6px;
  }
}

@media (max-width: 420px) {
  .goal-card {
    padding: var(--space-3) var(--space-4);
  }
  .goal-value {
    font-size: 16px;
  }
  .calendar-toolbar {
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .month-nav {
    order: 1;
    width: 100%;
    justify-content: space-between;
  }
  .month-label {
    min-width: 0;
    font-size: 14px;
  }
  .calendar-toolbar > .btn {
    order: 2;
  }
  .weekday-row span {
    font-size: 10px;
  }
  .cell {
    padding: 4px 5px;
  }
  .cell-day {
    font-size: 11px;
  }
  .cell-marker {
    top: 4px;
    right: 5px;
    font-size: 9px;
  }
  .cell-readout {
    font-size: 8px;
  }
}

@media (max-width: 340px) {
  .grid,
  .weekday-row {
    gap: 3px;
  }
  .cell {
    padding: 3px 4px;
  }
}
</style>
