import test from 'node:test';
import assert from 'node:assert/strict';
import { itemStatus, leftText, sortByUrgency } from '../web/core/schedule.js';
import { planReminders } from '../web/core/alerts.js';
import { formatMessage } from '../notifier/format.js';
import { makeData, visit } from './fixture.mjs';

const battery = { id: 'battery', name: 'Battery', rule: 'interval', intervalDays: 600, isSoft: true };
const data = makeData({ items: [battery], visits: [visit('b', '2025-03-06', 100000, ['battery'])] });

test('a day-based item is due after that many days, with no km', () => {
  const row = itemStatus(battery, data, '2026-01-01', 110000);
  assert.equal(row.dueDate, '2026-10-27');
  assert.equal(row.dueKm, null);
  assert.equal(row.state, 'ok');
});

test('a soft item past due is in the watch zone, not overdue', () => {
  const row = itemStatus(battery, data, '2026-11-25', 120000);
  assert.equal(row.state, 'watch');
  assert.equal(row.roundsOver, 0);
  assert.match(leftText(row), /ใช้มา 629 วัน/);
});

test('a soft item is soon 30 days before', () => {
  assert.equal(itemStatus(battery, data, '2026-10-01', 115000).state, 'soon');
});

test('watch sorts after overdue and before soon', () => {
  const rows = [{ state: 'soon', daysLeft: 3 }, { state: 'watch', daysLeft: -5 }, { state: 'overdue', daysLeft: -1 }];
  assert.deepEqual(sortByUrgency(rows).map((row) => row.state), ['overdue', 'watch', 'soon']);
});

test('entering the watch zone sends one message, then stays quiet', () => {
  const row = { ...itemStatus(battery, data, '2026-11-25', 120000) };
  const input = { rows: [row], today: '2026-11-25', lastReadingDate: '2026-11-20', estimateKm: 120000, state: {} };
  const first = planReminders(input);
  assert.deepEqual(first.messages.map((message) => message.kind), ['watch']);
  assert.deepEqual(planReminders({ ...input, today: '2026-11-30', state: first.nextState }).messages, []);
});

test('the watch message says the item is in its caution period', () => {
  const row = itemStatus(battery, data, '2026-11-25', 120000);
  assert.match(formatMessage({ kind: 'watch', rows: [row] }, 'https://example.test/').content, /ช่วงระวัง[\s\S]*Battery/);
});

test('a sent watch message is saved as sent, not as a mileage question', async () => {
  const { runReminders } = await import('../notifier/run.js');
  const saved = [];
  const fresh = makeData({ items: [battery], visits: [visit('b', '2025-03-06', 100000, ['battery'])], readings: [{ date: '2026-10-01', km: 118000 }] });
  let calls = 0;
  const send = async () => { calls += 1; if (calls === 2) throw new Error('down'); };
  await runReminders({ data: fresh, state: {}, today: '2026-11-25', siteUrl: 'https://example.test/', send, save: async (s) => saved.push(s) }).catch(() => {});
  assert.equal(Object.values(saved.at(-1).sent ?? {}).includes(3), true);
  assert.equal(saved.at(-1).lastAsk ?? null, null);
});
