// Daily job. Run by .github/workflows/remind.yml with the data repo checked out as the working directory.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { todayInBangkok } from '../web/core/schedule.js';
import { runReminders } from './run.js';
import { readJson } from './state.js';
import { carIdFromFile, carPath, MAIN_CAR, stateFileFor } from '../web/core/garage.js';
import { setLanguage, t } from '../web/core/i18n.js';

const DISCORD_API = 'https://discord.com/api/v10';
const MAX_RETRY_SECONDS = 30;

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
};

const wait = (seconds) => new Promise((resolve) => { setTimeout(resolve, seconds * 1000); });

const createSender = (token, channelId) => {
  const post = (payload) => fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return async (payload) => {
    let response = await post(payload);
    if (response.status === 429) {
      const { retry_after: retryAfter = 1 } = await response.json();
      await wait(Math.min(retryAfter, MAX_RETRY_SECONDS));
      response = await post(payload);
    }
    if (!response.ok) throw new Error(`Discord refused the message (${response.status})`);
  };
};

const testMessage = () => ({
  content: t('ทดสอบการแจ้งเตือนเช็คระยะ: GitHub Actions ส่งเข้าห้องนี้ได้แล้ว'),
  allowed_mentions: { parse: [] },
});

const listCarIds = async () => {
  const names = await readJson(async () => JSON.stringify(await readdir('data')), []);
  return names.map(carIdFromFile).filter(Boolean).sort((a, b) => (a === MAIN_CAR ? -1 : b === MAIN_CAR ? 1 : a.localeCompare(b)));
};

// One run per car, each with its own state file and language. Names are shown only when there are several cars.
const remindCar = async ({ id, showName, send, today }) => {
  const data = await readJson(() => readFile(carPath(id), 'utf8'), null);
  if (!data) return;
  setLanguage(data.car.language);
  const stateFile = stateFileFor(id);
  const state = await readJson(() => readFile(stateFile, 'utf8'), {});
  const save = (next) => writeFile(stateFile, `${JSON.stringify(next, null, 2)}\n`);
  await runReminders({
    data, state, today, siteUrl: requireEnv('SITE_URL'), send, save, car: showName ? { id, name: data.car.name } : null,
  });
};

const main = async () => {
  const send = createSender(requireEnv('DISCORD_BOT_TOKEN'), requireEnv('DISCORD_CHANNEL_ID'));
  const ids = await listCarIds();
  if (process.env.REMIND_TEST === 'true') {
    const first = ids.length ? await readJson(() => readFile(carPath(ids[0]), 'utf8'), null) : null;
    setLanguage(first?.car.language);
    await send(testMessage());
    console.log('Test message sent');
    return;
  }
  if (ids.length === 0) {
    console.log('No car data yet: open the site and finish the first-run setup');
    return;
  }
  await mkdir('data', { recursive: true });
  const today = todayInBangkok();
  for (const id of ids) {
    await remindCar({ id, showName: ids.length > 1, send, today });
  }
};

main().catch((error) => {
  console.error(`Reminder failed: ${error.message}`);
  process.exitCode = 1;
});
