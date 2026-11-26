// Daily job. Run by .github/workflows/remind.yml with the data repo checked out as the working directory.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { todayInBangkok } from '../web/core/schedule.js';
import { runReminders } from './run.js';
import { readJson } from './state.js';
import { setLanguage, t } from '../web/core/i18n.js';

const DATA_FILE = 'data/car.json';
const STATE_FILE = 'data/reminder-state.json';
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

const main = async () => {
  const send = createSender(requireEnv('DISCORD_BOT_TOKEN'), requireEnv('DISCORD_CHANNEL_ID'));
  const data = await readJson(() => readFile(DATA_FILE, 'utf8'), null);
  // Messages follow the language saved with the car data.
  setLanguage(data?.car.language);
  if (process.env.REMIND_TEST === 'true') {
    await send(testMessage());
    console.log('Test message sent');
    return;
  }
  if (!data) {
    console.log('No car data yet: open the site and finish the first-run setup');
    return;
  }
  const state = await readJson(() => readFile(STATE_FILE, 'utf8'), {});
  await mkdir('data', { recursive: true });
  const save = (next) => writeFile(STATE_FILE, `${JSON.stringify(next, null, 2)}\n`);
  await runReminders({
    data, state, today: todayInBangkok(), siteUrl: requireEnv('SITE_URL'), send, save,
  });
};

main().catch((error) => {
  console.error(`Reminder failed: ${error.message}`);
  process.exitCode = 1;
});
