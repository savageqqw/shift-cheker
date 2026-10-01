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
  background: var(--bg-1);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-sm);
}
.segmented button {
  min-height: 38px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}
.segmented button.active {
  background: var(--bg-3);
  color: var(--ink-0);
}

.hero {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.12), rgba(74, 222, 128, 0.02)), var(--bg-1);
  border-color: rgba(74, 222, 128, 0.2);
}
.hero-label {
  font-size: 13px;
  color: var(--ink-2);
}
.hero-value {
  font-family: var(--font-num);
  font-size: 36px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
}
.hero-split {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  font-size: 13px;
  color: var(--ink-2);
}
.hero-split b {
  font-family: var(--font-num);
  color: var(--ink-0);
  font-weight: 600;
}

.group-title {
  margin: var(--space-2) 0 calc(-1 * var(--space-2));
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
  font-size: 12px;
  color: var(--ink-2);
}
.stat-value {
  font-family: var(--font-num);
  font-size: 26px;
  font-weight: 700;
  color: var(--ink-0);
}
.stat-unit {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-2);
  margin-left: 4px;
}
.stat-sub {
  font-family: var(--font-num);
  font-size: 12.5px;
  color: var(--state-work-text);
}
.empty-hint {
  padding: var(--space-5);
  color: var(--ink-2);
  text-align: center;
}

@media (max-width: 480px) {
  .hero {
    padding: var(--space-4);
  }
  .hero-value {
    font-size: 30px;
  }
  .stat-grid {
    gap: var(--space-2);
  }
  .stat {
    padding: var(--space-3);
  }
  .stat-value {
    font-size: 20px;
  }
  .stat-label {
    font-size: 11.5px;
  }
}
</style>
