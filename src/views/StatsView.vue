<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../lib/api.js';
import { dateKey } from '../lib/scheduleEngine.js';

const period = ref('month'); // month | prev-month | year | all
const stats = ref(null);
const loading = ref(false);

const periods = [
  { id: 'month', label: 'Місяць' },
  { id: 'prev-month', label: 'Минулий' },
  { id: 'year', label: 'Рік' },
  { id: 'all', label: 'Усе' }
];

function rangeFor(p) {
  const now = new Date();
  if (p === 'month') {
    return {
      from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    };
  }
  if (p === 'prev-month') {
    return {
      from: dateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: dateKey(new Date(now.getFullYear(), now.getMonth(), 0))
    };
  }
  if (p === 'year') {
    return { from: dateKey(new Date(now.getFullYear(), 0, 1)), to: dateKey(new Date(now.getFullYear(), 11, 31)) };
  }
  return { from: '0000-01-01', to: '9999-12-31' };
}

async function load() {
  loading.value = true;
  try {
    const { from, to } = rangeFor(period.value);
    const res = await api.getStats(from, to);
    stats.value = res.stats;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(period, load);

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n) => Math.round(Number(n) || 0).toLocaleString('uk-UA');
const avgHours = computed(() => (stats.value ? round2(stats.value.avg_hours) : 0));
const itemsValue = computed(() =>
  stats.value ? stats.value.tradein_value + stats.value.nova_poshta_value + stats.value.regular_value : 0
);
</script>

<template>
  <div class="stats-page">
    <div class="segmented" role="tablist">
      <button
        v-for="p in periods"
        :key="p.id"
        role="tab"
        :aria-selected="period === p.id"
        :class="{ active: period === p.id }"
        @click="period = p.id"
      >
        {{ p.label }}
      </button>
    </div>

    <template v-if="stats">
      <div class="hero card" :class="{ loading }">
        <span class="hero-label">Заробіток за період</span>
        <span class="hero-value">{{ money(stats.total_value) }} ₴</span>
        <div class="hero-split">
          <span>години <b>{{ money(stats.hours_value) }} ₴</b></span>
          <span>товар <b>{{ money(itemsValue) }} ₴</b></span>
        </div>
      </div>

      <p class="panel-title group-title">Робота</p>
      <div class="stat-grid" :class="{ loading }">
        <div class="stat card">
          <span class="stat-label">Змін</span>
          <span class="stat-value">{{ stats.shift_count }}</span>
        </div>
        <div class="stat card">
          <span class="stat-label">Годин</span>
          <span class="stat-value">{{ round2(stats.total_hours) }}</span>
        </div>
        <div class="stat card">
          <span class="stat-label">Середня зміна</span>
          <span class="stat-value">{{ avgHours }}<span class="stat-unit">год</span></span>
        </div>
      </div>

      <p class="panel-title group-title">Товар</p>
      <div class="stat-grid" :class="{ loading }">
        <div class="stat card">
          <span class="stat-label">Трейд-ін</span>
          <span class="stat-value">{{ stats.total_tradein }}<span class="stat-unit">шт</span></span>
          <span class="stat-sub">{{ money(stats.tradein_value) }} ₴</span>
        </div>
        <div class="stat card">
          <span class="stat-label">Нова Пошта</span>
          <span class="stat-value">{{ stats.total_nova_poshta }}<span class="stat-unit">шт</span></span>
          <span class="stat-sub">{{ money(stats.nova_poshta_value) }} ₴</span>
        </div>
        <div class="stat card">
          <span class="stat-label">Заявки</span>
          <span class="stat-value">{{ stats.total_regular }}<span class="stat-unit">шт</span></span>
          <span class="stat-sub">{{ money(stats.regular_value) }} ₴</span>
        </div>
      </div>
    </template>
    <div v-else class="card empty-hint">Завантаження…</div>
  </div>
</template>

<style scoped>
.stats-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 720px;
  margin: 0 auto;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  padding: 4px;
  background: var(--glass-1);
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
}
.segmented button {
  min-height: 40px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-2);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}
.segmented button.active {
  background: var(--solid);
  color: var(--on-solid);
}

.hero {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--glass-2);
}
.hero-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.hero-value {
  font-size: 44px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
}
.hero-split {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.hero-split span {
  background: var(--glass-2);
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  padding: 4px 12px;
}
.hero-split b {
  color: var(--text);
  font-weight: 800;
}

.group-title {
  margin: var(--space-3) 0 calc(-1 * var(--space-1)) 4px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}
.loading {
  opacity: 0.55;
  transition: opacity 0.15s var(--ease);
}
.stat {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.stat-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.stat-value {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.stat-unit {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
  margin-left: 4px;
}
.stat-sub {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
}
.empty-hint {
  padding: var(--space-5);
  color: var(--text-2);
  text-align: center;
}

@media (max-width: 480px) {
  .segmented button {
    font-size: 13px;
  }
  .hero {
    padding: var(--space-4);
  }
  .hero-value {
    font-size: 36px;
  }
  .stat-grid {
    gap: 8px;
  }
  .stat {
    padding: var(--space-3);
  }
  .stat-value {
    font-size: 21px;
  }
  .stat-label {
    font-size: 12px;
  }
}
</style>
