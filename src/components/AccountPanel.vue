<script setup>
import { ref } from 'vue';
import { api } from '../lib/api.js';
import { useAuthStore } from '../stores/auth.js';
const auth = useAuthStore();
const name = ref(''), username = ref(''), password = ref('');
const busy = ref(false), error = ref(''), created = ref('');
async function create() {
  busy.value = true;
  error.value = '';
  created.value = '';
  try {
    const { user } = await api.createUser({ display_name: name.value, username: username.value, password: password.value });
    created.value = `Акаунт ${user.username} створено. Передай другу адресу сайту, його логін і пароль. У нього буде власний порожній графік.`;
    name.value = username.value = password.value = '';
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
</script>

<template>
  <section v-if="auth.user?.id === 'owner'" class="card account-panel">
    <h2>Додати друга</h2>
    <p>Друг матиме окремі записи, статистику й налаштування. Твої дані залишаться у твоєму акаунті.</p>
    <form @submit.prevent="create" class="account-form">
      <div class="field"><label for="friend-name">Ім’я друга</label><input id="friend-name" class="input" v-model="name" required maxlength="80" autocomplete="off" /></div>
      <div class="field"><label for="friend-login">Логін друга</label><input id="friend-login" class="input" v-model="username" required pattern="[A-Za-z0-9_-]{3,32}" minlength="3" maxlength="32" autocomplete="off" autocapitalize="none" spellcheck="false" /><small>3–32 латинські літери, цифри, _ або -</small></div>
      <div class="field"><label for="friend-password">Пароль друга</label><input id="friend-password" class="input" type="password" v-model="password" required minlength="10" maxlength="256" autocomplete="new-password" /><small>Щонайменше 10 символів</small></div>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="created" role="status">{{ created }}</p>
      <button class="btn btn-primary" :disabled="busy">{{ busy ? 'Створення…' : 'Створити акаунт' }}</button>
    </form>
  </section>
</template>

<style scoped>
.account-panel { max-width: 540px; margin: var(--space-5) auto 0; padding: var(--space-5); }
h2 { font-size: 18px; margin: 0 0 12px; }
p, small { color: var(--text-2); line-height: 1.5; overflow-wrap: anywhere; }
.account-form { display: grid; gap: var(--space-4); margin-top: var(--space-4); }
</style>
