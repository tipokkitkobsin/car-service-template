// Numbers behind the home-screen charts. Pure functions over the stored data.
import {
  addMonths, allReadings, daysBetween, estimateKm, lastDone, nextRound,
} from './schedule.js';

const percent = (used, total) => (total > 0 ? Math.round((used / total) * 100) : 0);

// Share of the interval already used: the larger of km and time.
export const lifeOf = (row) => {
  if (!row.dueDate || !row.last) return null;
  const totalDays = daysBetween(row.last.date, row.dueDate);
  const timePct = percent(totalDays - row.daysLeft, totalDays);
  const hasKm = row.dueKm !== null && row.last.km !== null && row.kmLeft !== null;
  const totalKm = hasKm ? row.dueKm - row.last.km : 0;
  const kmPct = hasKm ? percent(totalKm - row.kmLeft, totalKm) : 0;
  return { pct: Math.max(0, timePct, kmPct), timePct, kmPct, isKmLimit: kmPct > timePct };
};

const latestRealVisit = (data) => data.visits
  .filter((visit) => !visit.isKmEstimated)
  .reduce((latest, visit) => (!latest || visit.date >= latest.date ? visit : latest), null);

// The service cycle restarts at the anchor item (engine oil): its last change + one round.
const cycleStart = (data) => {
  const anchor = data.items.find((item) => item.id === data.car.anchorItemId);
  const last = anchor ? lastDone(anchor, data) : null;
  if (last && last.km !== null) return { date: last.date, km: last.km };
  const visit = latestRealVisit(data);
  return visit ? { date: visit.date, km: visit.km } : { date: data.car.deliveredOn, km: 0 };
};

export const roundProgress = (data, today) => {
  const { roundKm, roundMonths } = data.car;
  const start = cycleStart(data);
  const due = { km: start.km + roundKm, date: addMonths(start.date, roundMonths) };
  const km = estimateKm(data, today).km;
  return {
    round: nextRound(data),
    start,
    due,
    km,
    kmPct: percent(km - start.km, roundKm),
    timePct: percent(daysBetween(start.date, today), daysBetween(start.date, due.date)),
    kmLeft: due.km - km,
    daysLeft: daysBetween(today, due.date),
  };
};

const ORIGINAL_BRAND = 'เดิมติดรถ';

// Each install of a part, numbered from 1. Number 0 is the factory part, when it was replaced later.
export const lifespans = (data, itemId, today) => {
  const item = data.items.find((entry) => entry.id === itemId);
  const delivered = data.car.deliveredOn;
  const installs = data.visits
    .filter((visit) => visit.itemIds.includes(itemId))
    .sort((a, b) => a.date.localeCompare(b.date));
  const hasOriginal = installs.length === 0 || installs[0].date > delivered;
  const original = hasOriginal ? [{
    visit: null, from: delivered, to: installs[0]?.date ?? today, isOriginal: true, number: 0,
    brand: item?.originalBrand ?? ORIGINAL_BRAND,
  }] : [];
  const changed = installs.map((visit, index) => ({
    visit, from: visit.date, to: installs[index + 1]?.date ?? today, isOriginal: false, number: index + 1,
    brand: visit.parts?.[itemId] ?? '',
  }));
  const spans = [...original, ...changed];
  return spans.map((span, index) => ({
    ...span, days: daysBetween(span.from, span.to), isCurrent: index === spans.length - 1,
  }));
};

export const odometerSeries = (data, today) => {
  const real = allReadings(data).map((reading) => ({ ...reading, isEstimated: false }));
  const guessed = data.visits
    .filter((visit) => visit.isKmEstimated)
    .map(({ date, km }) => ({ date, km, isEstimated: true }));
  const points = [...real, ...guessed]
    .filter((point) => point.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);
  const hasStart = points.some((point) => point.date <= data.car.deliveredOn);
  const withStart = hasStart ? points : [{ date: data.car.deliveredOn, km: 0, isEstimated: true }, ...points];
  const last = withStart[withStart.length - 1];
  return last && last.date < today
    ? [...withStart, { date: today, km: estimateKm(data, today).km, isEstimated: true }]
    : withStart;
};
