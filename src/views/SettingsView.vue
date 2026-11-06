<script setup>
import { ref, watch, onMounted } from 'vue';
import { useScheduleStore } from '../stores/schedule.js';
import { WEEKDAYS, parseRestWeekdays } from '../lib/scheduleEngine.js';
import AccountPanel from '../components/AccountPanel.vue';

import { parseBonusRules, REQUEST_TYPES } from '../lib/earnings.js';
const schedule = useScheduleStore();
const wholesaleRate = ref(10);
const bonusRules = ref([]);
const widgetUrl = new URL('/widget', window.location.origin).href;

const restWeekdays = ref([0, 1]);
const monthlyGoal = ref(200);
const tradeinRate = ref(20);
const novaPoshtaRate = ref(50);
const regularRate = ref(10);
const hourlyRate = ref(95);
const saving = ref(false);

onMounted(async () => {
  if (!schedule.loaded) await schedule.load();
  syncFromStore();
});

function syncFromStore() {
  if (!schedule.settings) return;
  restWeekdays.value = parseRestWeekdays(schedule.settings.rest_weekdays);
  monthlyGoal.value = schedule.settings.monthly_hours_goal ?? 200;
  tradeinRate.value = schedule.settings.tradein_rate ?? 20;
  novaPoshtaRate.value = schedule.settings.nova_poshta_rate ?? 50;
  regularRate.value = schedule.settings.regular_rate ?? 10;
  wholesaleRate.value = schedule.settings.wholesale_rate ?? 10;
  bonusRules.value = parseBonusRules(schedule.settings.bonus_rules);
  hourlyRate.value = schedule.settings.hourly_rate ?? 95;
}

watch(() => schedule.settings, syncFromStore);

function toggleRestDay(idx) {
  const set = new Set(restWeekdays.value);
  if (set.has(idx)) set.delete(idx);
  else set.add(idx);
  restWeekdays.value = [...set].sort();
}

