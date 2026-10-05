<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
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
const regular = ref(shift.value?.regular_count ?? 0);
const shiftNote = ref(shift.value?.note || '');
const saving = ref(false);

const tradeinRate = computed(() => schedule.settings?.tradein_rate ?? 20);
const novaPoshtaRate = computed(() => schedule.settings?.nova_poshta_rate ?? 50);
const regularRate = computed(() => schedule.settings?.regular_rate ?? 10);
const hourlyRate = computed(() => schedule.settings?.hourly_rate ?? 95);
const tradeinValue = computed(() => (Number(tradein.value) || 0) * tradeinRate.value);
const novaPoshtaValue = computed(() => (Number(novaPoshta.value) || 0) * novaPoshtaRate.value);
const regularValue = computed(() => (Number(regular.value) || 0) * regularRate.value);
const hoursValue = computed(() => Math.round((computedHours.value || 0) * hourlyRate.value * 100) / 100);
const itemsValue = computed(() => tradeinValue.value + novaPoshtaValue.value + regularValue.value);
const totalValue = computed(() => Math.round((itemsValue.value + hoursValue.value) * 100) / 100);

const counters = computed(() => [
  { field: 'tradein', id: 'tradein', label: 'Трейд-ін', rate: tradeinRate.value, model: tradein },
  { field: 'novaPoshta', id: 'nova-poshta', label: 'Нова Пошта', rate: novaPoshtaRate.value, model: novaPoshta },
  { field: 'regular', id: 'regular', label: 'Заявки', rate: regularRate.value, model: regular }
]);

const prettyDate = computed(() => {
  const d = new Date(props.date + 'T00:00:00');
  return d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
});

const statusText = computed(() => {
  if (effectiveType.value === 'rest') return 'Вихідний';
  return isLogged.value ? 'Робочий · відпрацьовано' : 'Робочий · години не внесено';
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

// Editing the comment on an existing swap should stick without re-toggling.
function saveOverrideNote() {
  if (override.value && overrideNote.value !== (override.value.note || '')) {
    schedule.setOverride(props.date, override.value.is_working, overrideNote.value);
  }
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
      regular_count: Number(regular.value) || 0,
      note: shiftNote.value || null
    });
  } finally {
    saving.value = false;
  }
}

let autosaveTimer = null;
function autosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    saveShift();
  }, 500);
}

function bump(c, delta) {
  c.model.value = Math.max(0, (Number(c.model.value) || 0) + delta);
  if (navigator.vibrate) navigator.vibrate(8);
  autosave();
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function setNow(which) {
  if (which === 'start') startTime.value = nowHHMM();
  else endTime.value = nowHHMM();
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
  if (!confirm('Видалити запис за цей день?')) return;
  await shifts.remove(props.date);
  startTime.value = '';
  endTime.value = '';
  tradein.value = 0;
  novaPoshta.value = 0;
  regular.value = 0;
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
    regular.value = shift.value?.regular_count ?? 0;
    shiftNote.value = shift.value?.note || '';
  }
);

function onKey(e) {
  if (e.key === 'Escape') closeModal();
}
onMounted(() => {
  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="overlay" @click.self="closeModal">
    <div class="modal" role="dialog" aria-modal="true" :aria-label="prettyDate">
      <div class="grabber" @click="closeModal"></div>
      <div class="modal-head">
        <div class="modal-head-text">
          <div class="modal-date">{{ prettyDate }}</div>
          <div class="modal-type" :class="displayStatus">
            <span class="status-text">{{ statusText }}</span>
            <span v-if="override" class="override-tag">заміна</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-icon close-btn" @click="closeModal" aria-label="Закрити">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <section class="modal-section" v-if="effectiveType === 'work'">
          <div class="time-row">
            <div class="field">
              <label for="start">Початок</label>
              <input id="start" class="input" type="time" v-model="startTime" @change="autosave" />
              <button type="button" class="now-btn" @click="setNow('start')">зараз</button>
            </div>
            <div class="field">
              <label for="end">Кінець</label>
              <input id="end" class="input" type="time" v-model="endTime" @change="autosave" />
              <button type="button" class="now-btn" @click="setNow('end')">зараз</button>
            </div>
          </div>
          <div class="hours-readout">
            <span>{{ computedHours !== null ? computedHours + ' год' : 'Вкажи час початку й кінця' }}</span>
            <span v-if="computedHours" class="hours-money">{{ hoursValue }}₴</span>
          </div>

          <div class="counters">
            <div class="counter-row" v-for="c in counters" :key="c.field">
              <label :for="c.id" class="counter-label">
                {{ c.label }}
                <span class="rate-hint">{{ c.rate }}₴/шт</span>
              </label>
              <div class="counter">
                <button type="button" class="counter-btn" @click="bump(c, -1)" aria-label="Мінус один">−</button>
                <input
                  :id="c.id"
                  class="input counter-input"
                  type="number"
                  min="0"
                  inputmode="numeric"
                  v-model="c.model.value"
                  @change="autosave"
                />
                <button type="button" class="counter-btn counter-btn-plus" @click="bump(c, 1)" aria-label="Плюс один">
                  +
                </button>
              </div>
            </div>
          </div>

          <div class="field">
            <label for="shift-note">Нотатка</label>
            <input id="shift-note" class="input" v-model="shiftNote" placeholder="необовʼязково" @change="autosave" />
          </div>
        </section>

        <section class="modal-section swap">
          <p class="panel-title">Заміна з напарником</p>
          <div class="swap-row">
            <button class="btn btn-sm" @click="toggleOverride">
              {{ effectiveType === 'work' ? 'Зробити вихідним' : 'Зробити робочим' }}
            </button>
            <button v-if="override" class="btn btn-ghost btn-sm" @click="clearOverride">Повернути як було</button>
          </div>
          <div class="field">
            <label for="override-note">Коментар (напр. «підміняю Ігоря»)</label>
            <input
              id="override-note"
              class="input"
              v-model="overrideNote"
              placeholder="необовʼязково"
              @change="saveOverrideNote"
            />
          </div>
        </section>
      </div>

      <div class="modal-foot" v-if="effectiveType === 'work'">
        <div class="total">
          <span class="total-label">За зміну<span v-if="saving" class="autosave-hint"> · зберігаю…</span></span>
          <span class="total-value">{{ totalValue }}₴</span>
        </div>
        <div class="foot-actions">
          <button v-if="shift" class="btn btn-danger btn-icon" @click="deleteShift" aria-label="Видалити запис">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
          <button class="btn btn-primary" @click="closeModal">Готово</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 17, 17, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--space-4);
  animation: fade-in 0.15s var(--ease);
}
.modal {
  width: 100%;
  max-width: 460px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--paper);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.grabber {
  display: none;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: var(--bw) solid var(--ink);
  background: var(--card);
}
.modal-head-text {
  min-width: 0;
}
.modal-date {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 800;
  line-height: 1.2;
}
.modal-date::first-letter {
  text-transform: uppercase;
}
.modal-type {
  --chip: var(--card);
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 13px;
  font-weight: 800;
}
.modal-type.work {
  --chip: var(--teal);
}
.modal-type.rest {
  --chip: var(--coral);
}
.override-tag {
  border: var(--bw-sm) solid var(--ink);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 12px;
  background: var(--yellow);
}
.status-text {
  border: var(--bw-sm) solid var(--ink);
  border-radius: 999px;
  padding: 2px 10px;
  background: var(--chip);
}
.close-btn {
  margin: -4px -6px 0 0;
  font-size: 18px;
  font-weight: 800;
}

