<script setup>
import { ref, watch, onMounted } from 'vue';
import { useScheduleStore } from '../stores/schedule.js';

const schedule = useScheduleStore();

const workDays = ref(5);
const restDays = ref(2);
const anchorDate = ref('');
const monthlyGoal = ref(200);
const tradeinRate = ref(20);
const novaPoshtaRate = ref(50);
const regularRate = ref(10);
const saving = ref(false);

onMounted(async () => {
  if (!schedule.loaded) await schedule.load();
  syncFromStore();
});

function syncFromStore() {
  if (!schedule.settings) return;
  workDays.value = schedule.settings.work_days;
  restDays.value = schedule.settings.rest_days;
  anchorDate.value = schedule.settings.anchor_date;
  monthlyGoal.value = schedule.settings.monthly_hours_goal ?? 200;
  tradeinRate.value = schedule.settings.tradein_rate ?? 20;
  novaPoshtaRate.value = schedule.settings.nova_poshta_rate ?? 50;
  regularRate.value = schedule.settings.regular_rate ?? 10;
}

watch(() => schedule.settings, syncFromStore);

async function save() {
  saving.value = true;
  try {
    await schedule.updateSettings({
      work_days: Number(workDays.value),
      rest_days: Number(restDays.value),
      anchor_date: anchorDate.value,
      monthly_hours_goal: Number(monthlyGoal.value),
      tradein_rate: Number(tradeinRate.value),
      nova_poshta_rate: Number(novaPoshtaRate.value),
      regular_rate: Number(regularRate.value)
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="card panel">
      <p class="panel-title">Базовий цикл</p>
      <p class="panel-hint">
        Цикл повторюється безкінечно від опорної дати. Наприклад, 5 робочих і 2 вихідних — це класичний графік
        5/2. Окремі дні можна замінити вручну прямо в календарі — для підміни напарника чи інших виключень.
      </p>

      <div class="row">
        <div class="field">
          <label for="work">Робочих днів поспіль</label>
          <input id="work" class="input" type="number" min="1" max="30" v-model="workDays" />
        </div>
        <div class="field">
          <label for="rest">Вихідних днів поспіль</label>
          <input id="rest" class="input" type="number" min="1" max="30" v-model="restDays" />
        </div>
      </div>

      <div class="field" style="margin-top: var(--space-4)">
        <label for="anchor">Опорна дата (перший робочий день циклу)</label>
        <input id="anchor" class="input" type="date" v-model="anchorDate" />
      </div>

      <button class="btn btn-primary" style="margin-top: var(--space-5)" :disabled="saving" @click="save">
        Зберегти
      </button>
    </div>

    <div class="card panel">
      <p class="panel-title">Ціль по годинах</p>
      <p class="panel-hint">Скільки годин на місяць — орієнтир для прогрес-бару на головній сторінці.</p>
      <div class="field">
        <label for="goal">Годин на місяць</label>
        <input id="goal" class="input" type="number" min="1" step="1" v-model="monthlyGoal" />
      </div>
      <button class="btn btn-primary" style="margin-top: var(--space-4)" :disabled="saving" @click="save">
        Зберегти
      </button>
    </div>

    <div class="card panel">
      <p class="panel-title">Оцінка товару</p>
      <p class="panel-hint">Скільки коштує одна заявка кожного типу — використовується для розрахунку суми за зміну.</p>
      <div class="row row-3">
        <div class="field">
          <label for="tradein-rate">Трейд-ін, ₴/шт</label>
          <input id="tradein-rate" class="input" type="number" min="0" step="0.01" v-model="tradeinRate" />
        </div>
        <div class="field">
          <label for="nova-poshta-rate">Трейд-ін Нова Пошта, ₴/шт</label>
          <input id="nova-poshta-rate" class="input" type="number" min="0" step="0.01" v-model="novaPoshtaRate" />
        </div>
        <div class="field">
          <label for="regular-rate">Заявки, ₴/шт</label>
          <input id="regular-rate" class="input" type="number" min="0" step="0.01" v-model="regularRate" />
        </div>
      </div>
      <button class="btn btn-primary" style="margin-top: var(--space-4)" :disabled="saving" @click="save">
        Зберегти
      </button>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 480px;
}
.panel {
  padding: var(--space-5);
}
.panel-hint {
  font-size: 13px;
  color: var(--ink-2);
  line-height: 1.5;
  margin: 0 0 var(--space-4) 0;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.row-3 {
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
}

@media (max-width: 420px) {
  .row,
  .row-3 {
    grid-template-columns: 1fr;
  }
  .panel {
    padding: var(--space-4);
  }
}
</style>
