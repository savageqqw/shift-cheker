<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const password = ref('');
const error = ref('');
const loading = ref(false);

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(password.value);
    router.replace(route.query.redirect || '/');
  } catch (e) {
    error.value = e.message || 'Не вдалося увійти';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card card" @submit.prevent="submit">
      <div class="login-mark">◆</div>
      <div>
        <h1>Shiftly</h1>
        <p class="login-sub">Графік, години й заробіток</p>
      </div>

      <div class="field">
        <label for="password">Пароль</label>
        <input
          id="password"
          class="input"
          type="password"
          autocomplete="current-password"
          v-model="password"
          autofocus
          placeholder="••••••••"
        />
      </div>

      <p v-if="error" class="login-error">{{ error }}</p>

      <button class="btn btn-primary btn-block" type="submit" :disabled="loading || !password">
        {{ loading ? 'Вхід…' : 'Увійти' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: radial-gradient(600px 400px at 50% 0%, rgba(74, 222, 128, 0.08), transparent 70%);
}
.login-card {
  width: 100%;
  max-width: 360px;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  border-radius: var(--radius-lg);
}
.login-mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 18px;
}
.login-card h1 {
  margin: 0;
  font-size: 22px;
  letter-spacing: -0.01em;
}
.login-sub {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--ink-2);
}
.login-error {
  font-size: 13px;
  color: var(--state-rest-text);
  background: var(--state-rest-bg);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  margin: 0;
}

@media (max-width: 480px) {
  .login-card {
    padding: var(--space-5);
  }
}
</style>
