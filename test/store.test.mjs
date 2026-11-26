import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, decodeJson, encodeJson } from '../web/core/github-store.js';

const json = (status, body) => new Response(JSON.stringify(body), { status });
const config = { owner: 'o', repo: 'r', path: 'data/x.json', token: 't' };

test('base64 round trip keeps Thai text', () => {
  const value = { name: 'น้ำมันเครื่อง' };
  assert.deepEqual(decodeJson(encodeJson(value)), value);
});

test('update retries once after a conflict using fresh data', async () => {
  let reads = 0;
  let writes = 0;
  const fetchFn = async (_url, options = {}) => {
    if (options.method === 'PUT') {
      writes += 1;
      return writes === 1 ? json(409, { message: 'conflict' }) : json(200, { content: { sha: 's3' } });
    }
    reads += 1;
    return json(200, { sha: `s${reads}`, content: encodeJson({ count: reads }) });
  };
  const store = createStore({ ...config, fetchFn });
  const result = await store.update((data) => ({ count: data.count + 10 }), 'msg');
  assert.equal(reads, 2);
  assert.equal(result.data.count, 12);
});

test('a bad token gives a clear error without the token in it', async () => {
  const store = createStore({ ...config, token: 'secret-value', fetchFn: async () => json(401, {}) });
  await assert.rejects(store.load(), (error) => {
    assert.equal(error.code, 'auth');
    assert.ok(!error.message.includes('secret-value'));
    return true;
  });
});

test('update stops after too many conflicts', async () => {
  const fetchFn = async (_url, options = {}) => (options.method === 'PUT'
    ? json(409, {})
    : json(200, { sha: 's', content: encodeJson({}) }));
  const store = createStore({ ...config, fetchFn });
  await assert.rejects(store.update((data) => data, 'msg'), (error) => error.code === 'conflict');
});

test('create sends the file without a sha', async () => {
  let sent = null;
  const fetchFn = async (_url, options = {}) => {
    sent = JSON.parse(options.body);
    return json(201, { content: { sha: 'new' } });
  };
  const store = createStore({ ...config, fetchFn });
  const saved = await store.create({ version: 1 }, 'setup');
  assert.equal(saved.sha, 'new');
  assert.equal('sha' in sent, false);
  assert.equal(sent.message, 'setup');
});

test('repoStatus tells private, public and missing repos apart', async () => {
  const answer = (status, body) => createStore({ ...config, fetchFn: async () => json(status, body) });
  assert.equal(await answer(200, { private: true }).repoStatus(), 'private');
  assert.equal(await answer(200, { private: false }).repoStatus(), 'public');
  assert.equal(await answer(404, {}).repoStatus(), 'missing');
  await assert.rejects(answer(401, {}).repoStatus(), { code: 'auth' });
});
