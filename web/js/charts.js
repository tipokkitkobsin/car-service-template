// Home-screen widgets. Plain SVG and HTML, coloured only through CSS tokens.
import { daysBetween, formatDate, formatKm } from '../core/schedule.js';
import { h } from './dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const KM_PER_TICK = 50000;
const MS_PER_YEAR = 365.25 * 86400000;

const s = (tag, attrs = {}, ...children) => {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== null && value !== undefined) el.setAttribute(key, String(value));
  });
  el.append(...children.flat().filter(Boolean));
  return el;
};

const tip = (text) => s('title', {}, text);
const clampPct = (pct) => Math.max(0, Math.min(100, pct));

// Two concentric arcs: outer = km toward the next round, inner = time toward it.
export const roundRing = (progress) => {
  const arc = (radius, pct, className) => {
    const length = 2 * Math.PI * radius;
    return [
      s('circle', { cx: 80, cy: 80, r: radius, class: 'ring-track' }),
      pct < 1 ? null : s('circle', {
        cx: 80, cy: 80, r: radius, class: className,
        'stroke-dasharray': `${(clampPct(pct) / 100) * length} ${length}`,
        transform: 'rotate(-90 80 80)',
      }),
    ];
  };
  const label = `ถึงเช็คระยะครั้งถัดไป: ระยะทาง ${progress.kmPct}% เวลา ${progress.timePct}%`;
  return s('svg', { viewBox: '0 0 160 160', class: 'ring', role: 'img', 'aria-label': label },
    tip(label),
    arc(70, progress.kmPct, 'ring-km'),
    arc(54, progress.timePct, 'ring-time'));
};

export const ringLegend = (progress) => h('div', { class: 'legend' },
  h('span', {}, h('i', { class: 'swatch swatch-km', 'aria-hidden': 'true' }),
    `ระยะทาง ${progress.kmPct}% · เหลือ ${formatKm(Math.max(0, progress.kmLeft))} km`),
  h('span', {}, h('i', { class: 'swatch swatch-time', 'aria-hidden': 'true' }),
    `เวลา ${progress.timePct}% · เหลือ ${Math.max(0, progress.daysLeft)} วัน`));

// One bar per item: share of its interval already used.
export const lifeBar = (row, life) => h('div', {
  class: `life life-${row.state}`,
  role: 'meter',
  'aria-valuemin': '0',
  'aria-valuemax': '100',
  'aria-valuenow': String(clampPct(life.pct)),
  'aria-label': `${row.item.name} ใช้ไป ${life.pct}%`,
},
h('span', { class: 'life-fill', 'data-pct': String(clampPct(life.pct)) }),
life.pct > 100 ? h('span', { class: 'life-over', 'aria-hidden': 'true' }) : null);

// Bars of past lifespans against a reference length, current one still running.
export const lifespanChart = (spans, limitDays, nameFor) => {
  const scale = Math.max(limitDays ?? 0, ...spans.map((span) => span.days)) * 1.08;
  const pct = (days) => `${(days / scale) * 100}%`;
  const summary = spans.map((span, index) => `${nameFor(span, index)} ${span.days} วัน`).join(', ');
  const limitText = limitDays ? ` · ช่วงระวัง ${limitDays} วัน` : '';
  return h('div', { class: 'spans', role: 'img', 'aria-label': `อายุแต่ละครั้ง: ${summary}${limitText}` },
    limitDays ? h('div', { class: 'spans-layer', 'aria-hidden': 'true' },
      h('div', { class: 'spans-limit', 'data-left': pct(limitDays) }, h('span', {}, `${limitDays} วัน`))) : null,
    spans.map((span, index) => h('div', {
      class: 'span-row',
      title: `${formatDate(span.from)} ถึง ${span.isCurrent ? 'วันนี้' : formatDate(span.to)}${span.visit?.note ? ` · ${span.visit.note}` : ''}`,
    },
    h('span', { class: 'span-name' }, nameFor(span, index)),
    h('span', { class: 'span-track' },
      h('span', { class: `span-bar${span.isCurrent ? ' span-current' : ''}`, 'data-width': pct(span.days) })),
    h('span', { class: 'span-days' }, h('span', { class: 'num' }, `${span.days} วัน`),
      [span.brand, span.isCurrent ? 'ใช้อยู่' : ''].filter(Boolean).map((text) => ` · ${text}`).join('')))));
};

const yearTicks = (from, to) => {
  const first = Number(from.slice(0, 4)) + 1;
  const last = Number(to.slice(0, 4));
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => `${first + index}-01-01`);
};

// Odometer over time. Hollow dots are estimated values.
export const odometerChart = (points) => {
  const width = 320;
  const height = 170;
  const pad = { left: 36, right: 12, top: 18, bottom: 22 };
  const first = points[0].date;
  const last = points[points.length - 1].date;
  const span = Math.max(1, daysBetween(first, last));
  const maxKm = Math.ceil(Math.max(...points.map((point) => point.km)) / KM_PER_TICK) * KM_PER_TICK || KM_PER_TICK;
  const x = (date) => pad.left + (daysBetween(first, date) / span) * (width - pad.left - pad.right);
  const y = (km) => height - pad.bottom - (km / maxKm) * (height - pad.top - pad.bottom);
  const ticks = Array.from({ length: maxKm / KM_PER_TICK + 1 }, (_, index) => index * KM_PER_TICK);
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.date).toFixed(1)} ${y(point.km).toFixed(1)}`).join(' ');
  const end = points[points.length - 1];
  const years = (daysBetween(first, last) * 86400000) / MS_PER_YEAR;
  const label = `เลขไมล์จาก 0 ถึง ${formatKm(end.km)} km ใน ${years.toFixed(1)} ปี`;
  return s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'odo', role: 'img', 'aria-label': label },
    tip(label),
    ticks.map((km) => s('g', {},
      s('line', { x1: pad.left, x2: width - pad.right, y1: y(km), y2: y(km), class: 'grid' }),
      s('text', { x: pad.left - 6, y: y(km) + 4, class: 'axis', 'text-anchor': 'end' }, km ? `${km / 1000}k` : '0'))),
    yearTicks(first, last).map((date) => s('text', {
      x: x(date), y: height - 6, class: 'axis', 'text-anchor': 'middle',
    }, `'${date.slice(2, 4)}`)),
    s('path', { d: line, class: 'odo-line' }),
    points.map((point) => s('g', { class: 'odo-hit' },
      s('circle', { cx: x(point.date), cy: y(point.km), r: 11, class: 'hit' }),
      s('circle', { cx: x(point.date), cy: y(point.km), r: 4, class: point.isEstimated ? 'dot dot-est' : 'dot' }),
      tip(`${formatDate(point.date)} · ${point.isEstimated ? '~' : ''}${formatKm(point.km)} km`))),
    s('text', { x: x(end.date) - 6, y: y(end.km) - 9, class: 'odo-label', 'text-anchor': 'end' },
      `${end.isEstimated ? '~' : ''}${formatKm(end.km)}`));
};

// Widths travel as data attributes and are applied through the CSSOM, which the CSP allows.
export const applySizes = (root) => {
  root.querySelectorAll('[data-pct]').forEach((el) => { el.style.width = `${el.dataset.pct}%`; });
  root.querySelectorAll('[data-width]').forEach((el) => { el.style.width = el.dataset.width; });
  root.querySelectorAll('[data-left]').forEach((el) => { el.style.left = el.dataset.left; });
};
