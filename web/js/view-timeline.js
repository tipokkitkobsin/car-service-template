import { buildTimeline, KINDS } from '../core/timeline.js';
import {
  daysBetween, estimateKm, formatDate, formatKm, kmAt,
} from '../core/schedule.js';
import { h, icon } from './dom.js';

const KIND_ICON = { service: 'wrench', repair: 'shield', mod: 'sparkle', part: 'note', milestone: 'flag' };
const FILTERS = [['all', 'ทั้งหมด'], ...Object.entries(KINDS)];
let currentFilter = 'all';

const ageText = (from, to) => {
  const months = Math.floor(daysBetween(from, to) / 30.4375);
  return `${Math.floor(months / 12)} ปี ${months % 12} เดือน`;
};

const kmText = (event) => `${event.isKmEstimated ? '~' : ''}${formatKm(event.km)} km`;

const STORY_KINDS = new Set(['mod', 'repair']);
const storyTitle = (event) => (STORY_KINDS.has(event.kind) && event.visit.note ? event.visit.note.split(' · ')[0] : '');

const titleOf = (event) => {
  if (event.kind === 'milestone') return event.title;
  if (storyTitle(event)) return storyTitle(event);
  if (event.kind === 'service' && event.visit.roundKm) return `เช็คระยะ ${formatKm(event.visit.roundKm)} km`;
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
    h('span', { class: 'tl-kind' }, isMilestone ? 'หมุดสำคัญ' : KINDS[event.kind]),
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
      ['อายุรถ', ageText(data.car.deliveredOn, today)],
      ['วิ่งมาแล้ว', `~${formatKm(estimateKm(data, today).km)} km`],
      ['เข้าอู่/ศูนย์', `${data.visits.length} ครั้ง`],
      ['ของแต่ง', `${data.visits.filter((visit) => visit.kind === 'mod').length} ครั้ง`],
    ].map(([label, value]) => h('div', {}, h('span', { class: 'muted' }, label), h('b', { class: 'num' }, value))));
};

const yearList = (ctx) => buildTimeline(ctx.data, ctx.today, currentFilter).map(({ year, events }) => h('section', { class: 'tl-year' },
  h('div', { class: 'round-head' },
    h('h2', {}, year),
    h('span', { class: 'muted num' }, `วิ่งราว ${formatKm(yearKm(ctx.data, year, ctx.today))} km`)),
  h('ol', { class: 'tl-list' }, events.map(eventItem))));

export const renderTimeline = (ctx) => {
  const list = h('div', {}, yearList(ctx));
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'กรองตามหมวด' });
  const drawChips = () => chips.replaceChildren(...FILTERS.map(([key, label]) => h('button', {
    type: 'button',
    class: 'chip',
    'aria-pressed': String(currentFilter === key),
    onClick: () => {
      currentFilter = key;
      drawChips();
      list.replaceChildren(...yearList(ctx));
    },
  }, label)));
  drawChips();
  return h('div', {},
    h('section', { class: 'card stack' },
      h('h1', {}, `ชีวิตของ ${ctx.data.car.name}`),
      h('p', { class: 'muted' }, `รับรถ ${formatDate(ctx.data.car.deliveredOn)} · แตะรายการเพื่อแก้ไข`),
      stats(ctx)),
    chips,
    list);
};
