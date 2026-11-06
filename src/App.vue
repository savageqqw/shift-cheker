<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth.js';
import AppShell from './components/AppShell.vue';
import ToastStack from './components/ToastStack.vue';

const route = useRoute();
const auth = useAuthStore();
const isPublic = computed(() => route.meta.public);
function syncSession(event) {
  if (event.key === 'shiftly_token') window.location.reload();
}
onMounted(() => window.addEventListener('storage', syncSession));
onBeforeUnmount(() => window.removeEventListener('storage', syncSession));
</script>

<template>
  <template v-if="isPublic || route.meta.compact || !auth.isAuthed">
    <router-view />
  </template>
  <AppShell v-else>
    <router-view />
  </AppShell>
  <ToastStack />
</template>
