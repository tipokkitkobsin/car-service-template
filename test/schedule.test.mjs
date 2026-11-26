import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths, baselineFor, buildStatuses, estimateKm, itemStatus, nextRound, roundForKm,
} from '../web/core/schedule.js';
import { makeData, visit } from './fixture.mjs';

const byId = (rows, id) => rows.find((row) => row.item.id === id);

test('addMonths clamps to the end of a shorter month', () => {
  assert.equal(addMonths('2026-08-31', 6), '2027-02-28');
  assert.equal(addMonths('2026-01-15', 6), '2026-07-15');
});

test('roundForKm rounds up to the next round', () => {
  assert.equal(roundForKm(100001, 10000), 110000);
  assert.equal(roundForKm(110000, 10000), 110000);
  assert.equal(roundForKm(109999, 10000), 110000);
});

test('baseline assumes the last scheduled service before the baseline km', () => {
  const data = makeData();
  const plug = data.items.find((item) => item.id === 'plug');
  assert.deepEqual(baselineFor(plug, data.car), { date: '2024-01-10', km: 60000, isAssumed: true });
});

test('baseline for an interval longer than the baseline km starts at delivery', () => {
  const data = makeData();
  const coolant = data.items.find((item) => item.id === 'coolant');
  assert.deepEqual(baselineFor(coolant, data.car), { date: '2021-01-10', km: 0, isAssumed: true });
});

test('next due counts from the latest real service, not the schedule grid', () => {
  const data = makeData({ visits: [visit('v1', '2026-03-01', 50000, ['plug'])] });
  const plug = data.items.find((item) => item.id === 'plug');
  const row = itemStatus(plug, data, '2026-03-02', 50040);
  assert.equal(row.dueKm, 110000);
  assert.equal(row.dueDate, '2029-03-01');
});

test('whichever comes first: time makes an item overdue before km', () => {
  const data = makeData({ visits: [visit('v1', '2026-01-01', 100000, ['oil'])] });
  const oil = data.items.find((item) => item.id === 'oil');
  const row = itemStatus(oil, data, '2026-07-02', 102000);
  assert.equal(row.state, 'overdue');
  assert.equal(row.roundsOver, 1);
});

test('roundsOver grows with each full round missed', () => {
  const data = makeData({ visits: [visit('v1', '2026-01-01', 100000, ['oil'])] });
  const oil = data.items.find((item) => item.id === 'oil');
  assert.equal(itemStatus(oil, data, '2026-03-01', 131000).roundsOver, 3);
});

test('item is soon inside 30 days or 1,000 km', () => {
  const data = makeData({ visits: [visit('v1', '2026-01-01', 100000, ['oil'])] });
  const oil = data.items.find((item) => item.id === 'oil');
  assert.equal(itemStatus(oil, data, '2026-02-01', 109100).state, 'soon');
  assert.equal(itemStatus(oil, data, '2026-06-05', 102000).state, 'soon');
  assert.equal(itemStatus(oil, data, '2026-02-01', 102000).state, 'ok');
});

test('calendar item is due next January and does not slide without a record', () => {
  const data = makeData();
  const cabin = data.items.find((item) => item.id === 'cabin');
  assert.equal(itemStatus(cabin, data, '2026-11-24', 100000).dueDate, '2027-01-01');
  assert.equal(itemStatus(cabin, data, '2027-03-01', 100000).state, 'overdue');
});

test('calendar item done in December counts for the coming January', () => {
  const data = makeData({ visits: [visit('v1', '2026-12-20', 100000, ['cabin'])] });
  const cabin = data.items.find((item) => item.id === 'cabin');
  assert.equal(itemStatus(cabin, data, '2026-12-21', 100000).dueDate, '2028-01-01');
});

test('inspect item with no record needs checking', () => {
  const data = makeData();
  const cloth = data.items.find((item) => item.id === 'cloth');
  assert.equal(itemStatus(cloth, data, '2026-11-24', 100000).state, 'check');
});

test('record-only item has no due date', () => {
  const data = makeData();
  const tyre = data.items.find((item) => item.id === 'tyre');
  const row = itemStatus(tyre, data, '2026-11-24', 100000);
  assert.equal(row.state, 'record');
  assert.equal(row.dueDate, null);
});

test('two shops in one round both count', () => {
  const data = makeData({
    visits: [
      visit('v1', '2027-03-02', 195000, ['oil'], 200000),
      visit('v2', '2027-03-05', 195100, ['cloth'], 200000),
    ],
  });
  const rows = buildStatuses(data, '2027-03-06');
  assert.equal(byId(rows, 'oil').last.date, '2027-03-02');
  assert.equal(byId(rows, 'cloth').last.date, '2027-03-05');
});

test('estimateKm uses the real pace from recent readings', () => {
  const data = makeData({
    readings: [{ date: '2026-01-01', km: 100000 }, { date: '2026-04-11', km: 105000 }],
  });
  const estimate = estimateKm(data, '2026-04-21');
  assert.equal(estimate.perDay, 50);
  assert.equal(estimate.km, 105500);
  assert.equal(estimate.isEstimated, true);
});

test('estimateKm falls back to the default pace with one reading', () => {
  const data = makeData({ readings: [{ date: '2026-01-01', km: 100000 }] });
  assert.equal(estimateKm(data, '2026-01-11').km, 100400);
});

test('estimateKm is exact on the day of a reading', () => {
  const data = makeData({ readings: [{ date: '2026-01-01', km: 100000 }] });
  assert.equal(estimateKm(data, '2026-01-01').isEstimated, false);
});

test('nextRound follows the latest recorded round', () => {
  const data = makeData({ visits: [visit('v1', '2026-11-01', 113000, ['oil'], 120000)] });
  assert.deepEqual(nextRound(data), { km: 130000, years: 6.5, date: '2027-07-10' });
});

test('estimateKm counts back from a later reading when none came before', () => {
  const data = makeData({ readings: [{ date: '2026-01-11', km: 150400 }] });
  const estimate = estimateKm(data, '2026-01-01');
  assert.equal(estimate.km, 150000);
  assert.equal(estimate.isEstimated, true);
});
