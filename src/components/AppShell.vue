<script setup>
import { computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import { useScheduleStore } from '../stores/schedule.js';
import { effectiveDayType, dateKey } from '../lib/scheduleEngine.js';

const auth = useAuthStore();
const schedule = useScheduleStore();

onMounted(() => {
  if (!schedule.loaded) schedule.load();
});

const todayKey = dateKey(new Date());
const todayType = computed(() =>
  schedule.settings ? effectiveDayType(todayKey, schedule.settings, schedule.overrides).type : null
);

const tabs = [
  { to: '/', label: 'Графік', icon: 'M3 9h18M8 3v4M16 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z' },
  { to: '/stats', label: 'Статистика', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  {
    to: '/settings',
    label: 'Налаштування',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z'
  }
];

function logout() {
  auth.logout();
  window.location.href = '/login';
}
</script>

<template>
  <div class="shell">
    <header class="shell-header">
      <div class="brand">Shiftly</div>

      <nav class="shell-nav">
        <router-link v-for="t in tabs" :key="t.to" :to="t.to" exact-active-class="active">{{ t.label }}</router-link>
      </nav>

      <div class="today-chip" v-if="todayType" :class="todayType">
        <span class="today-dot"></span>
        Сьогодні {{ todayType === 'work' ? 'робочий' : 'вихідний' }}
      </div>

      <button class="btn btn-ghost btn-sm logout-btn" @click="logout">Вийти</button>
    </header>

    <main class="shell-main">
      <slot />
    </main>

    <nav class="tabbar" aria-label="Навігація">
      <router-link v-for="t in tabs" :key="t.to" :to="t.to" exact-active-class="active" class="tab">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path :d="t.icon" />
        </svg>
        <span>{{ t.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.shell-header {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding: 12px var(--space-6);
  border-bottom: var(--bw) solid var(--ink);
  background: var(--paper);
  position: sticky;
  top: 0;
  z-index: 50;
}

.brand {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 17px;
  text-transform: uppercase;
  background: var(--yellow);
  border: var(--bw) solid var(--ink);
  box-shadow: var(--shadow-sm);
  padding: 5px 10px;
  border-radius: 6px;
  transform: rotate(-2deg);
}

.shell-nav {
  display: flex;
  gap: var(--space-2);
  flex: 1;
}
.shell-nav a {
  color: var(--ink);
  text-decoration: none;
  font-size: 15px;
  font-weight: 800;
  padding: 7px 14px;
  border: var(--bw-sm) solid transparent;
  border-radius: var(--radius-sm);
  transition: background 0.15s var(--ease);
}
.shell-nav a:hover {
  background: rgba(17, 17, 17, 0.06);
}
.shell-nav a.active {
  background: var(--card);
  border-color: var(--ink);
  box-shadow: var(--shadow-sm);
}

.today-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  border: var(--bw-sm) solid var(--ink);
  background: var(--card);
  white-space: nowrap;
}
.today-chip.work {
  background: var(--teal);
}
.today-chip.rest {
  background: var(--coral);
}
.today-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink);
}

.logout-btn {
  font-weight: 700;
}

.shell-main {
  flex: 1;
  padding: var(--space-6);
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
}

.tabbar {
  display: none;
}

@media (max-width: 760px) {
  .shell-header {
    gap: var(--space-3);
    padding: calc(10px + var(--safe-top)) var(--space-4) 10px;
  }
  .brand {
    font-size: 15px;
  }
  .shell-nav {
    display: none;
  }
  .today-chip {
    margin-left: auto;
  }
  .logout-btn {
    padding: 6px 8px;
  }
  .shell-main {
    padding: var(--space-4) var(--space-4) calc(var(--tabbar-h) + var(--safe-bottom) + var(--space-5));
  }

  .tabbar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(var(--tabbar-h) + var(--safe-bottom));
    padding: 8px 12px calc(8px + var(--safe-bottom));
    background: var(--card);
    border-top: var(--bw) solid var(--ink);
    z-index: 60;
  }
  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: var(--ink);
    text-decoration: none;
    font-size: 11px;
    font-weight: 800;
    border: var(--bw-sm) solid transparent;
    border-radius: var(--radius-sm);
    transition: background 0.15s var(--ease);
  }
  .tab svg {
    width: 22px;
    height: 22px;
  }
  .tab.active {
    background: var(--yellow);
    border-color: var(--ink);
    box-shadow: var(--shadow-sm);
  }
}

@media (max-width: 360px) {
  .today-chip {
    font-size: 12px;
    padding: 5px 9px;
  }
}
</style>
