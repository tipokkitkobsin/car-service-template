// The item list offered on first setup. Typical figures only: owners should check their own service book.
// isDefault: ticked at the start. gearbox: shown ticked only for that gearbox type.
const ENGINE = 'เครื่องยนต์';
const GEARBOX = 'เกียร์';
const BRAKES = 'เบรก';
const COOLING = 'ระบายความร้อน';
const AIRCON = 'แอร์';
const TYRES = 'ยาง';
const SUSPENSION = 'ช่วงล่าง';
const ELECTRIC = 'ไฟฟ้า';

const every = (intervalKm, intervalMonths) => ({ rule: 'interval', intervalKm, intervalMonths });
const ageOnly = { rule: 'record' };

export const STARTER_ITEMS = [
  { id: 'engine-oil', name: 'น้ำมันเครื่อง', group: ENGINE, ...every(10000, 6), hasBrand: true, isDefault: true },
  { id: 'oil-filter', name: 'กรองน้ำมันเครื่อง', group: ENGINE, ...every(10000, 6), hasBrand: true, isDefault: true },
  { id: 'oil-drain-washer', name: 'แหวนรองน็อตถ่ายน้ำมันเครื่อง', group: ENGINE, ...every(10000, 6), isDefault: false },
  { id: 'air-filter', name: 'กรองอากาศ', group: ENGINE, ...every(20000, 12), hasBrand: true, isDefault: true },
  { id: 'spark-plugs', name: 'หัวเทียน', group: ENGINE, ...every(40000, 24), hasBrand: true, isDefault: true },
  { id: 'atf', name: 'น้ำมันเกียร์ออโต้', group: GEARBOX, ...every(40000, 24), hasBrand: true, isDefault: true, gearbox: 'auto' },
  { id: 'manual-gear-oil', name: 'น้ำมันเกียร์ธรรมดา', group: GEARBOX, ...every(40000, 24), hasBrand: true, isDefault: true, gearbox: 'manual' },
  { id: 'brake-fluid', name: 'น้ำมันเบรก', group: BRAKES, ...every(40000, 24), hasBrand: true, isDefault: true },
  { id: 'coolant', name: 'น้ำยาหม้อน้ำ', group: COOLING, ...every(40000, 24), hasBrand: true, isDefault: true },
  { id: 'cabin-filter', name: 'กรองแอร์', group: AIRCON, rule: 'calendar', calendarMonth: 1, hasBrand: true, isDefault: true },
  { id: 'ac-clean', name: 'ล้างแอร์', group: AIRCON, ...every(20000, 12), isDefault: false },
  { id: 'tyre-rotate', name: 'สลับยาง', group: TYRES, ...every(10000, 6), isDefault: true },
  { id: 'tyre-replace', name: 'เปลี่ยนยาง', group: TYRES, ...ageOnly, hasBrand: true, isDefault: true },
  { id: 'battery', name: 'แบตเตอรี่', group: ELECTRIC, rule: 'interval', intervalDays: 730, isSoft: true, hasBrand: true, isDefault: true },
  { id: 'brake-pad-front', name: 'ผ้าเบรกหน้า', group: BRAKES, ...ageOnly, hasBrand: true, isDefault: true },
  { id: 'brake-pad-rear', name: 'ผ้าเบรกหลัง', group: BRAKES, ...ageOnly, hasBrand: true, isDefault: true },
  { id: 'brake-disc-front', name: 'จานเบรกหน้า', group: BRAKES, ...ageOnly, hasBrand: true, isDefault: false },
  { id: 'brake-disc-rear', name: 'จานเบรกหลัง', group: BRAKES, ...ageOnly, hasBrand: true, isDefault: false },
  { id: 'shock-front', name: 'โช็คอัพหน้า', group: SUSPENSION, ...ageOnly, hasBrand: true, isDefault: false },
  { id: 'shock-rear', name: 'โช็คอัพหลัง', group: SUSPENSION, ...ageOnly, hasBrand: true, isDefault: false },
];

export const GEARBOXES = { auto: 'ออโต้', manual: 'ธรรมดา' };

export const defaultPicks = (gearbox) => STARTER_ITEMS
  .filter((item) => item.isDefault && (!item.gearbox || item.gearbox === gearbox))
  .map((item) => item.id);

export const starterItem = (id) => {
  const found = STARTER_ITEMS.find((item) => item.id === id);
  if (!found) return null;
  const { isDefault, gearbox, ...item } = found;
  return item;
};
