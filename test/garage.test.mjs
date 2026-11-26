import test from 'node:test';
import assert from 'node:assert/strict';
import {
  carIdFromFile, carPath, garageSummary, makeCarId, stateFileFor,
} from '../web/core/garage.js';
import { makeData, visit } from './fixture.mjs';

test('the first car keeps car.json and its old state file', () => {
  assert.equal(carPath('main'), 'data/car.json');
  assert.equal(stateFileFor('main'), 'data/reminder-state.json');
  assert.equal(carIdFromFile('car.json'), 'main');
});

test('other cars use car-<id>.json and their own state file', () => {
  assert.equal(carPath('yaris'), 'data/car-yaris.json');
  assert.equal(stateFileFor('yaris'), 'data/reminder-state-yaris.json');
  assert.equal(carIdFromFile('car-yaris.json'), 'yaris');
});

test('files that are not cars are ignored', () => {
  assert.equal(carIdFromFile('reminder-state.json'), null);
  assert.equal(carIdFromFile('car-.json'), null);
  assert.equal(carIdFromFile('car-Yaris.json'), null);
  assert.equal(carIdFromFile('car-../x.json'), null);
});

test('makeCarId gives a short unique id from the name', () => {
  assert.equal(makeCarId('Toyota Yaris', ['main']), 'toyota-yaris');
  assert.equal(makeCarId('Toyota Yaris', ['main', 'toyota-yaris']), 'toyota-yaris-2');
  assert.equal(makeCarId('รถแม่', ['main']), 'car-2');
  assert.equal(makeCarId('main', ['main']), 'main-2');
});

test('garageSummary puts cars with overdue work first and lists the two most urgent items', () => {
  const today = '2026-11-26';
  const fine = makeData({
    car: { ...makeData().car, name: 'Fine' },
    items: [{ id: 'oil', name: 'Oil', rule: 'interval', intervalKm: 10000, intervalMonths: 6, assumedLast: { date: today, km: 100000 } }],
    readings: [{ date: today, km: 100000 }],
  });
  const late = makeData({
    car: { ...makeData().car, name: 'Late' },
    readings: [{ date: today, km: 130000 }],
    visits: [visit('v1', '2020-01-01', 1000, ['oil'])],
  });
  const summary = garageSummary([{ id: 'main', data: fine }, { id: 'late', data: late }], today);
  assert.deepEqual(summary.map((car) => car.id), ['late', 'main']);
  assert.equal(summary[0].name, 'Late');
  assert.ok(summary[0].counts.overdue > 0);
  assert.ok(summary[0].urgent.length <= 2);
  assert.equal(summary[0].urgent[0].state, 'overdue');
  assert.equal(summary[1].counts.overdue, 0);
  assert.equal(summary[1].km, 100000);
});
