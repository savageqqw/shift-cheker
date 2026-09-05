import { defineStore } from 'pinia';
import { api } from '../lib/api.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('shiftly_token') || null
  }),
  getters: {
    isAuthed: (state) => !!state.token
  },
  actions: {
    async login(password) {
      const { token } = await api.login(password);
      this.token = token;
      localStorage.setItem('shiftly_token', token);
    },
    logout() {
      this.token = null;
      localStorage.removeItem('shiftly_token');
    }
  }
});
