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
const isLogged = computed(() => !!(shift.value && shift.value.start_time && shift.value.end_time));
// Same rule as the calendar grid: a scheduled work day only reads as
// "confirmed" once hours are actually logged for it.
const displayStatus = computed(() => {
  if (effectiveType.value !== 'work') return effectiveType.value;
  return isLogged.value ? 'work' : 'pending';
});

const overrideNote = ref(override.value?.note || '');
const startTime = ref(shift.value?.start_time || '');
const endTime = ref(shift.value?.end_time || '');
const tradein = ref(shift.value?.tradein_count ?? 0);
const novaPoshta = ref(shift.value?.nova_poshta_count ?? 0);
const shiftNote = ref(shift.value?.note || '');
const saving = ref(false);

const tradeinRate = computed(() => schedule.settings?.tradein_rate ?? 20);
const novaPoshtaRate = computed(() => schedule.settings?.nova_poshta_rate ?? 50);
const tradeinValue = computed(() => (Number(tradein.value) || 0) * tradeinRate.value);
const novaPoshtaValue = computed(() => (Number(novaPoshta.value) || 0) * novaPoshtaRate.value);
const totalValue = computed(() => Math.round((tradeinValue.value + novaPoshtaValue.value) * 100) / 100);

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
      nova_poshta_count: Number(novaPoshta.value) || 0,
      note: shiftNote.value || null
    });
  } finally {
    saving.value = false;
  }
}

let autosaveTimer = null;
function autosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveShift, 400);
}

function bump(field, delta) {
  if (field === 'tradein') {
    tradein.value = Math.max(0, (Number(tradein.value) || 0) + delta);
  } else {
    novaPoshta.value = Math.max(0, (Number(novaPoshta.value) || 0) + delta);
  }
  autosave();
}

function closeModal() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
    saveShift();
  }
  emit('close');
}

async function deleteShift() {
  await shifts.remove(props.date);
  startTime.value = '';
  endTime.value = '';
  tradein.value = 0;
  novaPoshta.value = 0;
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
    novaPoshta.value = shift.value?.nova_poshta_count ?? 0;
    shiftNote.value = shift.value?.note || '';
  }
);
</script>

<template>
  <div class="overlay" @click.self="closeModal">
    <div class="modal card">
      <div class="modal-head">
        <div>
          <div class="modal-date">{{ prettyDate }}</div>
          <div class="modal-type" :class="displayStatus">
            {{
              effectiveType === 'work'
                ? (isLogged ? 'Робочий день · відпрацьовано' : 'Робочий день · очікує годин')
                : effectiveType === 'rest'
                ? 'Вихідний'
                : 'Графік не встановлено'
            }}
            <span v-if="override" class="override-tag">заміна</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" @click="closeModal">Закрити</button>
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

        <div class="tradein-row">
          <div class="field">
            <label for="tradein">Трейд-ін <span class="rate-hint">({{ tradeinRate }}₴/шт)</span></label>
            <div class="counter">
              <button type="button" class="counter-btn" @click="bump('tradein', -1)" aria-label="Мінус один">−</button>
              <input
                id="tradein"
                class="input counter-input"
                type="number"
                min="0"
                inputmode="numeric"
                v-model="tradein"
                @change="autosave"
              />
              <button type="button" class="counter-btn counter-btn-plus" @click="bump('tradein', 1)" aria-label="Плюс один">
                +
              </button>
            </div>
          </div>
          <div class="field">
            <label for="nova-poshta">Трейд-ін Нова Пошта <span class="rate-hint">({{ novaPoshtaRate }}₴/шт)</span></label>
            <div class="counter">
              <button type="button" class="counter-btn" @click="bump('novaPoshta', -1)" aria-label="Мінус один">−</button>
              <input
                id="nova-poshta"
                class="input counter-input"
                type="number"
                min="0"
                inputmode="numeric"
                v-model="novaPoshta"
                @change="autosave"
              />
              <button
                type="button"
                class="counter-btn counter-btn-plus"
                @click="bump('novaPoshta', 1)"
                aria-label="Плюс один"
              >
                +
              </button>
            </div>
          </div>
        </div>
        <div class="value-readout" v-if="tradein > 0 || novaPoshta > 0">
          Разом за товар: <strong>{{ totalValue }}₴</strong>
          <span v-if="saving" class="autosave-hint">· зберігаю…</span>
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
.modal-type.pending,
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
.tradein-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-top: var(--space-3);
}
.rate-hint {
  color: var(--ink-3);
  font-weight: 400;
}
.value-readout {
  margin-top: var(--space-2);
  font-size: 13px;
  color: var(--ink-1);
}
.value-readout strong {
  font-family: var(--font-num);
  color: var(--state-work-text);
}
.autosave-hint {
  color: var(--ink-3);
  font-size: 12px;
}
.counter {
  display: flex;
  align-items: stretch;
  gap: 6px;
}
.counter-btn {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong);
  background: var(--bg-2);
  color: var(--ink-0);
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s var(--ease), border-color 0.12s var(--ease), transform 0.08s var(--ease);
}
.counter-btn:active {
  transform: scale(0.94);
}
.counter-btn:hover {
  background: var(--bg-3);
  border-color: var(--ink-2);
}
.counter-btn-plus {
  background: var(--state-work-bg);
  border-color: var(--state-work-border);
  color: var(--state-work-text);
}
.counter-btn-plus:hover {
  background: var(--state-work-border);
  color: var(--bg-0);
}
.counter-input {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  padding: 9px 4px;
}
/* Hide native number spinners — the +/- buttons replace them */
.counter-input::-webkit-outer-spin-button,
.counter-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.counter-input[type='number'] {
  -moz-appearance: textfield;
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
  .tradein-row {
    grid-template-columns: 1fr;
  }
  .modal-actions {
    flex-direction: column;
  }
}
</style>
