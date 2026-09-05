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
  return { key, ...info, shift, isToday };
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
      <div class="weekday-row">
        <span v-for="w in weekdayLabels" :key="w">{{ w }}</span>
      </div>

      <div class="grid">
        <template v-for="(row, ri) in weeks" :key="ri">
          <button
            v-for="(date, ci) in row"
            :key="ci"
            class="cell"
            :class="[
              date ? cellInfo(date).type : 'blank',
              { today: date && cellInfo(date).isToday, overridden: date && cellInfo(date).overridden }
            ]"
            :disabled="!date"
            @click="date && (openDate = cellInfo(date).key)"
          >
            <template v-if="date">
              <span class="cell-day">{{ date.getDate() }}</span>
              <span v-if="cellInfo(date).overridden" class="cell-marker" title="Заміна графіка">◇</span>
              <span v-if="cellInfo(date).shift" class="cell-readout">
                <span v-if="cellInfo(date).shift.total_hours">{{ cellInfo(date).shift.total_hours }}г</span>
                <span v-if="cellInfo(date).shift.tradein_count">· {{ cellInfo(date).shift.tradein_count }}шт</span>
              </span>
            </template>
          </button>
        </template>
      </div>

      <div class="legend">
        <span><i class="swatch work"></i> робочий</span>
        <span><i class="swatch rest"></i> вихідний</span>
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
}

.calendar-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.month-nav {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.month-label {
  font-size: 16px;
  font-weight: 600;
  text-transform: capitalize;
  min-width: 160px;
  text-align: center;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  padding: 0 2px;
}
.weekday-row span {
  font-size: 11px;
  color: var(--ink-3);
  text-align: center;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.cell {
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
  font-family: var(--font-num);
  position: relative;
  transition: border-color 0.15s var(--ease), background 0.15s var(--ease);
}
.cell:hover {
  border-color: var(--ink-2);
}
.cell.blank {
  visibility: hidden;
  cursor: default;
}
.cell.work {
  background: var(--surface-work);
  color: var(--ink-0);
  border-color: var(--line);
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
}
.cell-marker {
  position: absolute;
  top: 6px;
  right: 8px;
  font-size: 10px;
  color: var(--ink-1);
}
.cell-readout {
  font-size: 10.5px;
  color: var(--ink-2);
  display: flex;
  gap: 4px;
}
.cell.work .cell-readout {
  color: var(--ink-1);
}

.legend {
  display: flex;
  gap: var(--space-5);
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
  border-radius: 3px;
  display: inline-block;
  border: 1px solid var(--line);
}
.swatch.work {
  background: var(--surface-work);
}
.swatch.rest {
  background: var(--surface-rest);
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
  .cell-day {
    font-size: 12px;
  }
  .cell-readout {
    font-size: 9px;
  }
}
</style>
