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
      <div class="brand">
        <span class="brand-mark">◆</span>
        <span class="brand-name">Shiftly</span>
      </div>

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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
  gap: var(--space-6);
  padding: 14px var(--space-6);
  border-bottom: 1px solid var(--line-soft);
  background: rgba(11, 12, 14, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 50;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.01em;
}
.brand-mark {
  color: var(--accent);
  font-size: 12px;
}

.shell-nav {
  display: flex;
  gap: var(--space-2);
  flex: 1;
}
.shell-nav a {
  color: var(--ink-2);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  transition: color 0.15s var(--ease), background 0.15s var(--ease);
}
.shell-nav a:hover {
  color: var(--ink-0);
}
.shell-nav a.active {
  color: var(--ink-0);
  background: var(--bg-2);
}

.today-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid var(--line);
  background: var(--bg-1);
  color: var(--ink-1);
  white-space: nowrap;
}
.today-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ink-3);
}
.today-chip.work .today-dot {
  background: var(--accent);
}
.today-chip.rest .today-dot {
  background: var(--state-rest-text);
}

.shell-main {
  flex: 1;
  padding: var(--space-6);
  max-width: 1080px;
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
  .today-chip {
    margin-left: auto;
  }
  .logout-btn {
    padding: 6px 10px;
  }
  .shell-main {
    padding: var(--space-4) var(--space-3) calc(var(--tabbar-h) + var(--safe-bottom) + var(--space-4));
  }

  .tabbar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: calc(var(--tabbar-h) + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    background: rgba(19, 20, 24, 0.92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-top: 1px solid var(--line-soft);
    z-index: 60;
  }
  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: var(--ink-3);
    text-decoration: none;
    font-size: 11px;
    font-weight: 500;
    transition: color 0.15s var(--ease);
  }
  .tab svg {
    width: 22px;
    height: 22px;
  }
  .tab.active {
    color: var(--accent);
  }
}

@media (max-width: 360px) {
  .brand-name {
    display: none;
  }
}
</style>
