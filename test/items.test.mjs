import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addItem, chosenGroup, deleteItem, groupNames, itemInUse, makeItemId, NEW_GROUP, updateCar, updateItem, validateItem,
} from '../web/core/items.js';
import { makeData, visit } from './fixture.mjs';

const newItem = { id: 'wiper', name: 'ใบปัดน้ำฝน', group: 'อื่น ๆ', rule: 'interval', intervalKm: 20000, intervalMonths: 12 };

test('addItem appends the item and leaves the input unchanged', () => {
  const data = makeData();
  const next = addItem(data, newItem);
  assert.equal(next.items.length, data.items.length + 1);
  assert.equal(next.items.at(-1).id, 'wiper');
  assert.equal(data.items.some((item) => item.id === 'wiper'), false);
});

test('addItem refuses a duplicate id', () => {
  assert.throws(() => addItem(makeData(), { ...newItem, id: 'oil' }), /ซ้ำ/);
});

test('updateItem keeps the id and changes the fields', () => {
  const next = updateItem(makeData(), 'oil', { id: 'other', name: 'น้ำมันใหม่', intervalKm: 5000 });
  const oil = next.items.find((item) => item.id === 'oil');
  assert.equal(oil.name, 'น้ำมันใหม่');
  assert.equal(oil.intervalKm, 5000);
  assert.equal(next.items.some((item) => item.id === 'other'), false);
});

test('updateItem drops fields that do not belong to the new rule', () => {
  const next = updateItem(makeData(), 'oil', { rule: 'record' });
  const oil = next.items.find((item) => item.id === 'oil');
  assert.equal(oil.intervalKm, undefined);
  assert.equal(oil.intervalMonths, undefined);
});

test('deleteItem removes an unused item', () => {
  const next = deleteItem(makeData(), 'tyre');
  assert.equal(next.items.some((item) => item.id === 'tyre'), false);
});

test('deleteItem refuses an item used by a visit', () => {
  const data = makeData({ visits: [visit('v1', '2026-01-01', 100000, ['oil'])] });
  assert.equal(itemInUse(data, 'oil'), true);
  assert.throws(() => deleteItem(data, 'oil'), { message: 'ลบไม่ได้ เพราะมีประวัติใช้รายการนี้' });
});

test('validateItem rejects an empty name', () => {
  assert.ok(validateItem({ ...newItem, name: '  ' }).length > 0);
});

test('validateItem rejects an interval item with no km, months or days', () => {
  assert.ok(validateItem({ id: 'x', name: 'x', rule: 'interval' }).length > 0);
});

test('validateItem accepts a day-based soft item and a calendar item', () => {
  assert.deepEqual(validateItem({ id: 'b', name: 'แบต', rule: 'interval', intervalDays: 730, isSoft: true }), []);
  assert.deepEqual(validateItem({ id: 'c', name: 'กรองแอร์', rule: 'calendar', calendarMonth: 1 }), []);
  assert.ok(validateItem({ id: 'c', name: 'กรองแอร์', rule: 'calendar', calendarMonth: 13 }).length > 0);
});

test('makeItemId gives a unique ascii id even for Thai names', () => {
  assert.match(makeItemId('น้ำมันเครื่อง', [], () => 0.5), /^item-[a-z0-9]{4}$/);
  assert.match(makeItemId('Wiper Blade', [], () => 0.5), /^wiper-blade-[a-z0-9]{4}$/);
  let calls = 0;
  const random = () => { calls += 1; return calls === 1 ? 0.5 : 0.7; };
  const first = makeItemId('x', [], () => 0.5);
  assert.notEqual(makeItemId('x', [first], random), first);
});

test('updateCar changes allowed fields only and validates them', () => {
  const next = updateCar(makeData(), { name: 'Jazz', roundKm: 5000, baselineKm: 1 });
  assert.equal(next.car.name, 'Jazz');
  assert.equal(next.car.roundKm, 5000);
  assert.equal(next.car.baselineKm, 100000);
  assert.throws(() => updateCar(makeData(), { name: '' }));
  assert.throws(() => updateCar(makeData(), { roundKm: 0 }));
});

test('validateItem rejects a bad starting point', () => {
  const base = { id: 'x', name: 'x', rule: 'interval', intervalKm: 10000, intervalMonths: 6 };
  assert.ok(validateItem({ ...base, assumedLast: { date: '2026-01-01', km: Number.NaN } }).length > 0);
  assert.ok(validateItem({ ...base, assumedLast: { date: '2026-01-01', km: -5 } }).length > 0);
  assert.ok(validateItem({ ...base, assumedLast: { date: 'soon', km: 5 } }).length > 0);
  assert.ok(validateItem({ ...base, assumedLast: { date: '2099-01-01', km: 5 } }, '2026-11-26').length > 0);
  assert.deepEqual(validateItem({ ...base, assumedLast: { date: '2026-01-01', km: 5 } }, '2026-11-26'), []);
  assert.deepEqual(validateItem({ id: 'c', name: 'c', rule: 'calendar', calendarMonth: 1, assumedLast: { date: '2026-01-01' } }), []);
});

test('updateCar saves a known language and refuses others', () => {
  assert.equal(updateCar(makeData(), { language: 'en' }).car.language, 'en');
  assert.throws(() => updateCar(makeData(), { language: 'fr' }));
});

test('groupNames lists each existing group once, in item order, skipping blanks', () => {
  const items = [{ group: 'เครื่องยนต์' }, { group: 'เบรก' }, { group: 'เครื่องยนต์' }, {}, { group: '  ' }];
  assert.deepEqual(groupNames(items), ['เครื่องยนต์', 'เบรก']);
});

test('chosenGroup returns the picked group, or the typed name for a new group', () => {
  assert.equal(chosenGroup('เบรก', 'ignored'), 'เบรก');
  assert.equal(chosenGroup(NEW_GROUP, '  ไฟส่องสว่าง '), 'ไฟส่องสว่าง');
  assert.equal(chosenGroup('', ''), '');
});

test('chosenGroup refuses a new group with no name', () => {
  assert.throws(() => chosenGroup(NEW_GROUP, '   '), /หมวด/);
});
