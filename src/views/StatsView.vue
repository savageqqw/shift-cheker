<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '../lib/api.js';
import { dateKey } from '../lib/scheduleEngine.js';

const period = ref('month'); // month | prev-month | year | all
const stats = ref(null);
const loading = ref(false);

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

const avgHours = computed(() => (stats.value ? Math.round(stats.value.avg_hours * 100) / 100 : 0));
</script>

<template>
  <div class="stats-page">
    <div class="period-tabs">
      <button class="btn btn-sm" :class="{ 'btn-primary': period === 'month' }" @click="period = 'month'">
        Цей місяць
      </button>
      <button class="btn btn-sm" :class="{ 'btn-primary': period === 'prev-month' }" @click="period = 'prev-month'">
        Минулий місяць
      </button>
      <button class="btn btn-sm" :class="{ 'btn-primary': period === 'year' }" @click="period = 'year'">
        Цей рік
      </button>
      <button class="btn btn-sm" :class="{ 'btn-primary': period === 'all' }" @click="period = 'all'">
        Весь час
      </button>
    </div>

    <div class="stat-grid" v-if="stats">
      <div class="stat card">
        <span class="stat-label">Відпрацьовано змін</span>
        <span class="stat-value">{{ stats.shift_count }}</span>
      </div>
      <div class="stat card">
        <span class="stat-label">Загальні години</span>
        <span class="stat-value">{{ stats.total_hours }}<span class="stat-unit">год</span></span>
      </div>
      <div class="stat card">
        <span class="stat-label">Середня зміна</span>
        <span class="stat-value">{{ avgHours }}<span class="stat-unit">год</span></span>
      </div>
      <div class="stat card">
        <span class="stat-label">Опрацьовано трейд-ін</span>
        <span class="stat-value">{{ stats.total_tradein }}<span class="stat-unit">шт</span></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.period-tabs {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3);
}
.stat {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stat-label {
  font-size: 12px;
  color: var(--ink-2);
}
.stat-value {
  font-family: var(--font-num);
  font-size: 28px;
  font-weight: 700;
  color: var(--ink-0);
}
.stat-unit {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-2);
  margin-left: 6px;
}

@media (max-width: 480px) {
  .period-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
  .period-tabs .btn {
    width: 100%;
  }
  .stat-grid {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
  .stat {
    padding: var(--space-3);
  }
  .stat-value {
    font-size: 22px;
  }
}

@media (max-width: 340px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
