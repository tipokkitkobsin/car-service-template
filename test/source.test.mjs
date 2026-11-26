import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSource, sourceErrors } from '../web/core/source.js';

test('defaultSource takes the owner from a github.io host', () => {
  assert.deepEqual(defaultSource('somchai.github.io'), { owner: 'somchai', repo: 'car-service-data' });
});

test('defaultSource leaves the owner blank elsewhere', () => {
  assert.equal(defaultSource('localhost').owner, '');
  assert.equal(defaultSource('cars.example.com').owner, '');
});

test('sourceErrors checks GitHub name rules', () => {
  assert.deepEqual(sourceErrors({ owner: 'somchai-k', repo: 'car.data_1' }), []);
  assert.ok(sourceErrors({ owner: '', repo: 'x' }).length > 0);
  assert.ok(sourceErrors({ owner: 'a/b', repo: 'x' }).length > 0);
  assert.ok(sourceErrors({ owner: 'a', repo: '../x' }).length > 0);
});
