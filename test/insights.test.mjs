import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatuses } from '../web/core/schedule.js';
import { lifeOf, lifespans, odometerSeries, roundProgress } from '../web/core/insights.js';
import { makeData, visit } from './fixture.mjs';

const rowFor = (data, id, today) => buildStatuses(data, today).find((row) => row.item.id === id);

test('life is the larger of km used and time used', () => {
  const data = makeData({ visits: [visit('v', '2026-01-01', 100000, ['oil'])], readings: [{ date: '2026-02-01', km: 108000 }] });
  const life = lifeOf(rowFor(data, 'oil', '2026-02-01'));
  assert.equal(life.pct, 80);
});

test('life goes past 100 when overdue', () => {
  const data = makeData({ visits: [visit('v', '2026-01-01', 100000, ['oil'])], readings: [{ date: '2026-02-01', km: 112000 }] });
  assert.equal(lifeOf(rowFor(data, 'oil', '2026-02-01')).pct, 120);
});

test('items without a due date have no life bar', () => {
  const data = makeData();
  assert.equal(lifeOf(rowFor(data, 'tyre', '2026-02-01')), null);
  assert.equal(lifeOf(rowFor(data, 'cloth', '2026-02-01')), null);
});

test('round progress runs from the last service to the next round', () => {
  const data = makeData({
    visits: [visit('v', '2026-01-01', 100000, ['oil'], 110000)],
    readings: [{ date: '2026-02-01', km: 105000 }],
  });
  const progress = roundProgress(data, '2026-02-01');
  assert.equal(progress.round.km, 120000);
  assert.equal(progress.due.km, 110000);
  assert.equal(progress.kmPct, 50);
  assert.ok(progress.timePct > 0 && progress.timePct < 100);
});

test('lifespans list each install with its days, the last one still running', () => {
  const data = makeData({
    visits: [visit('a', '2024-01-01', 80000, ['tyre']), visit('b', '2025-01-01', 90000, ['tyre'])],
  });
  const spans = lifespans(data, 'tyre', '2025-07-01');
  assert.deepEqual(spans.map((span) => [span.number, span.days, span.isCurrent]), [[0, 1086, false], [1, 366, false], [2, 181, true]]);
  assert.equal(spans[0].isOriginal, true);
});

test('lifespans carry the brand of each install and of the original part', () => {
  const data = makeData({
    items: [{ id: 'tyre', name: 'Tyre', rule: 'record', originalBrand: 'Factory tyre' }],
    visits: [{ ...visit('a', '2024-01-01', 80000, ['tyre']), parts: { tyre: 'Brand X' } }],
  });
  assert.deepEqual(lifespans(data, 'tyre', '2025-01-01').map((span) => span.brand), ['Factory tyre', 'Brand X']);
});

test('no original span when the first record is on the delivery date', () => {
  const data = makeData({ visits: [visit('a', '2021-01-10', 0, ['tyre']), visit('b', '2022-01-10', 9000, ['tyre'])] });
  assert.deepEqual(lifespans(data, 'tyre', '2022-06-01').map((span) => span.number), [1, 2]);
});

test('an item never changed shows one original span until today', () => {
  const data = makeData({ items: [{ id: 'disc', name: 'Disc', rule: 'record' }] });
  const spans = lifespans(data, 'disc', '2022-01-10');
  assert.deepEqual(spans.map((span) => [span.number, span.days, span.isCurrent, span.brand]), [[0, 365, true, 'เดิมติดรถ']]);
});

test('odometer series marks estimated points and ends today', () => {
  const data = makeData({
    visits: [visit('a', '2025-01-01', 90000, ['oil']), { ...visit('g', '2025-06-01', 95000, ['tyre']), isKmEstimated: true }],
    readings: [{ date: '2026-01-01', km: 100000 }],
  });
  const points = odometerSeries(data, '2026-01-11');
  assert.deepEqual(points.map((point) => [point.date, point.isEstimated]), [
    ['2021-01-10', true], ['2025-01-01', false], ['2025-06-01', true], ['2026-01-01', false], ['2026-01-11', true],
  ]);
});

test('the ring counts to the next service of the anchor item, not the round name', () => {
  const data = makeData({
    car: { ...makeData().car, anchorItemId: 'oil' },
    visits: [visit('v', '2026-11-23', 113444, ['oil'], 120000)],
    readings: [{ date: '2026-12-23', km: 115444 }],
  });
  const progress = roundProgress(data, '2026-12-23');
  assert.equal(progress.round.km, 130000);
  assert.deepEqual(progress.due, { km: 123444, date: '2027-05-23' });
  assert.equal(progress.kmPct, 20);
  assert.equal(progress.kmLeft, 8000);
  assert.equal(progress.daysLeft, 151);
});
