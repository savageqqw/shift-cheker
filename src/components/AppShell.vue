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
  border-bottom: 1px solid var(--glass-border);
  background: rgba(9, 9, 11, 0.55);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  position: sticky;
  top: 0;
  z-index: 50;
}

.brand {
  font-weight: 800;
  font-size: 18px;
  letter-spacing: -0.02em;
}

.shell-nav {
  display: flex;
  gap: 4px;
  flex: 1;
  padding: 4px;
  border-radius: 999px;
  max-width: max-content;
  background: var(--glass-1);
  border: 1px solid var(--glass-border);
}
.shell-nav a {
  color: var(--text-2);
  text-decoration: none;
  font-size: 14px;
  font-weight: 700;
  padding: 7px 16px;
  border-radius: 999px;
  transition: color 0.15s var(--ease), background 0.15s var(--ease);
}
.shell-nav a:hover {
  color: var(--text);
}
.shell-nav a.active {
  color: var(--on-solid);
  background: var(--solid);
}

.today-chip {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 13px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  border: 1px solid var(--glass-border);
  background: var(--glass-2);
  white-space: nowrap;
}
.today-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--text);
}
.today-chip.work .today-dot {
  background: var(--text);
}

.logout-btn {
  color: var(--text-2);
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
  .shell-nav {
    display: none;
  }
  .logout-btn {
    padding: 6px 8px;
  }
  .shell-main {
    padding: var(--space-4) var(--space-4)
      calc(var(--tabbar-h) + var(--tabbar-gap) + var(--safe-bottom) + var(--space-5));
  }

  /* Floating frosted pill */
  .tabbar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    position: fixed;
    left: var(--tabbar-gap);
    right: var(--tabbar-gap);
    bottom: calc(var(--tabbar-gap) + var(--safe-bottom));
    height: var(--tabbar-h);
    padding: 6px;
    border-radius: 999px;
    background: rgba(28, 28, 32, 0.6);
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
    z-index: 60;
  }
  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--text-3);
    text-decoration: none;
    font-size: 11px;
    font-weight: 700;
    border-radius: 999px;
    transition: color 0.15s var(--ease), background 0.15s var(--ease);
  }
  .tab svg {
    width: 21px;
    height: 21px;
  }
  .tab.active {
    color: var(--text);
    background: var(--glass-3);
  }
}

@media (max-width: 360px) {
  .today-chip {
    font-size: 12px;
    padding: 6px 10px;
  }
}
</style>
