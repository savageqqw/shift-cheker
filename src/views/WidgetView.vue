<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { api } from '../lib/api.js';
import { dateKey } from '../lib/scheduleEngine.js';
import { parseBonusRules, summarize } from '../lib/earnings.js';
const stats = ref(null), settings = ref({}), error = ref(''), loading = ref(false), label = ref('');
const money = n => Number(n || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 });
let timer;
async function load() {
  if (loading.value) return;
  loading.value = true;
  try {
    const now = new Date();
    label.value = now.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    const [state, data] = await Promise.all([api.getScheduleState(), api.listShifts(dateKey(new Date(now.getFullYear(), now.getMonth(), 1)), dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)))]);
    settings.value = state.settings;
    stats.value = summarize(data.shifts, state.settings);
    if (!data.shifts.length) stats.value.bonuses = parseBonusRules(state.settings.bonus_rules).map(r => ({ ...r, count: 0, earned: false }));
    error.value = '';
  } catch (e) { error.value = e.status === 401 ? 'Увійди в Shiftly, щоб переглянути підсумок.' : 'Не вдалося оновити дані.'; }
  finally { loading.value = false; }
}
function refreshVisible() { if (!document.hidden) load(); }
onMounted(() => { load(); timer = setInterval(refreshVisible, 60000); window.addEventListener('focus', refreshVisible); document.addEventListener('visibilitychange', refreshVisible); });
onBeforeUnmount(() => { clearInterval(timer); window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible); });
</script>
<template>
  <main class="widget">
    <header><router-link to="/">Shiftly ↗</router-link><button class="btn btn-ghost btn-sm" @click="load" :disabled="loading" aria-label="Оновити">↻</button></header>
    <p class="month">{{ label }}</p>
    <div v-if="error" role="alert"><p>{{ error }}</p><router-link to="/login?redirect=/widget">Увійти</router-link></div>
    <template v-else-if="stats">
      <div class="earnings">{{ money(stats.total_value) }} <span>₴</span></div>
      <p class="muted">Зароблено за місяць</p>
      <div class="split"><span>Години <b>{{ money(stats.hours_value) }} ₴</b></span><span>Заявки <b>{{ money(stats.total_value - stats.hours_value - stats.bonus_value) }} ₴</b></span><span>Бонуси <b>{{ money(stats.bonus_value) }} ₴</b></span></div>
      <div class="hours"><b>{{ stats.total_hours }} / {{ settings.monthly_hours_goal }} год</b><span>{{ stats.shift_count }} змін</span></div>
      <progress :value="stats.total_hours" :max="settings.monthly_hours_goal || 200" aria-label="Місячна ціль годин"></progress>
      <div v-for="(b, i) in stats.bonuses" :key="i" class="bonus"><div><b>{{ b.name }}</b><span>{{ b.earned ? '+' + money(b.amount) + ' ₴ ✓' : b.count + ' / ' + b.threshold }}</span></div><progress :value="Math.min(b.count, b.threshold)" :max="b.threshold" :aria-label="b.name"></progress></div>
      <p class="muted foot">Оптові: {{ stats.total_wholesale }} · {{ money(stats.wholesale_value) }} ₴</p>
    </template>
    <p v-else>Завантаження…</p>
  </main>
</template>
<style scoped>
.widget { padding: 16px; max-width: 480px; margin: auto; font-size: 13px; }
header, .hours, .bonus>div { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
a { color: inherit; text-decoration: none; font-weight: 800; }
.month { text-transform: capitalize; color: var(--text-2); margin: 8px 0; }
.earnings { font-size: clamp(30px, 10vw, 48px); font-weight: 800; letter-spacing: -.04em; line-height: 1.15; overflow-wrap: anywhere; }
.earnings span { color: var(--text-3); }
.muted { color: var(--text-2); margin: 5px 0 12px; }
.split { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; padding: 12px 0; border-top: 1px solid var(--glass-border); }
.split span { color: var(--text-2); }.split b { display: block; color: var(--text); margin-top: 4px; }
.hours { margin-top: 4px; } progress { width: 100%; height: 6px; margin: 8px 0; accent-color: #ddd; }
.bonus { margin-top: 8px; }.foot { margin-bottom: 0; }
@media(max-width:280px) { .widget { padding: 10px; } .split { grid-template-columns: 1fr; }.split b { display: inline; margin-left: 6px; } }
</style>