.modal-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.modal-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.modal-section.swap {
  padding: var(--space-4);
  border: var(--bw-sm) dashed var(--ink);
  border-radius: var(--radius-md);
  background: var(--sunk);
}
.modal-section.swap .panel-title {
  margin: 0;
}
.swap-row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.time-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.now-btn {
  align-self: flex-start;
  background: var(--card);
  border: var(--bw-sm) solid var(--ink);
  border-radius: 999px;
  padding: 3px 10px;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  min-height: 28px;
}
.now-btn:active {
  background: var(--yellow);
}
.hours-readout {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  font-size: 15px;
  font-weight: 800;
  padding: 10px 14px;
  background: var(--card);
  border: var(--bw-sm) solid var(--ink);
  border-radius: var(--radius-sm);
}
.hours-money {
  background: var(--teal);
  border: var(--bw-sm) solid var(--ink);
  border-radius: 4px;
  padding: 0 6px;
}

.counters {
  display: flex;
  flex-direction: column;
  background: var(--card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow);
  padding: 0 14px;
}
.counter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 10px 0;
}
.counter-row + .counter-row {
  border-top: var(--bw-sm) dashed var(--ink);
}
.counter-label {
  display: flex;
  flex-direction: column;
  font-size: 15px;
  font-weight: 800;
  min-width: 0;
}
.rate-hint {
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 700;
}
.counter {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
.counter-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  border: var(--bw-sm) solid var(--ink);
  box-shadow: var(--shadow-sm);
  background: var(--card);
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--press) var(--ease), box-shadow var(--press) var(--ease);
}
.counter-btn:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}
.counter-btn-plus {
  background: var(--yellow);
}
.counter-input {
  width: 54px;
  min-height: 44px;
  text-align: center;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 800;
  padding: 4px 2px;
  background: transparent;
  border-color: transparent;
}
.counter-input:focus {
  border-color: var(--ink);
}
/* Hide native number spinners; the +/- buttons replace them */
.counter-input::-webkit-outer-spin-button,
.counter-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.counter-input[type='number'] {
  -moz-appearance: textfield;
}

.modal-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-top: var(--bw) solid var(--ink);
  background: var(--yellow);
}
.total {
  display: flex;
  flex-direction: column;
}
.total-label {
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}
.total-value {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
}
.autosave-hint {
  font-weight: 600;
  text-transform: none;
}
.foot-actions {
  display: flex;
  gap: var(--space-2);
}
.foot-actions .btn-primary {
  min-width: 110px;
  background: var(--ink);
  color: var(--yellow);
  box-shadow: 2px 2px 0 var(--card);
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}
@keyframes sheet-up {
  from {
    transform: translateY(100%);
  }
}

@media (max-width: 560px) {
  .overlay {
    align-items: flex-end;
    padding: 0;
  }
  .modal {
    max-width: 100%;
    max-height: 92dvh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border-bottom: none;
    box-shadow: none;
    animation: sheet-up 0.25s var(--ease);
  }
  .grabber {
    display: block;
    width: 44px;
    height: 6px;
    border-radius: 999px;
    background: var(--ink);
    margin: 8px auto;
    flex: 0 0 auto;
    cursor: pointer;
  }
  .modal-head {
    padding: 0 var(--space-4) var(--space-3);
    border-top: none;
  }
  .modal-body {
    padding: var(--space-4);
  }
  .modal-foot {
    padding: var(--space-3) var(--space-4) calc(var(--space-3) + var(--safe-bottom));
  }
  .swap-row .btn {
    flex: 1;
  }
}
</style>
