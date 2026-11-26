// The car's life story: every visit plus computed milestones, grouped by year.
import { addDays, allReadings, daysBetween, formatKm } from './schedule.js';
import { t, tx } from './i18n.js';

const MILESTONE_KM = 50000;

export const KINDS = {
  service: tx('เข้าศูนย์/เช็คระยะ'),
  repair: tx('ซ่อม/เคลม'),
  mod: tx('แต่ง'),
  part: tx('อะไหล่/ดูแล'),
};

const isOilChange = (id) => /(^|-)oil$/.test(id);

export const kindOf = (visit) => visit.kind ?? (visit.itemIds.some(isOilChange) ? 'service' : 'part');

const withStart = (data) => {
  const readings = allReadings(data);
  const hasStart = readings.some((reading) => reading.date <= data.car.deliveredOn);
  return hasStart ? readings : [{ date: data.car.deliveredOn, km: 0 }, ...readings];
};

const crossings = (from, to) => {
  const found = [];
  for (let km = Math.floor(from.km / MILESTONE_KM + 1) * MILESTONE_KM; km <= to.km; km += MILESTONE_KM) {
    const share = (km - from.km) / (to.km - from.km);
    found.push({ km, date: addDays(from.date, Math.round(daysBetween(from.date, to.date) * share)) });
  }
  return found;
};

export const milestones = (data, today) => {
  const readings = withStart(data);
  const passed = readings.slice(1).flatMap((reading, index) => crossings(readings[index], reading));
  return [
    { date: data.car.deliveredOn, km: 0, title: t('รับรถ'), isKmEstimated: false },
    ...passed.map(({ km, date }) => ({ date, km, title: `${formatKm(km)} km`, isKmEstimated: true })),
  ].filter((mark) => mark.date <= today);
};

const visitEvent = (visit, names) => ({
  kind: kindOf(visit),
  date: visit.date,
  km: visit.km,
  isKmEstimated: Boolean(visit.isKmEstimated),
  names: visit.itemIds.map((id) => names.get(id) ?? id),
  visit,
});

const byNewest = (a, b) => b.date.localeCompare(a.date) || b.km - a.km;

export const buildTimeline = (data, today, filter = 'all') => {
  const names = new Map(data.items.map((item) => [item.id, item.name]));
  const visits = data.visits.map((visit) => visitEvent(visit, names));
  const marks = milestones(data, today).map((mark) => ({ ...mark, kind: 'milestone', names: [] }));
  const events = [...visits, ...marks]
    .filter((event) => filter === 'all' || event.kind === filter || event.kind === 'milestone')
    .sort(byNewest);
  const years = [...new Set(events.map((event) => event.date.slice(0, 4)))];
  return years.map((year) => ({ year, events: events.filter((event) => event.date.startsWith(year)) }));
};
