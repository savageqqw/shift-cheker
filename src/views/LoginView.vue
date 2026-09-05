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
      <h1>Shiftly</h1>
      <p class="login-sub">Графік роботи та продуктивність</p>

      <div class="field">
        <label for="password">Пароль</label>
        <input
          id="password"
          class="input"
          type="password"
          v-model="password"
          autofocus
          placeholder="••••••••"
        />
      </div>

      <p v-if="error" class="login-error">{{ error }}</p>

      <button class="btn btn-primary" type="submit" :disabled="loading || !password">
        {{ loading ? 'Вхід…' : 'Увійти' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}
.login-card {
  width: 100%;
  max-width: 340px;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.login-mark {
  font-size: 20px;
  color: var(--ink-1);
}
.login-card h1 {
  margin: 0;
  font-size: 20px;
  letter-spacing: -0.01em;
}
.login-sub {
  margin: -8px 0 0 0;
  font-size: 13px;
  color: var(--ink-2);
}
.login-error {
  font-size: 12px;
  color: var(--ink-0);
  background: var(--bg-2);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  margin: 0;
}
</style>
