import { defineStore } from 'pinia';
import { api } from '../lib/api.js';
import { useToastStore } from './toast.js';

export const useScheduleStore = defineStore('schedule', {
  state: () => ({
    settings: null,
    overrides: {}, // date -> { date, is_working, note }
    loaded: false
  }),
  actions: {
    async load() {
      const { settings, overrides } = await api.getScheduleState();
      this.settings = settings;
      this.overrides = Object.fromEntries(overrides.map((o) => [o.date, o]));
      this.loaded = true;
    },

    async updateSettings(payload) {
      const toast = useToastStore();
      const prev = this.settings;
      this.settings = { ...this.settings, ...payload };
      try {
        const { settings } = await api.updateSettings(payload);
        this.settings = settings;
        toast.success('Графік оновлено');
      } catch (e) {
        this.settings = prev;
        toast.error(e.message);
        throw e;
      }
    },

    async setOverride(date, is_working, note) {
      const toast = useToastStore();
      const prev = this.overrides[date];
      this.overrides = { ...this.overrides, [date]: { date, is_working, note: note || '' } };
      try {
        const { override } = await api.setOverride({ date, is_working, note });
        this.overrides = { ...this.overrides, [date]: override };
        toast.success('Заміну збережено');
      } catch (e) {
        if (prev) this.overrides = { ...this.overrides, [date]: prev };
        else {
          const next = { ...this.overrides };
          delete next[date];
          this.overrides = next;
        }
        toast.error(e.message);
        throw e;
      }
    },

    async deleteOverride(date) {
      const toast = useToastStore();
      const prev = this.overrides[date];
      const next = { ...this.overrides };
      delete next[date];
      this.overrides = next;
      try {
        await api.deleteOverride(date);
        toast.success('Заміну скасовано');
      } catch (e) {
        if (prev) this.overrides = { ...this.overrides, [date]: prev };
        toast.error(e.message);
        throw e;
      }
    }
  }
});
