import { defineStore } from 'pinia';
import { api } from '../lib/api.js';
import { useToastStore } from './toast.js';

export const useShiftsStore = defineStore('shifts', {
  state: () => ({
    byDate: {}, // date -> shift row
    loadedRanges: new Set()
  }),
  actions: {
    async loadRange(from, to) {
      const key = `${from}_${to}`;
      if (this.loadedRanges.has(key)) return;
      const { shifts } = await api.listShifts(from, to);
      const next = { ...this.byDate };
      shifts.forEach((s) => {
        next[s.date] = s;
      });
      this.byDate = next;
      this.loadedRanges.add(key);
    },

    async save(date, { start_time, end_time, tradein_count, nova_poshta_count, note }) {
      const toast = useToastStore();
      const prev = this.byDate[date];
      const optimistic = {
        date,
        start_time,
        end_time,
        tradein_count: tradein_count || 0,
        nova_poshta_count: nova_poshta_count || 0,
        note: note || null,
        total_hours: prev ? prev.total_hours : null
      };
      this.byDate = { ...this.byDate, [date]: optimistic };
      try {
        const { shift } = await api.upsertShift({ date, start_time, end_time, tradein_count, nova_poshta_count, note });
        this.byDate = { ...this.byDate, [date]: shift };
        toast.success('Зміну збережено');
        return shift;
      } catch (e) {
        if (prev) this.byDate = { ...this.byDate, [date]: prev };
        else {
          const next = { ...this.byDate };
          delete next[date];
          this.byDate = next;
        }
        toast.error(e.message);
        throw e;
      }
    },

    async remove(date) {
      const toast = useToastStore();
      const prev = this.byDate[date];
      const next = { ...this.byDate };
      delete next[date];
      this.byDate = next;
      try {
        await api.deleteShift(date);
        toast.success('Запис видалено');
      } catch (e) {
        if (prev) this.byDate = { ...this.byDate, [date]: prev };
        toast.error(e.message);
        throw e;
      }
    }
  }
});
