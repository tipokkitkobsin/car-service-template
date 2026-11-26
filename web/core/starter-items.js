// The item list offered on first setup. Typical figures only: owners should check their own service book.
import { tx } from './i18n.js';
// isDefault: ticked at the start. gearbox: shown ticked only for that gearbox type.
const ENGINE = tx('เครื่องยนต์');
const GEARBOX = tx('เกียร์');
const BRAKES = tx('เบรก');
const COOLING = tx('ระบายความร้อน');
const AIRCON = tx('แอร์');
const TYRES = tx('ยาง');
const SUSPENSION = tx('ช่วงล่าง');
const ELECTRIC = tx('ไฟฟ้า');

const every = (intervalKm, intervalMonths) => ({ rule: 'interval', intervalKm, intervalMonths });
const ageOnly = { rule: 'record' };

export const STARTER_ITEMS = [
  { id: 'engine-oil', name: tx('น้ำมันเครื่อง'), group: ENGINE, ...every(10000, 6), hasBrand: true, isDefault: true },
  { id: 'oil-filter', name: tx('กรองน้ำมันเครื่อง'), group: ENGINE, ...every(10000, 6), hasBrand: true, isDefault: true },
  { id: 'oil-drain-washer', name: tx('แหวนรองน็อตถ่ายน้ำมันเครื่อง'), group: ENGINE, ...every(10000, 6), isDefault: false },
  { id: 'air-filter', name: tx('กรองอากาศ'), group: ENGINE, ...every(20000, 12), hasBrand: true, isDefault: true },
  { id: 'spark-plugs', name: tx('หัวเทียน'), group: ENGINE, ...every(40000, 24), hasBrand: true, isDefault: true },
  { id: 'atf', name: tx('น้ำมันเกียร์ออโต้'), group: GEARBOX, ...every(40000, 24), hasBrand: true, isDefault: true, gearbox: 'auto' },
  { id: 'manual-gear-oil', name: tx('น้ำมันเกียร์ธรรมดา'), group: GEARBOX, ...every(40000, 24), hasBrand: true, isDefault: true, gearbox: 'manual' },
  { id: 'brake-fluid', name: tx('น้ำมันเบรก'), group: BRAKES, ...every(40000, 24), hasBrand: true, isDefault: true },
  { id: 'coolant', name: tx('น้ำยาหม้อน้ำ'), group: COOLING, ...every(40000, 24), hasBrand: true, isDefault: true },
  { id: 'cabin-filter', name: tx('กรองแอร์'), group: AIRCON, rule: 'calendar', calendarMonth: 1, hasBrand: true, isDefault: true },
  { id: 'ac-clean', name: tx('ล้างแอร์'), group: AIRCON, ...every(20000, 12), isDefault: false },
  { id: 'tyre-rotate', name: tx('สลับยาง'), group: TYRES, ...every(10000, 6), isDefault: true },
  { id: 'tyre-replace', name: tx('เปลี่ยนยาง'), group: TYRES, ...ageOnly, hasBrand: true, isDefault: true },
  { id: 'battery', name: tx('แบตเตอรี่'), group: ELECTRIC, rule: 'interval', intervalDays: 730, isSoft: true, hasBrand: true, isDefault: true },
  { id: 'brake-pad-front', name: tx('ผ้าเบรกหน้า'), group: BRAKES, ...ageOnly, hasBrand: true, isDefault: true },
  { id: 'brake-pad-rear', name: tx('ผ้าเบรกหลัง'), group: BRAKES, ...ageOnly, hasBrand: true, isDefault: true },
  { id: 'brake-disc-front', name: tx('จานเบรกหน้า'), group: BRAKES, ...ageOnly, hasBrand: true, isDefault: false },
  { id: 'brake-disc-rear', name: tx('จานเบรกหลัง'), group: BRAKES, ...ageOnly, hasBrand: true, isDefault: false },
  { id: 'shock-front', name: tx('โช็คอัพหน้า'), group: SUSPENSION, ...ageOnly, hasBrand: true, isDefault: false },
  { id: 'shock-rear', name: tx('โช็คอัพหลัง'), group: SUSPENSION, ...ageOnly, hasBrand: true, isDefault: false },
];

export const GEARBOXES = { auto: tx('ออโต้'), manual: tx('ธรรมดา') };

export const defaultPicks = (gearbox) => STARTER_ITEMS
  .filter((item) => item.isDefault && (!item.gearbox || item.gearbox === gearbox))
  .map((item) => item.id);

export const starterItem = (id) => {
  const found = STARTER_ITEMS.find((item) => item.id === id);
  if (!found) return null;
  const { isDefault, gearbox, ...item } = found;
  return item;
};
