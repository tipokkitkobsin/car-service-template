// Several cars in one data repo: the first car is data/car.json, the others data/car-<id>.json.
import { buildStatuses, estimateKm, sortByUrgency } from './schedule.js';
import { roundProgress } from './insights.js';

export const MAIN_CAR = 'main';
const CAR_FILE = /^car(?:-([a-z0-9]+(?:-[a-z0-9]+)*))?\.json$/;
const URGENT_STATES = ['overdue', 'watch', 'check', 'soon'];
const URGENT_SHOWN = 2;
const MAX_ID_LENGTH = 30;

export const carPath = (id) => (id === MAIN_CAR ? 'data/car.json' : `data/car-${id}.json`);

export const stateFileFor = (id) => (id === MAIN_CAR ? 'data/reminder-state.json' : `data/reminder-state-${id}.json`);

// The car id for a file name in data/, or null when the file is not a car.
export const carIdFromFile = (name) => {
  const match = CAR_FILE.exec(name);
  if (!match) return null;
  return match[1] ?? MAIN_CAR;
};

export const makeCarId = (name, existingIds) => {
  const base = String(name).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, MAX_ID_LENGTH).replace(/-+$/g, '') || 'car';
  const taken = new Set(existingIds);
  if (!taken.has(base) && base !== 'car') return base;
  for (let number = 2; ; number += 1) {
    const id = `${base}-${number}`;
    if (!taken.has(id)) return id;
  }
};

const countStates = (rows) => Object.fromEntries(URGENT_STATES.map((state) => [state, rows.filter((row) => row.state === state).length]));

const severity = (counts) => [counts.overdue, counts.watch, counts.check, counts.soon];

const compareSeverity = (a, b) => {
  const left = severity(a.counts);
  const right = severity(b.counts);
  const index = left.findIndex((value, position) => value !== right[position]);
  return index === -1 ? 0 : right[index] - left[index];
};

// One card per car for the all-cars overview, most urgent car first.
export const garageSummary = (cars, today) => cars.map(({ id, data }) => {
  const rows = sortByUrgency(buildStatuses(data, today));
  const urgent = rows.filter((row) => URGENT_STATES.includes(row.state));
  return {
    id,
    name: data.car.name,
    km: estimateKm(data, today).km,
    isKmEstimated: estimateKm(data, today).isEstimated,
    progress: roundProgress(data, today),
    counts: countStates(rows),
    urgent: urgent.slice(0, URGENT_SHOWN),
    moreUrgent: Math.max(0, urgent.length - URGENT_SHOWN),
  };
}).sort(compareSeverity);
