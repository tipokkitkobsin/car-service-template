import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed, parseKm, recordKm, statusText, undoKm } from '../bot/src/handlers.mjs';
import { makeData } from './fixture.mjs';

const config = { ownerId: 'u1', channelId: 'c1' };
const memoryStore = (initial) => {
  let current = initial;
  return {
    update: async (change) => { current = change(current); return { data: current }; },
    load: async () => ({ data: current }),
    read: () => current,
  };
};

test('parseKm accepts commas and spaces', () => {
  assert.equal(parseKm('115,000'), 115000);
  assert.equal(parseKm(' 115000 '), 115000);
});

test('parseKm rejects text and decimals', () => {
  assert.equal(parseKm('abc'), null);
  assert.equal(parseKm('115000.5'), null);
  assert.equal(parseKm('1e6'), null);
});

test('only the owner in the one channel is allowed', () => {
  assert.equal(isAllowed({ userId: 'u1', channelId: 'c1' }, config), true);
  assert.equal(isAllowed({ userId: 'u2', channelId: 'c1' }, config), false);
  assert.equal(isAllowed({ userId: 'u1', channelId: 'c2' }, config), false);
});

test('recordKm saves a valid reading', async () => {
  const store = memoryStore(makeData({ readings: [{ date: '2026-11-01', km: 100000 }] }));
  const { text: reply } = await recordKm({ raw: '101,000', store, today: '2026-11-24' });
  assert.match(reply, /101,000/);
  assert.equal(store.read().readings.length, 2);
});

test('recordKm refuses a lower km and saves nothing', async () => {
  const store = memoryStore(makeData({ readings: [{ date: '2026-11-01', km: 100000 }] }));
  const { text: reply } = await recordKm({ raw: '90000', store, today: '2026-11-24' });
  assert.match(reply, /ต่ำกว่า/);
  assert.equal(store.read().readings.length, 1);
});

test('recordKm refuses text without touching the store', async () => {
  const store = memoryStore(makeData());
  assert.match((await recordKm({ raw: 'hello', store, today: '2026-11-24' })).text, /ตัวเลข/);
  assert.equal(store.read().readings.length, 0);
});

test('statusText lists what is overdue', async () => {
  const store = memoryStore(makeData({ readings: [{ date: '2026-11-01', km: 121000 }] }));
  assert.match(await statusText({ store, today: '2026-11-24' }), /Plug/);
});

test('a second /km on the same day corrects the first', async () => {
  const store = memoryStore(makeData({ readings: [{ date: '2026-11-01', km: 100000 }] }));
  await recordKm({ raw: '109000', store, today: '2026-11-24' });
  const reply = await recordKm({ raw: '101000', store, today: '2026-11-24' });
  assert.match(reply.text, /101,000/);
  assert.equal(store.read().readings.at(-1).km, 101000);
});

test('recordKm returns the saved reading for the undo button', async () => {
  const store = memoryStore(makeData());
  const reply = await recordKm({ raw: '101000', store, today: '2026-11-24' });
  assert.deepEqual(reply.reading, { date: '2026-11-24', km: 101000 });
});

test('undoKm removes the reading only when it still matches', async () => {
  const store = memoryStore(makeData({ readings: [{ date: '2026-11-24', km: 101000 }] }));
  assert.match(await undoKm({ date: '2026-11-24', km: 999, store }), /ไม่พบ/);
  assert.equal(store.read().readings.length, 1);
  assert.match(await undoKm({ date: '2026-11-24', km: 101000, store }), /ลบ/);
  assert.equal(store.read().readings.length, 0);
});

test('statusText includes how long recorded parts have been used', async () => {
  const store = memoryStore(makeData({
    visits: [{ id: 'v', date: '2025-11-24', km: 100000, roundKm: 100000, itemIds: ['tyre'], shop: '', cost: null, note: '' }],
    readings: [{ date: '2026-11-24', km: 110000 }],
  }));
  assert.match(await statusText({ store, today: '2026-11-24' }), /Tyre.*ใช้มา 1 ปี · 10,000 km/);
});

const garageOf = (cars) => ({
  listCars: async () => cars.map((car) => car.id),
  storeFor: (id) => ({ load: async () => ({ data: cars.find((car) => car.id === id).data }) }),
});

test('pickCar uses the only car, or the one asked for by id or name', async () => {
  const { pickCar } = await import('../bot/src/handlers.mjs');
  const cars = [{ id: 'main', name: 'Civic' }, { id: 'yaris', name: 'Toyota Yaris' }];
  assert.equal(pickCar([cars[0]], null), 'main');
  assert.equal(pickCar(cars, 'yaris'), 'yaris');
  assert.equal(pickCar(cars, 'toyota yaris'), 'yaris');
  assert.equal(pickCar(cars, null), null);
  assert.equal(pickCar(cars, 'nope'), null);
});

test('statusAll shows every car with its name when there are several', async () => {
  const { statusAll } = await import('../bot/src/handlers.mjs');
  const civic = makeData({ car: { ...makeData().car, name: 'Civic' }, readings: [{ date: '2026-11-01', km: 140000 }] });
  const yaris = makeData({ car: { ...makeData().car, name: 'Yaris' } });
  const text = await statusAll({ garage: garageOf([{ id: 'main', data: civic }, { id: 'yaris', data: yaris }]), today: '2026-11-26' });
  assert.match(text, /\*\*Civic\*\*/);
  assert.match(text, /\*\*Yaris\*\*/);
  assert.ok(text.length <= 1900);
});

test('statusAll with one car looks like before, with no car name', async () => {
  const { statusAll } = await import('../bot/src/handlers.mjs');
  const civic = makeData({ car: { ...makeData().car, name: 'Civic' } });
  const text = await statusAll({ garage: garageOf([{ id: 'main', data: civic }]), today: '2026-11-26' });
  assert.doesNotMatch(text, /\*\*Civic\*\*/);
});
