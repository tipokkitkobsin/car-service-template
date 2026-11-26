// Bot logic with no Discord dependency, so it can be tested directly.
import { addReading, deleteReading, validateReading } from '../../web/core/records.js';
import {
  buildStatuses, dueText, estimateKm, formatKm, leftText, sortByUrgency, usageOf, usageText,
} from '../../web/core/schedule.js';
import { t } from '../../web/core/i18n.js';

const MAX_REPLY = 1900;

class RejectedReading extends Error {}

export const parseKm = (raw) => {
  const clean = String(raw).replace(/[,\s]/g, '');
  return /^\d{1,7}$/.test(clean) ? Number(clean) : null;
};

export const isAllowed = ({ userId, channelId }, config) => (
  userId === config.ownerId && channelId === config.channelId
);

// Returns the reply text and, when saved, the reading so the bot can offer an undo button.
export const recordKm = async ({ raw, store, today }) => {
  const km = parseKm(raw);
  if (km === null) return { text: t('กรุณาพิมพ์เลขไมล์เป็นตัวเลข เช่น 115000') };
  const reading = { date: today, km };
  try {
    await store.update((data) => {
      const errors = validateReading(data, reading, today);
      if (errors.length) throw new RejectedReading(errors[0]);
      return addReading(data, reading);
    }, `km: ${km} (discord)`);
  } catch (error) {
    if (error instanceof RejectedReading) return { text: t('ไม่ได้บันทึก: {reason}', { reason: error.message }) };
    throw error;
  }
  return {
    text: t('บันทึกเลขไมล์ {km} km แล้ว · ถ้าผิด ให้กด "แก้" หรือพิมพ์ /km ใหม่วันนี้ ค่าใหม่จะแทนค่าเดิม', { km: formatKm(km) }),
    reading,
  };
};

export const undoKm = async ({ date, km, store }) => {
  try {
    await store.update((data) => {
      const isPresent = data.readings.some((entry) => entry.date === date && entry.km === km);
      if (!isPresent) throw new RejectedReading('missing');
      return deleteReading(data, date);
    }, `km: delete ${date} ${km} (discord)`);
  } catch (error) {
    if (error instanceof RejectedReading) return t('ไม่พบรายการนี้แล้ว อาจถูกแก้หรือลบไปก่อน');
    throw error;
  }
  return t('ลบเลขไมล์ {km} km ของวันที่ {date} แล้ว', { km: formatKm(km), date });
};

export const statusText = async ({ store, today }) => {
  const { data } = await store.load();
  const estimate = estimateKm(data, today);
  const all = sortByUrgency(buildStatuses(data, today));
  const rows = all.filter((row) => ['overdue', 'watch', 'check', 'soon'].includes(row.state));
  const lines = rows.map((row) => `• **${row.item.name}** ${row.state === 'check' ? t('ต้องตรวจ') : `${dueText(row)} (${leftText(row)})`}`);
  const ages = all
    .map((row) => ({ row, usage: row.state === 'record' ? usageOf(row, data, today) : null }))
    .filter(({ usage }) => usage)
    .map(({ row, usage }) => `• **${row.item.name}** ${usageText(usage)}`);
  const head = (estimate.isEstimated ? t('เลขไมล์ประมาณ {km} km', { km: formatKm(estimate.km) }) : t('เลขไมล์ {km} km', { km: formatKm(estimate.km) }));
  return [
    head,
    ...(lines.length ? lines : [t('ไม่มีงานค้าง')]),
    ...(ages.length ? ['', t('**อายุการใช้งาน**'), ...ages] : []),
  ].join('\n').slice(0, MAX_REPLY);
};
