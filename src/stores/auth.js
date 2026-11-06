import { defineStore } from 'pinia';
import { api } from '../lib/api.js';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('shiftly_token') || null,
    user: null
  }),
  getters: {
    isAuthed: (state) => !!state.token
  },
  actions: {
    async login(password, username = 'owner') {
      const { token, user } = await api.login(password, username);
      this.token = token;
      this.user = user;
      localStorage.setItem('shiftly_token', token);
    },
    async loadUser() {
      const { user } = await api.getCurrentUser();
      this.user = user;
    },
    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('shiftly_token');
    }
  }
});
