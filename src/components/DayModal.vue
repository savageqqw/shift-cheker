<script setup>
import { ref, computed, watch } from 'vue';
import { useScheduleStore } from '../stores/schedule.js';
import { useShiftsStore } from '../stores/shifts.js';
import { baseDayType, effectiveDayType } from '../lib/scheduleEngine.js';

const props = defineProps({
  date: { type: String, required: true }
});
const emit = defineEmits(['close']);

const schedule = useScheduleStore();
const shifts = useShiftsStore();

const override = computed(() => schedule.overrides[props.date] || null);
const base = computed(() => baseDayType(props.date, schedule.settings));
const effectiveType = computed(() => effectiveDayType(props.date, schedule.settings, schedule.overrides).type);
const isUnset = computed(() => effectiveType.value === 'unset');
const shift = computed(() => shifts.byDate[props.date] || null);

const overrideNote = ref(override.value?.note || '');
const startTime = ref(shift.value?.start_time || '');
const endTime = ref(shift.value?.end_time || '');
const tradein = ref(shift.value?.tradein_count ?? 0);
const shiftNote = ref(shift.value?.note || '');
const saving = ref(false);

const prettyDate = computed(() => {
  const d = new Date(props.date + 'T00:00:00');
  return d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
});

function toggleOverride() {
  const nextWorking = effectiveType.value !== 'work';
  if (nextWorking === (base.value === 'work') && overrideNote.value === '') {
    // toggling back to the base pattern with no note — just clear override if one exists
    if (override.value) schedule.deleteOverride(props.date);
    return;
  }
  schedule.setOverride(props.date, nextWorking, overrideNote.value);
}

function clearOverride() {
  schedule.deleteOverride(props.date);
  overrideNote.value = '';
}

async function saveShift() {
  saving.value = true;
  try {
    await shifts.save(props.date, {
      start_time: startTime.value || null,
      end_time: endTime.value || null,
      tradein_count: Number(tradein.value) || 0,
      note: shiftNote.value || null
    });
  } finally {
    saving.value = false;
  }
}

async function deleteShift() {
  await shifts.remove(props.date);
  startTime.value = '';
  endTime.value = '';
  tradein.value = 0;
  shiftNote.value = '';
}

const computedHours = computed(() => {
  if (!startTime.value || !endTime.value) return null;
  const [sh, sm] = startTime.value.split(':').map(Number);
  const [eh, em] = endTime.value.split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
});

watch(
  () => props.date,
  () => {
    overrideNote.value = override.value?.note || '';
    startTime.value = shift.value?.start_time || '';
    endTime.value = shift.value?.end_time || '';
    tradein.value = shift.value?.tradein_count ?? 0;
    shiftNote.value = shift.value?.note || '';
  }
);
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal card">
      <div class="modal-head">
        <div>
          <div class="modal-date">{{ prettyDate }}</div>
          <div class="modal-type" :class="effectiveType">
            {{ effectiveType === 'work' ? 'Робочий день' : effectiveType === 'rest' ? 'Вихідний' : 'Графік не встановлено' }}
            <span v-if="override" class="override-tag">заміна</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="emit('close')">Закрити</button>
      </div>

      <section class="modal-section">
        <p class="panel-title">Заміна з напарником</p>
        <div class="swap-row">
          <button class="btn btn-sm" @click="toggleOverride">
            {{ effectiveType === 'work' ? 'Позначити вихідним' : 'Позначити робочим' }}
          </button>
          <button v-if="override" class="btn btn-ghost btn-sm" @click="clearOverride">Скинути до базового</button>
        </div>
        <div class="field" style="margin-top: var(--space-3)">
          <label for="override-note">Коментар (напр. «підміняю Ігоря»)</label>
          <input id="override-note" class="input" v-model="overrideNote" placeholder="необов'язково" />
        </div>
      </section>

      <section class="modal-section" v-if="effectiveType === 'work'">
        <p class="panel-title">Облік години</p>
        <div class="time-row">
          <div class="field">
            <label for="start">Початок</label>
            <input id="start" class="input" type="time" v-model="startTime" />
          </div>
          <div class="field">
            <label for="end">Кінець</label>
            <input id="end" class="input" type="time" v-model="endTime" />
          </div>
          <div class="field">
            <label>Разом</label>
            <div class="hours-readout">{{ computedHours !== null ? computedHours + ' год' : '—' }}</div>
          </div>
        </div>

        <div class="field" style="margin-top: var(--space-3)">
          <label for="tradein">Опрацьовано товару (трейд-ін), шт.</label>
          <input id="tradein" class="input" type="number" min="0" v-model="tradein" />
        </div>

        <div class="field" style="margin-top: var(--space-3)">
          <label for="shift-note">Нотатка</label>
          <input id="shift-note" class="input" v-model="shiftNote" placeholder="необов'язково" />
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary" :disabled="saving" @click="saveShift">Зберегти зміну</button>
          <button v-if="shift" class="btn btn-danger" @click="deleteShift">Видалити запис</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--space-4);
}
.modal {
  width: 100%;
  max-width: 420px;
  padding: var(--space-5);
  max-height: 88vh;
  overflow-y: auto;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--line-soft);
  margin-bottom: var(--space-4);
}
.modal-date {
  font-size: 15px;
  font-weight: 600;
  text-transform: capitalize;
}
.modal-type {
  font-size: 12px;
  color: var(--ink-2);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.modal-type.work {
  color: var(--state-work-text);
}
.modal-type.rest {
  color: var(--state-rest-text);
}
.modal-type.unset {
  color: var(--ink-2);
}
.override-tag {
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-sm);
  padding: 1px 6px;
  font-size: 10px;
  color: var(--ink-1);
}
.modal-section {
  margin-bottom: var(--space-5);
}
.swap-row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.time-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--space-3);
  align-items: end;
}
.hours-readout {
  font-family: var(--font-num);
  font-size: 14px;
  font-weight: 600;
  padding: 9px 11px;
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  white-space: nowrap;
}
.modal-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

@media (max-width: 480px) {
  .overlay {
    align-items: flex-end;
    padding: 0;
  }
  .modal {
    max-width: 100%;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    max-height: 92vh;
    padding: var(--space-4);
  }
  .time-row {
    grid-template-columns: 1fr 1fr;
    row-gap: var(--space-3);
  }
  .time-row .field:nth-child(3) {
    grid-column: 1 / -1;
  }
  .hours-readout {
    width: 100%;
    text-align: center;
  }
  .swap-row {
    flex-direction: column;
    align-items: stretch;
  }
  .modal-actions {
    flex-direction: column;
  }
}
</style>
