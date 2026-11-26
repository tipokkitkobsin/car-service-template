import test from 'node:test';
import assert from 'node:assert/strict';
import { planReminders } from '../web/core/alerts.js';

const row = (id, state, daysLeft, kmLeft, roundsOver = 0) => ({
  item: { id, name: id }, state, daysLeft, kmLeft, roundsOver, dueDate: '2027-01-01', dueKm: 120000,
});
const base = { rows: [], lastReadingDate: '2026-11-20', estimateKm: 100000, state: {} };
const kinds = (plan) => plan.messages.map((message) => message.kind);

test('soon item is sent once at the first stage', () => {
  const input = { ...base, today: '2026-11-24', rows: [row('oil', 'soon', 20, 900)] };
  const first = planReminders(input);
  assert.deepEqual(kinds(first), ['soon']);
  assert.deepEqual(kinds(planReminders({ ...input, state: first.nextState })), []);
});

test('item is sent again when it enters the last stage', () => {
  const first = planReminders({ ...base, today: '2026-11-24', rows: [row('oil', 'soon', 20, 900)] });
  const second = planReminders({
    ...base, today: '2026-12-10', rows: [row('oil', 'soon', 6, 250)], state: first.nextState,
  });
  assert.deepEqual(kinds(second), ['soon']);
});

test('overdue digest goes out on Monday only, once a day', () => {
  const rows = [row('plug', 'overdue', -10, -100, 1)];
  assert.deepEqual(kinds(planReminders({ ...base, today: '2026-11-24', rows })), []);
  const monday = planReminders({ ...base, today: '2026-11-23', rows });
  assert.deepEqual(kinds(monday), ['overdue']);
  assert.deepEqual(kinds(planReminders({ ...base, today: '2026-11-23', rows, state: monday.nextState })), []);
});

test('mileage is asked after 30 days without a reading, then not again for 30 days', () => {
  const input = { ...base, today: '2026-12-21' };
  const first = planReminders(input);
  assert.deepEqual(kinds(first), ['askKm']);
  assert.deepEqual(kinds(planReminders({ ...input, today: '2026-12-25', state: first.nextState })), []);
});

test('planReminders does not change the state it was given', () => {
  const state = Object.freeze({ sent: Object.freeze({}) });
  assert.doesNotThrow(() => planReminders({
    ...base, today: '2026-11-24', rows: [row('oil', 'soon', 20, 900)], state,
  }));
});
