import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, validBonusRules } from '../src/lib/earnings.js';
const settings = { bonus_rules: [{ name: '500 заявок', threshold: 500, amount: 1500, types: ['tradein', 'regular'] }] };
test('mixed requests reach threshold exactly once, wholesale pays 10', () => {
  const result = summarize([{ date: '2026-11-01', total_hours: 8, tradein_count: 200, regular_count: 300, wholesale_count: 4 }], settings);
  assert.equal(result.bonus_value, 1500);
  assert.equal(result.wholesale_value, 40);
  assert.equal(result.total_value, 9300);
  assert.equal(result.bonuses[0].count, 500);
});
test('499 requests do not unlock bonus and unselected types do not count', () => {
  assert.equal(summarize([{ date: '2026-11-01', tradein_count: 199, regular_count: 300, wholesale_count: 999 }], settings).bonus_value, 0);
});
test('year totals evaluate monthly thresholds independently', () => {
  const rows = [{ date: '2026-10-01', regular_count: 250 }, { date: '2026-11-01', regular_count: 250 }];
  assert.equal(summarize(rows, settings).bonus_value, 0);
  rows[0].regular_count = 1000; rows[1].regular_count = 500;
  assert.equal(summarize(rows, settings).bonus_value, 3000);
});
test('custom sources, multiple bonuses, zero rates and empty data', () => {
  const s = { wholesale_rate: 0, bonus_rules: [{ name: 'Опт', threshold: 2, amount: 100, types: ['wholesale'] }, { name: 'Ще', threshold: 1, amount: 50, types: ['wholesale'] }] };
  assert.equal(summarize([{ date: '2026-11-01', wholesale_count: 2 }], s).total_value, 150);
  assert.equal(summarize([], s).total_value, 0);
  assert.equal(validBonusRules([{ name: 'Bad', threshold: 0, amount: -1, types: ['unknown'] }]), false);
});
