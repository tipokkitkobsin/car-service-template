import { formatDate, formatKm } from '../core/schedule.js';
import { h } from './dom.js';

const baht = (value) => `${Number(value).toLocaleString('en-US')} บาท`;

const visitRow = (visit, names) => h('li', {},
  h('a', { class: 'visit', href: `#/visit/${encodeURIComponent(visit.id)}`, 'aria-label': `แก้การเข้าอู่ ${formatDate(visit.date)}` },
    h('span', { class: 'visit-top' },
      h('span', {}, formatDate(visit.date)),
      h('span', {}, `${visit.isKmEstimated ? '~' : ''}${formatKm(visit.km)} km`)),
    h('p', {}, visit.itemIds.map((id) => names.get(id) ?? id).join(', ')),
    h('p', { class: 'muted' }, [visit.shop, visit.cost === null ? '' : baht(visit.cost), visit.note].filter(Boolean).join(' · '))));

const roundGroup = (roundKm, visits, car, names) => {
  const total = visits.reduce((sum, visit) => sum + (visit.cost ?? 0), 0);
  const years = (roundKm / car.roundKm) * car.roundMonths / 12;
  return h('section', {},
    h('div', { class: 'round-head' },
      h('h2', {}, `รอบ ${formatKm(roundKm)} km / ${years} ปี`),
      h('span', { class: 'muted num' }, total ? baht(total) : `${visits.length} ครั้ง`)),
    h('ul', { class: 'list' }, [...visits].reverse().map((visit) => visitRow(visit, names))));
};

const readingList = (readings) => (readings.length === 0 ? null : h('section', {},
  h('div', { class: 'round-head' },
    h('h2', {}, 'เลขไมล์ที่จด'),
    h('span', { class: 'muted num' }, `${readings.length} ครั้ง`)),
  h('ul', { class: 'list' }, [...readings].reverse().map((reading) => h('li', {},
    h('a', { class: 'visit', href: `#/reading/${reading.date}`, 'aria-label': `แก้เลขไมล์วันที่ ${formatDate(reading.date)}` },
      h('span', { class: 'visit-top' },
        h('span', {}, formatDate(reading.date)),
        h('span', {}, `${formatKm(reading.km)} km`))))))));

export const renderHistory = (ctx) => {
  const { visits, items, car } = ctx.data;
  const names = new Map(items.map((item) => [item.id, item.name]));
  const rounds = [...new Set(visits.map((visit) => visit.roundKm))].sort((a, b) => b - a);
  const total = visits.reduce((sum, visit) => sum + (visit.cost ?? 0), 0);
  return h('div', {},
    h('h1', {}, 'ประวัติเช็คระยะ'),
    h('p', { class: 'muted' }, `${visits.length} ครั้ง · รวมที่จดไว้ ${baht(total)} · แตะรายการเพื่อแก้หรือลบ`),
    readingList(ctx.data.readings),
    visits.length === 0
      ? h('p', { class: 'card' }, 'ยังไม่มีประวัติ')
      : rounds.map((round) => roundGroup(round, visits.filter((visit) => visit.roundKm === round), car, names)));
};
