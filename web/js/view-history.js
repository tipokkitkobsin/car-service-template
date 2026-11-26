import { formatDate, formatKm } from '../core/schedule.js';
import { h } from './dom.js';
import { t } from '../core/i18n.js';

const baht = (value) => t('{amount} บาท', { amount: Number(value).toLocaleString('en-US') });

const visitRow = (visit, names) => h('li', {},
  h('a', { class: 'visit', href: `#/visit/${encodeURIComponent(visit.id)}`, 'aria-label': t('แก้การเข้าอู่ {date}', { date: formatDate(visit.date) }) },
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
      h('h2', {}, t('รอบ {km} km / {years} ปี', { km: formatKm(roundKm), years })),
      h('span', { class: 'muted num' }, total ? baht(total) : t('{count} ครั้ง', { count: visits.length }))),
    h('ul', { class: 'list' }, [...visits].reverse().map((visit) => visitRow(visit, names))));
};

const readingList = (readings) => (readings.length === 0 ? null : h('section', {},
  h('div', { class: 'round-head' },
    h('h2', {}, t('เลขไมล์ที่จด')),
    h('span', { class: 'muted num' }, t('{count} ครั้ง', { count: readings.length }))),
  h('ul', { class: 'list' }, [...readings].reverse().map((reading) => h('li', {},
    h('a', { class: 'visit', href: `#/reading/${reading.date}`, 'aria-label': t('แก้เลขไมล์วันที่ {date}', { date: formatDate(reading.date) }) },
      h('span', { class: 'visit-top' },
        h('span', {}, formatDate(reading.date)),
        h('span', {}, `${formatKm(reading.km)} km`))))))));

export const renderHistory = (ctx) => {
  const { visits, items, car } = ctx.data;
  const names = new Map(items.map((item) => [item.id, item.name]));
  const rounds = [...new Set(visits.map((visit) => visit.roundKm))].sort((a, b) => b - a);
  const total = visits.reduce((sum, visit) => sum + (visit.cost ?? 0), 0);
  return h('div', {},
    h('h1', {}, t('ประวัติเช็คระยะ')),
    h('p', { class: 'muted' }, t('{count} ครั้ง · รวมที่จดไว้ {total} · แตะรายการเพื่อแก้หรือลบ', { count: visits.length, total: baht(total) })),
    readingList(ctx.data.readings),
    visits.length === 0
      ? h('p', { class: 'card' }, t('ยังไม่มีประวัติ'))
      : rounds.map((round) => roundGroup(round, visits.filter((visit) => visit.roundKm === round), car, names)));
};
