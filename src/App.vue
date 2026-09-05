<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth.js';
import AppShell from './components/AppShell.vue';
import ToastStack from './components/ToastStack.vue';

const route = useRoute();
const auth = useAuthStore();
const isPublic = computed(() => route.meta.public);
</script>

<template>
  <template v-if="isPublic || !auth.isAuthed">
    <router-view />
  </template>
  <AppShell v-else>
    <router-view />
  </AppShell>
  <ToastStack />
</template>
