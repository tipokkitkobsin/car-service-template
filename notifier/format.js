// Turns a planned reminder into a Discord message.
import { dueText, formatDate, formatKm, leftText } from '../web/core/schedule.js';

const MAX_CONTENT = 2000;
const RESERVED = 120;
const BUTTON = 2;
const ACTION_ROW = 1;
const STYLE_PRIMARY = 1;
const STYLE_LINK = 5;
const TITLES = {
  soon: '**ใกล้ถึงกำหนดเช็คระยะ**',
  watch: '**เข้าช่วงระวัง** ตรวจสภาพหรือเตรียมเปลี่ยน',
  overdue: '**สรุปงานเกินกำหนด** (ยกยอดไปรอบถัดไปจนกว่าจะบันทึกว่าทำแล้ว)',
};

const lineFor = (row) => `• **${row.item.name}** ${dueText(row)} (${leftText(row)})`;

const fitLines = (lines) => {
  const kept = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length + 1 > MAX_CONTENT - RESERVED) break;
    kept.push(line);
    used += line.length + 1;
  }
  const hidden = lines.length - kept.length;
  return hidden > 0 ? [...kept, `และอีก ${hidden} รายการในเว็บ`] : kept;
};

const linkButton = (siteUrl) => ({ type: BUTTON, style: STYLE_LINK, label: 'เปิดเว็บ', url: siteUrl });
const kmButton = { type: BUTTON, style: STYLE_PRIMARY, label: 'กรอกเลขไมล์', custom_id: 'km:open' };

const payload = (content, buttons) => ({
  content,
  allowed_mentions: { parse: [] },
  components: [{ type: ACTION_ROW, components: buttons }],
});

export const formatMessage = (message, siteUrl) => {
  if (message.kind === 'askKm') {
    const since = message.lastReadingDate ? ` จดล่าสุด ${formatDate(message.lastReadingDate)}` : '';
    return payload(
      `**ตอนนี้เลขไมล์เท่าไหร่?**\nระบบประมาณไว้ ${formatKm(message.estimateKm)} km${since}\nกดปุ่ม หรือพิมพ์ \`/km 115000\``,
      [kmButton, linkButton(siteUrl)],
    );
  }
  const lines = fitLines(message.rows.map(lineFor));
  return payload([TITLES[message.kind], ...lines].join('\n'), [linkButton(siteUrl), kmButton]);
};
