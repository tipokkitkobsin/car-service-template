import test from 'node:test';
import assert from 'node:assert/strict';
import { allReadings, buildStatuses, estimateKm, kmAt, usageOf, usageText } from '../web/core/schedule.js';
import { makeData, visit } from './fixture.mjs';

const guessed = (id, date, km, itemIds) => ({ ...visit(id, date, km, itemIds), isKmEstimated: true });

test('kmAt interpolates between the readings around a date', () => {
  const data = makeData({ readings: [{ date: '2026-01-01', km: 100000 }, { date: '2026-01-11', km: 101000 }] });
  assert.equal(kmAt(data, '2026-01-05'), 100400);
});

test('kmAt falls back to the estimate after the last reading', () => {
  const data = makeData({ readings: [{ date: '2026-01-01', km: 100000 }] });
  assert.equal(kmAt(data, '2026-01-11'), estimateKm(data, '2026-01-11').km);
});

test('estimated visits are not used as mileage readings', () => {
  const data = makeData({ visits: [guessed('g', '2026-01-05', 100400, ['tyre'])], readings: [{ date: '2026-01-01', km: 100000 }] });
  assert.deepEqual(allReadings(data).map((reading) => reading.km), [100000]);
});

test('usage shows years and km since the last record, flagged when estimated', () => {
  const data = makeData({
    visits: [guessed('g', '2024-01-10', 60000, ['tyre'])],
    readings: [{ date: '2026-01-10', km: 100000 }],
  });
  const row = buildStatuses(data, '2026-01-10').find((entry) => entry.item.id === 'tyre');
  const usage = usageOf(row, data, '2026-01-10');
  assert.equal(usage.km, 40000);
  assert.equal(usage.years, 2);
  assert.equal(usage.isEstimated, true);
  assert.match(usageText(usage), /ใช้มา 2 ปี · 40,000 km \(ประมาณ\)/);
});

test('usage is exact when both ends are real readings', () => {
  const data = makeData({ visits: [visit('v', '2025-01-10', 90000, ['tyre'])], readings: [{ date: '2026-01-10', km: 100000 }] });
  const row = buildStatuses(data, '2026-01-10').find((entry) => entry.item.id === 'tyre');
  assert.equal(usageOf(row, data, '2026-01-10').isEstimated, false);
});

test('usage is null with no record', () => {
  const data = makeData();
  const row = buildStatuses(data, '2026-01-10').find((entry) => entry.item.id === 'tyre');
  assert.equal(usageOf(row, data, '2026-01-10'), null);
});
