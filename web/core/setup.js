// Builds the first car.json from the setup form.
// Items without a "last done" entry count as done on the setup day (the owner's chosen starting point).
import { isValidDate } from './records.js';
import { starterItem } from './starter-items.js';

const MAX_KM = 2000000;
const MAX_ROUND_KM = 100000;
const MAX_ROUND_MONTHS = 60;
const MAX_NAME_LENGTH = 80;
const DEFAULT_KM_PER_DAY = 40;
const ANCHOR_ID = 'engine-oil';

const isKm = (value, max = MAX_KM) => Number.isInteger(value) && value >= 0 && value <= max;
const isPositive = (value, max) => Number.isInteger(value) && value > 0 && value <= max;

const pickErrors = (pick, form, today) => {
  const item = starterItem(pick.id);
  if (!item) return ['มีรายการที่ไม่รู้จัก'];
  return [
    ...(pick.lastDate && !(isValidDate(pick.lastDate) && pick.lastDate <= today)
      ? [`${item.name}: วันที่ทำล่าสุดไม่ถูกต้อง`] : []),
    ...(pick.lastKm !== undefined && pick.lastKm !== null && !(isKm(pick.lastKm) && pick.lastKm <= form.currentKm)
      ? [`${item.name}: เลขไมล์ที่ทำล่าสุดต้องไม่เกินเลขไมล์ปัจจุบัน`] : []),
  ];
};

export const validateSetup = (form, today) => {
  const name = typeof form.name === 'string' ? form.name.trim() : '';
  const picks = Array.isArray(form.picks) ? form.picks : [];
  return [
    ...(name && name.length <= MAX_NAME_LENGTH ? [] : ['ใส่ชื่อรถ ไม่เกิน 80 ตัวอักษร']),
    ...(isValidDate(form.deliveredOn) && form.deliveredOn <= today ? [] : ['วันรับรถต้องเป็นวันที่ที่ผ่านมาแล้ว']),
    ...(isKm(form.currentKm) ? [] : ['เลขไมล์ปัจจุบันต้องเป็นจำนวนเต็มบวก']),
    ...(isPositive(form.roundKm, MAX_ROUND_KM) ? [] : ['ระยะรอบเช็คต้องเป็นจำนวนเต็มบวก']),
    ...(isPositive(form.roundMonths, MAX_ROUND_MONTHS) ? [] : ['จำนวนเดือนของรอบต้องเป็นจำนวนเต็มบวก']),
    ...(picks.length ? [] : ['เลือกรายการอย่างน้อย 1 รายการ']),
    ...picks.flatMap((pick) => pickErrors(pick, form, today)),
  ];
};

// The most recent first day of the item's month, on or before today.
const lastCalendarDate = (month, today) => {
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-${String(month).padStart(2, '0')}-01`;
  return thisYear <= today ? thisYear : `${year - 1}-${String(month).padStart(2, '0')}-01`;
};

// Where an item's count starts when it has no visit yet. Also used for items added later.
export const assumedLastFor = (item, { lastDate, lastKm } = {}, currentKm, today) => {
  if (item.rule === 'record' || item.rule === 'event') return undefined;
  if (item.rule === 'calendar') return { date: lastDate || lastCalendarDate(item.calendarMonth, today) };
  return { date: lastDate || today, km: lastKm ?? currentKm };
};

const itemFor = (pick, form, today) => {
  const item = starterItem(pick.id);
  const assumedLast = assumedLastFor(item, pick, form.currentKm, today);
  return assumedLast ? { ...item, assumedLast } : item;
};

export const buildCar = (form, today) => {
  const items = form.picks.map((pick) => itemFor(pick, form, today));
  const hasAnchor = items.some((item) => item.id === ANCHOR_ID);
  return {
    version: 1,
    car: {
      name: form.name.trim(),
      deliveredOn: form.deliveredOn,
      // The last round already passed, so the next round is the one just above the current km.
      baselineKm: Math.floor(form.currentKm / form.roundKm) * form.roundKm,
      roundKm: form.roundKm,
      roundMonths: form.roundMonths,
      defaultKmPerDay: DEFAULT_KM_PER_DAY,
      ...(hasAnchor ? { anchorItemId: ANCHOR_ID } : {}),
    },
    items,
    visits: [],
    readings: [{ date: today, km: form.currentKm }],
  };
};
