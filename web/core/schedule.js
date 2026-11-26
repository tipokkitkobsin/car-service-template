// Pure schedule logic, shared by the web app, the reminder job and the Discord bot.
const MS_PER_DAY = 86400000;
const DAYS_PER_MONTH = 30.4375;
const SOON_DAYS = 30;
const SOON_KM = 1000;
const PACE_WINDOW_DAYS = 365;
const PACE_MIN_SPAN_DAYS = 30;
const EARLY_CALENDAR_DAYS = 62;
const STATE_ORDER = { overdue: 0, watch: 1, check: 2, soon: 3, ok: 4, record: 5, event: 6 };

const toUtc = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);

export const daysBetween = (from, to) => Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);

export const addMonths = (iso, months) => {
  const [year, month, day] = iso.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return toIso(Date.UTC(year, month - 1 + months, Math.min(day, lastDay)));
};

export const todayInBangkok = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);

export const roundForKm = (km, roundKm) => Math.ceil(km / roundKm) * roundKm;

export const formatKm = (km) => Number(km).toLocaleString('en-US');

export const formatDate = (iso) => {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year.slice(2)}`;
};

export const dueText = (row) => {
  if (!row.dueDate) return '';
  const km = row.dueKm === null ? '' : ` หรือ ${formatKm(row.dueKm)} km`;
  return `ครบ ${formatDate(row.dueDate)}${km}`;
};

export const leftText = (row) => {
  if (row.state === 'overdue') return `เกินมา ${row.roundsOver} รอบ`;
  if (row.state === 'watch') return `ใช้มา ${daysBetween(row.last.date, row.dueDate) - row.daysLeft} วัน`;
  if (row.daysLeft === null) return '';
  const km = row.kmLeft === null ? '' : ` · ${formatKm(row.kmLeft)} km`;
  return `เหลือ ${row.daysLeft} วัน${km}`;
};

const monthsForKm = (km, car) => (km / car.roundKm) * car.roundMonths;

export const baselineFor = (item, car) => {
  if (item.assumedLast) return { km: null, ...item.assumedLast, isAssumed: true };
  if (item.rule !== 'interval') return null;
  const km = Math.floor(car.baselineKm / item.intervalKm) * item.intervalKm;
  return { date: addMonths(car.deliveredOn, monthsForKm(km, car)), km, isAssumed: true };
};

const compareVisits = (a, b) => a.date.localeCompare(b.date) || a.km - b.km;

export const lastDone = (item, data) => {
  const done = data.visits.filter((visit) => visit.itemIds.includes(item.id)).sort(compareVisits);
  const latest = done[done.length - 1];
  return latest
    ? { date: latest.date, km: latest.km, visitId: latest.id, isAssumed: false, isKmEstimated: Boolean(latest.isKmEstimated) }
    : baselineFor(item, data.car);
};

const calendarDue = (item, last) => {
  const year = Number(last.date.slice(0, 4));
  const month = String(item.calendarMonth).padStart(2, '0');
  const candidate = `${year + 1}-${month}-01`;
  return daysBetween(last.date, candidate) <= EARLY_CALENDAR_DAYS ? `${year + 2}-${month}-01` : candidate;
};

export const addDays = (iso, days) => toIso(toUtc(iso) + days * MS_PER_DAY);

const dueFor = (item, last) => {
  if (item.rule === 'calendar') return { dueKm: null, dueDate: calendarDue(item, last) };
  if (item.intervalDays) return { dueKm: null, dueDate: addDays(last.date, item.intervalDays) };
  const dueKm = last.km === null ? null : last.km + item.intervalKm;
  return { dueKm, dueDate: addMonths(last.date, item.intervalMonths) };
};

const roundsOverFor = (kmLeft, daysLeft, car) => {
  const kmRounds = kmLeft === null ? 0 : -kmLeft / car.roundKm;
  const dayRounds = -daysLeft / (car.roundMonths * DAYS_PER_MONTH);
  return 1 + Math.floor(Math.max(kmRounds, dayRounds, 0));
};

const stateFor = (kmLeft, daysLeft) => {
  if (daysLeft < 0 || (kmLeft !== null && kmLeft <= 0)) return 'overdue';
  if (daysLeft <= SOON_DAYS || (kmLeft !== null && kmLeft <= SOON_KM)) return 'soon';
  return 'ok';
};

export const itemStatus = (item, data, today, km) => {
  const blank = { item, dueKm: null, dueDate: null, kmLeft: null, daysLeft: null, roundsOver: 0 };
  if (item.rule === 'record' || item.rule === 'event') return { ...blank, state: item.rule, last: lastDone(item, data) };
  const last = lastDone(item, data);
  if (!last) return { ...blank, state: 'check', last: null };
  const { dueKm, dueDate } = dueFor(item, last);
  const kmLeft = dueKm === null ? null : dueKm - km;
  const daysLeft = daysBetween(today, dueDate);
  const hardState = stateFor(kmLeft, daysLeft);
  // A soft item has no firm limit: past its date it is only in a caution period.
  const state = item.isSoft && hardState === 'overdue' ? 'watch' : hardState;
  const roundsOver = state === 'overdue' ? roundsOverFor(kmLeft, daysLeft, data.car) : 0;
  return { item, last, dueKm, dueDate, kmLeft, daysLeft, state, roundsOver };
};

export const allReadings = (data, ignoreVisitId = null) => [
  ...data.readings,
  ...data.visits
    .filter((visit) => visit.id !== ignoreVisitId && !visit.isKmEstimated)
    .map(({ date, km }) => ({ date, km })),
].sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km);

const paceFrom = (readings, last, fallback) => {
  const first = readings.find((reading) => daysBetween(reading.date, last.date) <= PACE_WINDOW_DAYS);
  const span = first ? daysBetween(first.date, last.date) : 0;
  if (span < PACE_MIN_SPAN_DAYS || last.km <= first.km) return fallback;
  return Math.round(((last.km - first.km) / span) * 10) / 10;
};

export const estimateKm = (data, today) => {
  const everything = allReadings(data);
  const readings = everything.filter((reading) => reading.date <= today);
  const last = readings[readings.length - 1];
  if (!last) {
    const perDay = data.car.defaultKmPerDay;
    const later = everything[0];
    const km = later
      ? Math.max(0, later.km - Math.round(perDay * daysBetween(today, later.date)))
      : data.car.baselineKm;
    return { km, perDay, isEstimated: true, last: null };
  }
  const perDay = paceFrom(readings, last, data.car.defaultKmPerDay);
  const days = daysBetween(last.date, today);
  return { km: last.km + Math.round(perDay * days), perDay, isEstimated: days > 0, last };
};

// Odometer on a past date: a straight line between the readings around it, else the estimate.
export const kmAt = (data, date) => {
  const readings = allReadings(data);
  const before = readings.filter((reading) => reading.date <= date);
  const previous = before[before.length - 1];
  const following = readings.find((reading) => reading.date > date);
  if (!previous || !following) return estimateKm(data, date).km;
  const share = daysBetween(previous.date, date) / daysBetween(previous.date, following.date);
  return previous.km + Math.round((following.km - previous.km) * share);
};

const DAYS_PER_YEAR = 365.25;

export const usageOf = (row, data, today) => {
  if (!row.last || row.last.km === null) return null;
  const now = estimateKm(data, today);
  return {
    km: Math.max(0, now.km - row.last.km),
    years: Math.round((daysBetween(row.last.date, today) / DAYS_PER_YEAR) * 10) / 10,
    isEstimated: now.isEstimated || Boolean(row.last.isKmEstimated),
  };
};

export const usageText = (usage) => (
  `ใช้มา ${usage.years} ปี · ${formatKm(usage.km)} km${usage.isEstimated ? ' (ประมาณ)' : ''}`
);

export const buildStatuses = (data, today) => {
  const { km } = estimateKm(data, today);
  return data.items.map((item) => itemStatus(item, data, today, km));
};

export const sortByUrgency = (rows) => [...rows].sort((a, b) => (
  STATE_ORDER[a.state] - STATE_ORDER[b.state] || (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999)
));

export const nextRound = (data) => {
  const { car, visits } = data;
  const latest = visits.reduce((max, visit) => Math.max(max, visit.roundKm), 0);
  const km = (latest || roundForKm(car.baselineKm, car.roundKm)) + car.roundKm;
  const months = monthsForKm(km, car);
  return { km, years: months / 12, date: addMonths(car.deliveredOn, months) };
};
