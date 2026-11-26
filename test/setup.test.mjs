import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_ITEMS, defaultPicks } from '../web/core/starter-items.js';
import { buildCar, validateSetup } from '../web/core/setup.js';
import { buildStatuses } from '../web/core/schedule.js';
import { validateItem } from '../web/core/items.js';

const TODAY = '2026-11-26';
const form = (overrides = {}) => ({
  name: 'Toyota Yaris', deliveredOn: '2019-03-01', currentKm: 85000, roundKm: 10000, roundMonths: 6,
  gearbox: 'auto', picks: defaultPicks('auto').map((id) => ({ id })), ...overrides,
});

test('every starter item is a valid item and ids are unique', () => {
  STARTER_ITEMS.forEach(({ isDefault, gearbox, ...item }) => assert.deepEqual(validateItem(item), [], item.id));
  assert.equal(new Set(STARTER_ITEMS.map((item) => item.id)).size, STARTER_ITEMS.length);
});

test('defaultPicks follows the gearbox', () => {
  assert.ok(defaultPicks('auto').includes('atf'));
  assert.ok(!defaultPicks('auto').includes('manual-gear-oil'));
  assert.ok(defaultPicks('manual').includes('manual-gear-oil'));
});

test('buildCar assumes items were done on the setup day when no date is given', () => {
  const data = buildCar(form(), TODAY);
  const oil = data.items.find((item) => item.id === 'engine-oil');
  assert.deepEqual(oil.assumedLast, { date: TODAY, km: 85000 });
  assert.equal(oil.isDefault, undefined);
  assert.equal(data.car.baselineKm, 80000);
  assert.equal(data.car.anchorItemId, 'engine-oil');
  assert.deepEqual(data.readings, [{ date: TODAY, km: 85000 }]);
  assert.deepEqual(data.visits, []);
});

test('buildCar uses the last done date and km the user gave', () => {
  const picks = [{ id: 'spark-plugs', lastDate: '2025-01-15', lastKm: 60000 }, { id: 'engine-oil' }];
  const data = buildCar(form({ picks }), TODAY);
  assert.deepEqual(data.items.find((item) => item.id === 'spark-plugs').assumedLast, { date: '2025-01-15', km: 60000 });
  assert.equal(data.items.length, 2);
});

test('buildCar gives record items no assumed date and calendar items this year\'s month', () => {
  const data = buildCar(form({ picks: [{ id: 'tyre-replace' }, { id: 'cabin-filter' }] }), TODAY);
  assert.equal(data.items.find((item) => item.id === 'tyre-replace').assumedLast, undefined);
  assert.deepEqual(data.items.find((item) => item.id === 'cabin-filter').assumedLast, { date: '2026-01-01' });
  assert.equal(data.car.anchorItemId, undefined);
});

test('a fresh setup has nothing overdue', () => {
  const data = buildCar(form({ picks: STARTER_ITEMS.map(({ id }) => ({ id })) }), TODAY);
  const late = buildStatuses(data, TODAY).filter((row) => ['overdue', 'watch'].includes(row.state));
  assert.deepEqual(late.map((row) => row.item.id), []);
});

test('validateSetup needs at least one item', () => {
  assert.ok(validateSetup(form({ picks: [] }), TODAY).includes('เลือกรายการอย่างน้อย 1 รายการ'));
});

test('validateSetup rejects bad car details and last-done entries', () => {
  assert.ok(validateSetup(form({ name: ' ' }), TODAY).length > 0);
  assert.ok(validateSetup(form({ deliveredOn: '2027-01-01' }), TODAY).length > 0);
  assert.ok(validateSetup(form({ currentKm: -1 }), TODAY).length > 0);
  assert.ok(validateSetup(form({ picks: [{ id: 'engine-oil', lastKm: 90000 }] }), TODAY).length > 0);
  assert.ok(validateSetup(form({ picks: [{ id: 'engine-oil', lastDate: '2027-01-01' }] }), TODAY).length > 0);
  assert.ok(validateSetup(form({ picks: [{ id: 'nope' }] }), TODAY).length > 0);
  assert.deepEqual(validateSetup(form(), TODAY), []);
});

test('the next service round after setup is the round just above the current km', async () => {
  const { nextRound } = await import('../web/core/schedule.js');
  assert.equal(nextRound(buildCar(form(), TODAY)).km, 90000);
  assert.equal(nextRound(buildCar(form({ currentKm: 90000 }), TODAY)).km, 100000);
});