async function save() {
  saving.value = true;
  try {
    await schedule.updateSettings({
      rest_weekdays: restWeekdays.value,
      monthly_hours_goal: Number(monthlyGoal.value),
      tradein_rate: Number(tradeinRate.value),
      nova_poshta_rate: Number(novaPoshtaRate.value),
      regular_rate: Number(regularRate.value),
      wholesale_rate: Number(wholesaleRate.value),
      bonus_rules: bonusRules.value,
      hourly_rate: Number(hourlyRate.value)
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="settings-page" @submit.prevent="save">
    <section class="card panel">
      <p class="panel-title">Вихідні дні</p>
      <p class="panel-hint">
        Позначені дні щотижня йдуть як вихідні, решта як робочі. Якщо треба підмінити напарника, тисни на день
        у календарі і міняй його вручну.
      </p>
      <div class="weekday-picker" role="group" aria-label="Вихідні дні тижня">
        <button
          v-for="w in WEEKDAYS"
          :key="w.idx"
          type="button"
          class="weekday-chip"
          :class="{ rest: restWeekdays.includes(w.idx) }"
          :aria-pressed="restWeekdays.includes(w.idx)"
          :title="w.long"
          @click="toggleRestDay(w.idx)"
        >
          {{ w.short }}
        </button>
      </div>
    </section>

    <section class="card panel">
      <p class="panel-title">Години й оплата</p>
      <div class="row">
        <div class="field">
          <label for="goal">Ціль, год/місяць</label>
          <input id="goal" class="input" type="number" min="1" step="1" inputmode="numeric" v-model="monthlyGoal" />
        </div>
        <div class="field">
          <label for="hourly-rate">Ставка, ₴/год</label>
          <input id="hourly-rate" class="input" type="number" min="0" step="0.01" inputmode="decimal" v-model="hourlyRate" />
        </div>
      </div>
    </section>

    <section class="card panel">
      <p class="panel-title">Оплата за товар</p>
      <p class="panel-hint">Скільки ₴ приносить одна одиниця кожного типу.</p>
      <div class="row row-3">
        <div class="field">
          <label for="tradein-rate">Трейд-ін</label>
          <input id="tradein-rate" class="input" type="number" min="0" step="0.01" inputmode="decimal" v-model="tradeinRate" />
        </div>
        <div class="field">
          <label for="nova-poshta-rate">Нова Пошта</label>
          <input
            id="nova-poshta-rate"
            class="input"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            v-model="novaPoshtaRate"
          />
        </div>
        <div class="field">
          <label for="regular-rate">Заявки</label>
          <input id="regular-rate" class="input" type="number" min="0" step="0.01" inputmode="decimal" v-model="regularRate" />
        </div>
      </div>
    </section>

    <section class="card panel">
      <p class="panel-title">Оптові заявки</p>
      <div class="field"><label for="wholesale-rate">₴ за заявку</label><input id="wholesale-rate" class="input" type="number" min="0" step="0.01" v-model.number="wholesaleRate" required /></div>
    </section>
    <section class="card panel">
      <p class="panel-title">Бонуси за місяць</p>
      <p class="panel-hint">Кожен бонус нараховується один раз за місяць після досягнення порога. Обрані типи заявок підсумовуються. Вкажи суму бонусу; 0 ₴ означає лише відстеження цілі. Зміни правил і ставок перераховують також минулі місяці.</p>
      <fieldset v-for="(rule, i) in bonusRules" :key="i" class="bonus-rule">
        <legend>Бонус {{ i + 1 }}</legend>
        <div class="field"><label :for="'bonus-name-'+i">Назва</label><input :id="'bonus-name-'+i" class="input" v-model="rule.name" maxlength="100" required /></div>
        <div class="row"><div class="field"><label :for="'bonus-threshold-'+i">Поріг, заявок</label><input :id="'bonus-threshold-'+i" class="input" type="number" min="1" step="1" v-model.number="rule.threshold" required /></div><div class="field"><label :for="'bonus-amount-'+i">Бонус, ₴</label><input :id="'bonus-amount-'+i" class="input" type="number" min="0" step="0.01" v-model.number="rule.amount" required /></div></div>
        <label v-for="(label, type) in REQUEST_TYPES" :key="type" class="bonus-type"><input type="checkbox" :value="type" v-model="rule.types" /> {{ label }}</label>
        <button type="button" class="btn btn-ghost" @click="bonusRules.splice(i, 1)">Видалити бонус</button>
      </fieldset>
      <button type="button" class="btn" @click="bonusRules.push({ name: 'Новий бонус', threshold: 500, amount: 0, types: ['tradein', 'regular'] })">+ Додати бонус</button>
    </section>
    <section class="card panel"><p class="panel-title">Віджет Vivaldi</p><p class="panel-hint">Додай цю адресу як віджет вебсторінки. Використовується твій вхід у Shiftly в цьому браузері.</p><a :href="widgetUrl" target="_blank" rel="noopener">{{ widgetUrl }}</a></section>
    <div class="save-bar">
      <button class="btn btn-primary btn-block" type="submit" :disabled="saving">
        {{ saving ? 'Зберігаю…' : 'Зберегти' }}
      </button>
    </div>
  </form>
  <AccountPanel />
</template>

<style scoped>
.bonus-rule { border: 1px solid var(--glass-border); border-radius: 12px; padding: 12px; margin: 12px 0; min-width: 0; }
.bonus-type { display: inline-flex; gap: 6px; margin: 12px 12px 12px 0; }
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 540px;
  margin: 0 auto;
}
.panel {
  padding: var(--space-5);
}
.panel-hint {
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.5;
  margin: 0 0 var(--space-4) 0;
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}
.row-3 {
  grid-template-columns: repeat(3, 1fr);
}

.weekday-picker {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.weekday-chip {
  height: 46px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--glass-2);
  color: var(--text-2);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s var(--ease), color 0.15s var(--ease), transform var(--press) var(--ease);
}
.weekday-chip:active {
  transform: scale(0.94);
}
/* Selected day off */
.weekday-chip.rest {
  background: var(--solid);
  border-color: var(--solid);
  color: var(--on-solid);
}

.save-bar {
  position: sticky;
  bottom: var(--space-4);
}
.save-bar .btn {
  min-height: 52px;
  font-size: 16px;
  border-radius: 999px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}

@media (max-width: 760px) {
  .save-bar {
    bottom: calc(var(--tabbar-h) + var(--tabbar-gap) + var(--safe-bottom) + var(--space-3));
  }
}

@media (max-width: 480px) {
  .panel {
    padding: var(--space-4);
  }
  .row-3 {
    grid-template-columns: 1fr 1fr;
  }
  .row-3 .field:last-child {
    grid-column: 1 / -1;
  }
  .weekday-picker {
    gap: 5px;
  }
  .weekday-chip {
    height: 44px;
    font-size: 13px;
  }
}
</style>
