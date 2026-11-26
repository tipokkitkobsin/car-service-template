import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMessage } from '../notifier/format.js';
import { runReminders } from '../notifier/run.js';
import { makeData, visit } from './fixture.mjs';

const row = { item: { name: 'Oil' }, state: 'overdue', dueDate: '2026-10-05', dueKm: 120000, kmLeft: 500, daysLeft: -50, roundsOver: 1 };

test('overdue message names the item and how many rounds it is late', () => {
  const payload = formatMessage({ kind: 'overdue', rows: [row] }, 'https://example.test/');
  assert.match(payload.content, /Oil/);
  assert.match(payload.content, /เกินมา 1 รอบ/);
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
});

test('mileage question carries the estimate and an input button', () => {
  const payload = formatMessage({ kind: 'askKm', estimateKm: 115000, lastReadingDate: '2026-11-23' }, 'https://example.test/');
  assert.match(payload.content, /115,000/);
  assert.equal(payload.components[0].components[0].custom_id, 'km:open');
});

test('a long list stays inside the Discord limit', () => {
  const rows = Array.from({ length: 200 }, (_, index) => ({ ...row, item: { name: `Item ${index}` } }));
  assert.ok(formatMessage({ kind: 'overdue', rows }, 'https://example.test/').content.length <= 2000);
});

const data = () => makeData({ visits: [visit('v1', '2026-01-01', 100000, ['oil'])] });

test('state is returned only after every message is sent', async () => {
  const sent = [];
  const next = await runReminders({
    data: data(), state: {}, today: '2026-07-06', siteUrl: 'https://example.test/', send: async (payload) => sent.push(payload),
  });
  assert.ok(sent.length >= 1);
  assert.equal(next.lastDigest, '2026-07-06');
});

test('a failure keeps the state of messages already sent', async () => {
  const saved = [];
  let calls = 0;
  const twoKinds = makeData({
    visits: [visit('v1', '2026-01-01', 100000, ['oil']), visit('v2', '2026-01-01', 100000, ['plug'])],
    readings: [{ date: '2026-01-01', km: 100000 }],
  });
  const send = async () => { calls += 1; if (calls === 2) throw new Error('down'); };
  await assert.rejects(runReminders({
    data: twoKinds, state: {}, today: '2026-07-06', siteUrl: 'https://example.test/', send, save: async (state) => saved.push(state),
  }), /down/);
  assert.equal(saved.at(-1).lastDigest, '2026-07-06');
  assert.equal(saved.at(-1).lastAsk ?? null, null);
});

test('a failed send rejects', async () => {
  await assert.rejects(runReminders({
    data: data(), state: {}, today: '2026-07-06', siteUrl: 'https://example.test/', send: async () => { throw new Error('down'); },
  }), /down/);
});

test('readJson falls back when the file does not exist yet', async () => {
  const { readJson } = await import('../notifier/state.js');
  const readState = (read) => readJson(read, {});
  const missing = async () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }); };
  assert.deepEqual(await readState(missing), {});
  assert.deepEqual(await readState(async () => '{"a":1}'), { a: 1 });
  await assert.rejects(readState(async () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); }));
});

test('readJson can report a missing car file as null', async () => {
  const { readJson } = await import('../notifier/state.js');
  assert.equal(await readJson(async () => { throw Object.assign(new Error('x'), { code: 'ENOENT' }); }, null), null);
});
