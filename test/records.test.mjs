import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addReading, addVisit, deleteReading, deleteVisit, isBrandable, knownBrands, partsFrom,
  updateReading, validateReading, validateVisit,
} from '../web/core/records.js';
import { makeData, visit } from './fixture.mjs';

const today = '2026-11-24';
const withReading = () => makeData({ readings: [{ date: '2026-11-01', km: 100000 }] });

test('accepts a sensible reading', () => {
  assert.deepEqual(validateReading(withReading(), { date: today, km: 101000 }, today), []);
});

test('rejects a lower km than an earlier reading', () => {
  assert.equal(validateReading(withReading(), { date: today, km: 99000 }, today).length, 1);
});

test('rejects a higher km than a later reading', () => {
  assert.equal(validateReading(withReading(), { date: '2026-10-01', km: 100500 }, today).length, 1);
});

test('rejects a jump too large for the days passed (typo guard)', () => {
  assert.equal(validateReading(withReading(), { date: today, km: 1000000 }, today).length, 1);
});

test('rejects future dates, bad dates and non-integers', () => {
  const data = withReading();
  assert.ok(validateReading(data, { date: '2026-11-25', km: 101000 }, today).length > 0);
  assert.ok(validateReading(data, { date: '2026-02-31', km: 101000 }, today).length > 0);
  assert.ok(validateReading(data, { date: today, km: 100.5 }, today).length > 0);
});

test('visit needs at least one known item', () => {
  const data = withReading();
  const empty = visit('v1', today, 101000, []);
  const unknown = visit('v2', today, 101000, ['nope']);
  assert.ok(validateVisit(data, empty, today).length > 0);
  assert.ok(validateVisit(data, unknown, today).length > 0);
});

test('visit rejects negative cost and a round off the grid', () => {
  const data = withReading();
  const good = visit('v1', today, 101000, ['oil']);
  assert.deepEqual(validateVisit(data, good, today), []);
  assert.ok(validateVisit(data, { ...good, cost: -1 }, today).length > 0);
  assert.ok(validateVisit(data, { ...good, roundKm: 110100 }, today).length > 0);
});

test('editing a visit does not compare it with itself', () => {
  const entry = visit('v1', today, 101000, ['oil']);
  const data = makeData({ visits: [entry] });
  assert.deepEqual(validateVisit(data, { ...entry, km: 100900 }, today), []);
});

test('add and delete return new objects', () => {
  const data = Object.freeze(makeData());
  const added = addVisit(data, visit('v1', today, 101000, ['oil']));
  assert.equal(data.visits.length, 0);
  assert.equal(added.visits.length, 1);
  assert.equal(deleteVisit(added, 'v1').visits.length, 0);
  assert.equal(addReading(data, { date: today, km: 101000 }).readings.length, 1);
});

test('adding a visit with the same id replaces it', () => {
  const first = addVisit(makeData(), visit('v1', today, 101000, ['oil']));
  const second = addVisit(first, visit('v1', today, 101200, ['oil']));
  assert.equal(second.visits.length, 1);
  assert.equal(second.visits[0].km, 101200);
});

const withWrongToday = () => makeData({
  readings: [{ date: '2026-11-01', km: 100000 }, { date: today, km: 105000 }],
});

test('a same-day reading can be corrected to a lower value', () => {
  assert.deepEqual(validateReading(withWrongToday(), { date: today, km: 101000 }, today), []);
  const fixed = addReading(withWrongToday(), { date: today, km: 101000 });
  assert.deepEqual(fixed.readings.at(-1), { date: today, km: 101000 });
});

test('deleteReading removes only the reading on that date', () => {
  const data = Object.freeze(withWrongToday());
  const next = deleteReading(data, today);
  assert.deepEqual(next.readings, [{ date: '2026-11-01', km: 100000 }]);
  assert.equal(data.readings.length, 2);
});

test('updateReading can move a reading to another date', () => {
  const next = updateReading(withWrongToday(), today, { date: '2026-11-20', km: 101000 });
  assert.deepEqual(next.readings.map((reading) => reading.date), ['2026-11-01', '2026-11-20']);
});

test('editing a reading is validated without the old value', () => {
  const data = makeData({ readings: [{ date: '2026-11-01', km: 100000 }, { date: today, km: 100500 }] });
  const reading = { date: '2026-11-20', km: 101000 };
  assert.deepEqual(validateReading(data, reading, today, { replaceDate: today }), []);
  assert.ok(validateReading(data, reading, today).length > 0);
});

test('two visits on the same day can be edited in either order', () => {
  const first = visit('a', '2026-11-23', 100123, ['oil']);
  const second = visit('b', '2026-11-23', 100140, ['plug']);
  const later = visit('c', '2026-11-25', 100158, ['cloth']);
  const data = makeData({ visits: [first, second, later] });
  assert.deepEqual(validateVisit(data, { ...first, itemIds: ['oil', 'cabin'] }, '2026-11-25'), []);
  assert.deepEqual(validateVisit(data, { ...second, km: 100100 }, '2026-11-25'), []);
});

test('a same-day visit still cannot pass a later date', () => {
  const first = visit('a', '2026-11-23', 100123, ['oil']);
  const later = visit('c', '2026-11-25', 100158, ['cloth']);
  const data = makeData({ visits: [first, later] });
  assert.ok(validateVisit(data, { ...first, km: 100200 }, '2026-11-25').length > 0);
});

test('visit kind must be a known category when given', () => {
  const data = withReading();
  const good = { ...visit('v1', today, 101000, ['oil']), kind: 'mod' };
  assert.deepEqual(validateVisit(data, good, today), []);
  assert.ok(validateVisit(data, { ...good, kind: 'party' }, today).length > 0);
});

test('knownBrands lists brands used for an item, newest first, then the factory part', () => {
  const data = makeData({
    items: [{ id: 'tyre', name: 'Tyre', rule: 'record', originalBrand: 'Factory' }],
    visits: [
      { ...visit('a', '2022-01-01', 50000, ['tyre']), parts: { tyre: 'Old brand' } },
      { ...visit('b', '2024-01-01', 80000, ['tyre']), parts: { tyre: 'New brand' } },
      { ...visit('c', '2025-01-01', 90000, ['tyre']), parts: { tyre: 'New brand' } },
    ],
  });
  assert.deepEqual(knownBrands(data, 'tyre'), ['New brand', 'Old brand', 'Factory']);
});

test('isBrandable covers parts, mods, day items and items flagged with a brand', () => {
  assert.equal(isBrandable({ rule: 'record' }), true);
  assert.equal(isBrandable({ rule: 'event' }), true);
  assert.equal(isBrandable({ rule: 'interval', intervalDays: 600 }), true);
  assert.equal(isBrandable({ rule: 'interval', hasBrand: true }), true);
  assert.equal(isBrandable({ rule: 'interval', intervalKm: 10000 }), false);
});

test('partsFrom keeps only items with a brand', () => {
  assert.deepEqual(partsFrom([['tyre', ' Brand X '], ['oil', ''], ['battery', 'GS']]), { tyre: 'Brand X', battery: 'GS' });
});
