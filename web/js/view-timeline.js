import { buildTimeline, KINDS } from '../core/timeline.js';
import {
  daysBetween, estimateKm, formatDate, formatKm, kmAt,
} from '../core/schedule.js';
import { h, icon } from './dom.js';
import { t, tx } from '../core/i18n.js';

const KIND_ICON = { service: 'wrench', repair: 'shield', mod: 'sparkle', part: 'note', milestone: 'flag' };
const FILTERS = [['all', tx('ทั้งหมด')], ...Object.entries(KINDS)];
let currentFilter = 'all';

const ageText = (from, to) => {
  const months = Math.floor(daysBetween(from, to) / 30.4375);
  return t('{years} ปี {months} เดือน', { years: Math.floor(months / 12), months: months % 12 });
};

const kmText = (event) => `${event.isKmEstimated ? '~' : ''}${formatKm(event.km)} km`;

const STORY_KINDS = new Set(['mod', 'repair']);
const storyTitle = (event) => (STORY_KINDS.has(event.kind) && event.visit.note ? event.visit.note.split(' · ')[0] : '');

const titleOf = (event) => {
  if (event.kind === 'milestone') return event.title;
  if (storyTitle(event)) return storyTitle(event);
  if (event.kind === 'service' && event.visit.roundKm) return t('เช็คระยะ {km} km', { km: formatKm(event.visit.roundKm) });
  return event.names.length > 2 ? `${event.names.slice(0, 2).join(', ')} +${event.names.length - 2}` : event.names.join(', ');
};

const brandsOf = (event) => [...new Set(Object.values(event.visit?.parts ?? {}))].join(' · ');

const eventItem = (event) => {
  const isMilestone = event.kind === 'milestone';
  const story = event.kind === 'milestone' ? '' : storyTitle(event);
  const detail = story || event.kind === 'service' || event.names.length > 2 ? event.names.join(', ') : '';
  const rest = story ? event.visit.note.split(' · ').slice(1).join(' · ') : event.visit?.note;
  const body = [
    h('span', { class: 'tl-top' },
      h('span', { class: 'tl-date num' }, formatDate(event.date)),
      h('span', { class: 'tl-km num' }, kmText(event))),
    h('strong', { class: 'tl-title' }, titleOf(event)),
    h('span', { class: 'tl-kind' }, isMilestone ? t('หมุดสำคัญ') : t(KINDS[event.kind])),
    detail ? h('p', { class: 'tl-detail' }, detail) : null,
    brandsOf(event) ? h('p', { class: 'tl-brand' }, brandsOf(event)) : null,
    rest ? h('p', { class: 'tl-note' }, rest) : null,
  ];
  return h('li', { class: `tl-item tl-${event.kind}` },
    h('span', { class: 'tl-dot', 'aria-hidden': 'true' }, icon(KIND_ICON[event.kind])),
    isMilestone
      ? h('div', { class: 'tl-body' }, body)
      : h('a', { class: 'tl-body', href: `#/visit/${encodeURIComponent(event.visit.id)}` }, body));
};

const yearKm = (data, year, today) => {
  const startsAtDelivery = `${year}-01-01` <= data.car.deliveredOn;
  const startKm = startsAtDelivery ? 0 : kmAt(data, `${Number(year) - 1}-12-31`);
  const end = `${year}-12-31` > today ? today : `${year}-12-31`;
  return Math.max(0, kmAt(data, end) - startKm);
};

const stats = (ctx) => {
  const { data, today } = ctx;
  return h('div', { class: 'tl-stats' },
    [
      [t('อายุรถ'), ageText(data.car.deliveredOn, today)],
      [t('วิ่งมาแล้ว'), `~${formatKm(estimateKm(data, today).km)} km`],
      [t('เข้าอู่/ศูนย์'), t('{count} ครั้ง', { count: data.visits.length })],
      [t('ของแต่ง'), t('{count} ครั้ง', { count: data.visits.filter((visit) => visit.kind === 'mod').length })],
    ].map(([label, value]) => h('div', {}, h('span', { class: 'muted' }, label), h('b', { class: 'num' }, value))));
};

const yearList = (ctx) => buildTimeline(ctx.data, ctx.today, currentFilter).map(({ year, events }) => h('section', { class: 'tl-year' },
  h('div', { class: 'round-head' },
    h('h2', {}, year),
    h('span', { class: 'muted num' }, t('วิ่งราว {km} km', { km: formatKm(yearKm(ctx.data, year, ctx.today)) }))),
  h('ol', { class: 'tl-list' }, events.map(eventItem))));

export const renderTimeline = (ctx) => {
  const list = h('div', {}, yearList(ctx));
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': t('กรองตามหมวด') });
  const drawChips = () => chips.replaceChildren(...FILTERS.map(([key, label]) => h('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': String(currentFilter === key),
    onClick: () => {
      currentFilter = key;
      drawChips();
      list.replaceChildren(...yearList(ctx));
    },
  }, t(label))));
  drawChips();
  return h('div', {},
    h('section', { class: 'card stack' },
      h('h1', {}, t('ชีวิตของ {name}', { name: ctx.data.car.name })),
      h('p', { class: 'muted' }, t('รับรถ {date} · แตะรายการเพื่อแก้ไข', { date: formatDate(ctx.data.car.deliveredOn) })),
      stats(ctx)),
    chips,
    list);
};
