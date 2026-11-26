// Synthetic data only. This repository is public: never put a real car's history here.
export const makeData = (overrides = {}) => ({
  version: 1,
  car: {
    name: 'Test car',
    deliveredOn: '2021-01-10',
    baselineKm: 100000,
    roundKm: 10000,
    roundMonths: 6,
    defaultKmPerDay: 40,
  },
  items: [
    { id: 'oil', name: 'Oil', rule: 'interval', intervalKm: 10000, intervalMonths: 6 },
    { id: 'plug', name: 'Plug', rule: 'interval', intervalKm: 60000, intervalMonths: 36 },
    { id: 'coolant', name: 'Coolant', rule: 'interval', intervalKm: 200000, intervalMonths: 120 },
    { id: 'cabin', name: 'Cabin', rule: 'calendar', calendarMonth: 1, assumedLast: { date: '2026-01-01' } },
    { id: 'cloth', name: 'Cloth', rule: 'inspect', intervalKm: 10000, intervalMonths: 6 },
    { id: 'tyre', name: 'Tyre', rule: 'record' },
  ],
  visits: [],
  readings: [],
  ...overrides,
});

export const visit = (id, date, km, itemIds, roundKm = 110000) => ({
  id, date, km, itemIds, roundKm, shop: '', cost: null, note: '',
});
