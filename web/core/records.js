// Validation and immutable updates for visits and odometer readings.
import { allReadings, daysBetween } from './schedule.js';
import { t } from './i18n.js';

const MAX_KM = 2000000;
const MAX_KM_PER_DAY = 1500;
const MAX_SHOP_LENGTH = 200;
const MAX_NOTE_LENGTH = 1000;
const MAX_COST = 10000000;
const VISIT_KINDS = new Set(['service', 'repair', 'mod', 'part']);

export const isValidDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

// Entries on the same date may come in any order (two shops in one day), so only
// strictly earlier and later dates are compared.
const neighbourError = (readings, { date, km }) => {
  const earlier = readings.filter((reading) => reading.date < date);
  const previous = earlier[earlier.length - 1];
  const following = readings.find((reading) => reading.date > date);
  if (previous && km < previous.km) return t('เลขไมล์ต่ำกว่าที่จดไว้เมื่อ {date} ({km} km)', { date: previous.date, km: previous.km.toLocaleString('en-US') });
  if (following && km > following.km) return t('เลขไมล์สูงกว่าที่จดไว้เมื่อ {date} ({km} km)', { date: following.date, km: following.km.toLocaleString('en-US') });
  if (previous && km - previous.km > MAX_KM_PER_DAY * (daysBetween(previous.date, date) + 1)) {
    return t('เลขไมล์เพิ่มเร็วผิดปกติ ตรวจว่าพิมพ์เกินหรือไม่');
  }
  return null;
};

// A new reading replaces one on the same date, so that one is left out of the comparison.
const comparable = (data, date, { visitId = null, replaceDate = null, isReplacingSameDate = true }) => {
  const isReplaced = (entry) => entry.date === replaceDate || (isReplacingSameDate && entry.date === date);
  return allReadings({ ...data, readings: data.readings.filter((entry) => !isReplaced(entry)) }, visitId);
};

export const validateReading = (data, reading, today, options = {}) => {
  const { date, km } = reading;
  if (!isValidDate(date)) return [t('วันที่ไม่ถูกต้อง')];
  if (date > today) return [t('วันที่ต้องไม่เกินวันนี้')];
  if (!Number.isInteger(km) || km < 0 || km > MAX_KM) return [t('เลขไมล์ต้องเป็นจำนวนเต็มบวก')];
  const error = neighbourError(comparable(data, date, options), reading);
  return error ? [error] : [];
};

const itemErrors = (data, itemIds) => {
  if (!Array.isArray(itemIds) || itemIds.length === 0) return [t('เลือกงานที่ทำอย่างน้อย 1 รายการ')];
  const known = new Set(data.items.map((item) => item.id));
  return itemIds.every((id) => known.has(id)) ? [] : [t('มีรายการงานที่ไม่รู้จัก')];
};

const detailErrors = (data, { roundKm, cost, shop = '', note = '', kind }) => [
  ...(kind === undefined || VISIT_KINDS.has(kind) ? [] : [t('หมวดไม่ถูกต้อง')]),
  ...(Number.isInteger(roundKm) && roundKm > 0 && roundKm % data.car.roundKm === 0
    ? [] : [t('รอบต้องเป็นทวีคูณของ {km} km', { km: data.car.roundKm.toLocaleString('en-US') })]),
  ...(cost === null || cost === undefined || (Number.isFinite(cost) && cost >= 0 && cost <= MAX_COST)
    ? [] : [t('ค่าใช้จ่ายไม่ถูกต้อง')]),
  ...(shop.length <= MAX_SHOP_LENGTH ? [] : [t('ชื่ออู่ยาวเกินไป')]),
  ...(note.length <= MAX_NOTE_LENGTH ? [] : [t('โน้ตยาวเกินไป')]),
];

export const validateVisit = (data, visit, today) => [
  ...validateReading(data, visit, today, { visitId: visit.id, isReplacingSameDate: false }),
  ...itemErrors(data, visit.itemIds),
  ...detailErrors(data, visit),
];

const byDate = (a, b) => a.date.localeCompare(b.date) || a.km - b.km;

export const addVisit = (data, visit) => ({
  ...data,
  visits: [...data.visits.filter((entry) => entry.id !== visit.id), visit].sort(byDate),
});

const PART_RULES = new Set(['record', 'event']);

export const isBrandable = (item) => PART_RULES.has(item.rule) || Boolean(item.intervalDays) || Boolean(item.hasBrand);

// Brands already used for an item, newest first, then the factory part. New brands join once saved.
export const knownBrands = (data, itemId) => {
  const used = data.visits
    .filter((visit) => visit.parts?.[itemId])
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((visit) => visit.parts[itemId]);
  const original = data.items.find((item) => item.id === itemId)?.originalBrand;
  return [...new Set([...used, ...(original ? [original] : [])])];
};

export const partsFrom = (entries) => Object.fromEntries(entries
  .map(([id, brand]) => [id, brand.trim()])
  .filter(([, brand]) => brand));

export const deleteVisit = (data, id) => ({
  ...data,
  visits: data.visits.filter((entry) => entry.id !== id),
});

export const updateInterval = (data, id, intervalKm, intervalMonths) => {
  const isValid = [intervalKm, intervalMonths].every((value) => Number.isInteger(value) && value > 0);
  if (!isValid) throw new Error(t('ระยะต้องเป็นจำนวนเต็มบวก'));
  return {
    ...data,
    items: data.items.map((item) => (item.id === id ? { ...item, intervalKm, intervalMonths } : item)),
  };
};

export const addReading = (data, reading) => ({
  ...data,
  readings: [...data.readings.filter((entry) => entry.date !== reading.date), reading].sort(byDate),
});

export const deleteReading = (data, date) => ({
  ...data,
  readings: data.readings.filter((entry) => entry.date !== date),
});

export const updateReading = (data, oldDate, reading) => addReading(deleteReading(data, oldDate), reading);
