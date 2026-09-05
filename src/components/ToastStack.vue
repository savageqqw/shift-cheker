<script setup>
import { useToastStore } from '../stores/toast.js';

const toast = useToastStore();
</script>

<template>
  <div class="toast-stack">
    <div v-for="t in toast.items" :key="t.id" class="toast" :class="t.type" @click="toast.dismiss(t.id)">
      {{ t.message }}
    </div>
  </div>
</template>
