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
      <div class="login-mark" aria-hidden="true">S</div>
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
}
.login-card {
  width: 100%;
  max-width: 380px;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--glass-2);
}
.login-mark {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--solid);
  color: var(--on-solid);
  font-size: 24px;
  font-weight: 800;
  box-shadow: 0 0 30px rgba(255, 255, 255, 0.25);
}
.login-card h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.login-sub {
  margin: 4px 0 0;
  font-size: 15px;
  color: var(--text-2);
}
.login-error {
  font-size: 14px;
  font-weight: 600;
  background: var(--glass-2);
  border: 1px dashed var(--glass-border-strong);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  margin: 0;
}
.login-card .btn-primary {
  border-radius: 999px;
}

@media (max-width: 480px) {
  .login-card {
    padding: var(--space-5);
  }
}
</style>
