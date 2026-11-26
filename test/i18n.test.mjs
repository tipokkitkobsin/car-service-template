import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { getLanguage, pickLanguage, setLanguage, t } from '../web/core/i18n.js';
import { en } from '../web/core/lang/en.js';

const SOURCE_DIRS = ['web/core', 'web/js', 'notifier', 'bot/src'];
const THAI = /[฀-๿]/;

const sourceFiles = async () => (await Promise.all(SOURCE_DIRS.map(async (dir) => (await readdir(dir))
  .filter((name) => /\.(m?js)$/.test(name)).map((name) => `${dir}/${name}`)))).flat()
  .filter((path) => !path.includes('/lang/'));

test('t keeps Thai by default and fills in values', () => {
  setLanguage('th');
  assert.equal(t('เหลือ {days} วัน', { days: 3 }), 'เหลือ 3 วัน');
});

test('t translates to English and fills in values', () => {
  setLanguage('en');
  assert.equal(t('เหลือ {days} วัน', { days: 3 }), '3 days left');
  setLanguage('th');
});

test('a context after | is dropped in Thai and used to pick the English text', () => {
  setLanguage('th');
  assert.equal(t('บันทึก|nav'), 'บันทึก');
  setLanguage('en');
  assert.equal(t('บันทึก|nav'), 'Log');
  assert.equal(t('บันทึก'), 'Save');
  setLanguage('th');
});

test('setLanguage ignores unknown languages', () => {
  setLanguage('xx');
  assert.equal(getLanguage(), 'th');
});

test('pickLanguage prefers the saved choice, then the browser', () => {
  assert.equal(pickLanguage('en', 'th-TH'), 'en');
  assert.equal(pickLanguage(null, 'th-TH'), 'th');
  assert.equal(pickLanguage(null, 'en-GB'), 'en');
  assert.equal(pickLanguage('xx', 'fr'), 'en');
});

test('every t() text in the code has an English translation', async () => {
  const missing = [];
  for (const path of await sourceFiles()) {
    const code = await readFile(path, 'utf8');
    for (const [, key] of code.matchAll(/\b(?:t|tx)\('((?:[^'\\]|\\.)*)'/g)) {
      const text = key.replace(/\\n/g, '\n').replace(/\\'/g, "'");
      if (!(text in en)) missing.push(`${path}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('no Thai text is left outside t() in code files', async () => {
  const leftovers = [];
  for (const path of await sourceFiles()) {
    const lines = (await readFile(path, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      if (line.includes('i18n-ignore')) return;
      const stripped = line.replace(/\b(?:t|tx)\('((?:[^'\\]|\\.)*)'/g, '').replace(/\/\/.*$/, '');
      if (THAI.test(stripped)) leftovers.push(`${path}:${index + 1}`);
    });
  }
  assert.deepEqual(leftovers, []);
});

test('English translations have the same placeholders as the Thai text', () => {
  const holes = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',');
  const wrong = Object.entries(en).filter(([th, english]) => holes(th) !== holes(english)).map(([th]) => th);
  assert.deepEqual(wrong, []);
});

test('translateTo gives one text in another language and keeps the current one', async () => {
  const { translateTo } = await import('../web/core/i18n.js');
  setLanguage('th');
  assert.equal(translateTo('en', 'ภาพรวม'), 'Overview');
  assert.equal(getLanguage(), 'th');
});
