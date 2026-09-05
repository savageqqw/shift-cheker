<script setup>
import { computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import { useScheduleStore } from '../stores/schedule.js';
import { currentCyclePosition, dateKey } from '../lib/scheduleEngine.js';

const auth = useAuthStore();
const schedule = useScheduleStore();

onMounted(() => {
  if (!schedule.loaded) schedule.load();
});

const todayKey = dateKey(new Date());
const cyclePos = computed(() => (schedule.settings ? currentCyclePosition(todayKey, schedule.settings) : null));

function logout() {
  auth.logout();
  window.location.href = '/login';
}
</script>

<template>
  <div class="shell">
    <header class="shell-header">
      <div class="brand">
        <span class="brand-mark">◆</span>
        <span class="brand-name">Shiftly</span>
      </div>

      <nav class="shell-nav">
        <router-link to="/" exact-active-class="active">Графік</router-link>
        <router-link to="/stats" exact-active-class="active">Статистика</router-link>
        <router-link to="/settings" exact-active-class="active">Налаштування</router-link>
      </nav>

      <div class="shell-readout" v-if="cyclePos">
        <span class="readout-label">{{ cyclePos.phase === 'work' ? 'робочий' : 'вихідний' }}</span>
        <span class="readout-value">{{ cyclePos.day }}<span class="readout-of">/{{ cyclePos.of }}</span></span>
      </div>

      <button class="btn btn-ghost btn-sm logout-btn" @click="logout">Вийти</button>
    </header>

    <main class="shell-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.shell-header {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: 14px var(--space-6);
  border-bottom: 1px solid var(--line-soft);
  background: var(--bg-0);
  position: sticky;
  top: 0;
  z-index: 50;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.01em;
}
.brand-mark {
  color: var(--ink-1);
  font-size: 11px;
}

.shell-nav {
  display: flex;
  gap: var(--space-5);
  flex: 1;
}
.shell-nav a {
  color: var(--ink-2);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  padding: 6px 0;
  border-bottom: 2px solid transparent;
  transition: color 0.15s var(--ease), border-color 0.15s var(--ease);
}
.shell-nav a:hover {
  color: var(--ink-0);
}
.shell-nav a.active {
  color: var(--ink-0);
  border-bottom-color: var(--ink-0);
}

.shell-readout {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg-1);
}
.readout-label {
  font-size: 11px;
  color: var(--ink-2);
  text-transform: lowercase;
}
.readout-value {
  font-family: var(--font-num);
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-0);
}
.readout-of {
  color: var(--ink-3);
  font-weight: 400;
}

.shell-main {
  flex: 1;
  padding: var(--space-6);
  max-width: 1040px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 640px) {
  .shell-header {
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: 12px var(--space-4);
  }
  .shell-nav {
    order: 3;
    width: 100%;
    gap: var(--space-4);
  }
  .shell-main {
    padding: var(--space-4);
  }
}
</style>
