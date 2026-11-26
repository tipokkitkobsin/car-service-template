// Validation and immutable updates for maintenance items and car details.
import { isValidDate } from './records.js';

export const RULES = ['interval', 'calendar', 'inspect', 'record', 'event'];

const MAX_NAME_LENGTH = 80;
const MAX_GROUP_LENGTH = 40;
const MAX_KM = 1000000;
const MAX_MONTHS = 240;
const MAX_DAYS = 7300;
const ID_SUFFIX_LENGTH = 4;
const COMMON_FIELDS = ['id', 'name', 'group', 'rule', 'qty', 'price', 'hasBrand', 'originalBrand', 'assumedLast'];
const RULE_FIELDS = {
  interval: ['intervalKm', 'intervalMonths', 'intervalDays', 'isSoft'],
  inspect: ['intervalKm', 'intervalMonths'],
  calendar: ['calendarMonth'],
  record: [],
  event: [],
};
const CAR_FIELDS = ['name', 'deliveredOn', 'roundKm', 'roundMonths'];

const isWhole = (value, max) => Number.isInteger(value) && value > 0 && value <= max;

const intervalErrors = (item) => {
  const hasKmMonths = item.intervalKm !== undefined || item.intervalMonths !== undefined;
  if (item.rule === 'interval' && item.intervalDays !== undefined && !hasKmMonths) {
    return isWhole(item.intervalDays, MAX_DAYS) ? [] : ['จำนวนวันต้องเป็นจำนวนเต็มบวก'];
  }
  return [
    ...(isWhole(item.intervalKm, MAX_KM) ? [] : ['ระยะ km ต้องเป็นจำนวนเต็มบวก']),
    ...(isWhole(item.intervalMonths, MAX_MONTHS) ? [] : ['จำนวนเดือนต้องเป็นจำนวนเต็มบวก']),
  ];
};

const ruleErrors = (item) => {
  if (!RULES.includes(item.rule)) return ['แบบของรายการไม่ถูกต้อง'];
  if (item.rule === 'interval' || item.rule === 'inspect') return intervalErrors(item);
  if (item.rule === 'calendar') return isWhole(item.calendarMonth, 12) ? [] : ['เดือนต้องอยู่ระหว่าง 1-12'];
  return [];
};

// The starting point of an item with no visit yet: a past date, and a whole km when given.
const startErrors = (start, today) => {
  if (start === undefined) return [];
  const isDateOk = isValidDate(start.date) && (!today || start.date <= today);
  const isKmOk = start.km === undefined || start.km === null || (Number.isInteger(start.km) && start.km >= 0 && start.km <= MAX_KM);
  return [
    ...(isDateOk ? [] : ['วันที่ทำล่าสุดต้องเป็นวันที่ที่ผ่านมาแล้ว']),
    ...(isKmOk ? [] : ['เลขไมล์ที่ทำล่าสุดต้องเป็นจำนวนเต็มบวก']),
  ];
};

export const validateItem = (item, today) => {
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  const group = item.group ?? '';
  return [
    ...(name && name.length <= MAX_NAME_LENGTH ? [] : ['ต้องมีชื่อรายการ ไม่เกิน 80 ตัวอักษร']),
    ...(typeof group === 'string' && group.length <= MAX_GROUP_LENGTH ? [] : ['ชื่อหมวดยาวเกินไป']),
    ...ruleErrors(item),
    ...startErrors(item.assumedLast, today),
  ];
};

// Keeps only the fields that mean something for the item's rule.
const cleanItem = (item) => {
  const allowed = new Set([...COMMON_FIELDS, ...(RULE_FIELDS[item.rule] ?? [])]);
  return Object.fromEntries(Object.entries(item)
    .filter(([key, value]) => allowed.has(key) && value !== undefined && value !== '')
    .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
};

const checked = (item, today) => {
  const errors = validateItem(item, today);
  if (errors.length) throw new Error(errors.join(' · '));
  return item;
};

const slugOf = (name) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

export const makeItemId = (name, existingIds, random = Math.random) => {
  const base = slugOf(String(name)) || 'item';
  const taken = new Set(existingIds);
  for (;;) {
    const suffix = Math.floor(random() * 36 ** ID_SUFFIX_LENGTH).toString(36).padStart(ID_SUFFIX_LENGTH, '0');
    const id = `${base}-${suffix}`;
    if (!taken.has(id)) return id;
  }
};

export const itemInUse = (data, id) => data.visits.some((visit) => visit.itemIds.includes(id));

export const addItem = (data, item, today) => {
  if (data.items.some((entry) => entry.id === item.id)) throw new Error('รหัสรายการซ้ำ');
  return { ...data, items: [...data.items, checked(cleanItem(item), today)] };
};

export const updateItem = (data, id, changes, today) => {
  if (!data.items.some((item) => item.id === id)) throw new Error('ไม่พบรายการนี้');
  return {
    ...data,
    items: data.items.map((item) => (item.id === id ? checked(cleanItem({ ...item, ...changes, id }), today) : item)),
  };
};

export const deleteItem = (data, id) => {
  if (itemInUse(data, id)) throw new Error('ลบไม่ได้ เพราะมีประวัติใช้รายการนี้');
  return { ...data, items: data.items.filter((item) => item.id !== id) };
};

const carErrors = (car) => [
  ...(typeof car.name === 'string' && car.name.trim() && car.name.length <= MAX_NAME_LENGTH ? [] : ['ต้องมีชื่อรถ']),
  ...(isValidDate(car.deliveredOn) ? [] : ['วันรับรถไม่ถูกต้อง']),
  ...(isWhole(car.roundKm, MAX_KM) ? [] : ['ระยะรอบเช็คต้องเป็นจำนวนเต็มบวก']),
  ...(isWhole(car.roundMonths, MAX_MONTHS) ? [] : ['จำนวนเดือนของรอบต้องเป็นจำนวนเต็มบวก']),
];

export const updateCar = (data, changes) => {
  const allowed = Object.fromEntries(Object.entries(changes).filter(([key]) => CAR_FIELDS.includes(key)));
  const car = { ...data.car, ...allowed, name: String(allowed.name ?? data.car.name).trim() };
  const errors = carErrors(car);
  if (errors.length) throw new Error(errors.join(' · '));
  return { ...data, car };
};
