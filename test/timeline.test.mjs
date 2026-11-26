import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, kindOf, milestones } from '../web/core/timeline.js';
import { buildStatuses } from '../web/core/schedule.js';
import { makeData, visit } from './fixture.mjs';

const withKind = (entry, kind) => ({ ...entry, kind });

test('kindOf uses the stored kind, else guesses service from engine oil', () => {
  assert.equal(kindOf(withKind(visit('a', '2026-01-01', 1, ['tyre']), 'mod')), 'mod');
  assert.equal(kindOf(visit('b', '2026-01-01', 1, ['oil'])), 'service');
  assert.equal(kindOf(visit('c', '2026-01-01', 1, ['tyre'])), 'part');
});

test('milestones include delivery and each 50,000 km crossed, dated by interpolation', () => {
  const data = makeData({ readings: [{ date: '2022-01-10', km: 40000 }, { date: '2022-07-10', km: 60000 }] });
  const marks = milestones(data, '2022-08-01');
  assert.deepEqual(marks.map((mark) => [mark.date, mark.title]), [
    ['2021-01-10', 'รับรถ'],
    ['2022-04-11', '50,000 km'],
  ]);
});

test('timeline groups events by year, newest first, and filters by kind', () => {
  const data = makeData({
    visits: [
      visit('a', '2025-03-01', 90000, ['oil']),
      withKind(visit('b', '2026-02-01', 100000, ['tyre']), 'mod'),
    ],
  });
  const years = buildTimeline(data, '2026-03-01');
  assert.deepEqual(years.map((year) => year.year), [...years.map((year) => year.year)].sort().reverse());
  assert.equal(years[0].year, '2026');
  assert.equal(years[0].events[0].kind, 'mod');
  const onlyService = buildTimeline(data, '2026-03-01', 'service');
  assert.ok(onlyService.every((year) => year.events.every((event) => ['service', 'milestone'].includes(event.kind))));
  assert.ok(onlyService.some((year) => year.events.some((event) => event.kind === 'service')));
});

test('event items are not shown as part ages', () => {
  const data = makeData({ items: [...makeData().items, { id: 'bumper', name: 'Bumper', rule: 'event' }] });
  const row = buildStatuses(data, '2026-01-01').find((entry) => entry.item.id === 'bumper');
  assert.equal(row.state, 'event');
});
