import {
  buildStatuses, dueText, estimateKm, formatDate, formatKm, leftText, sortByUrgency, usageOf, usageText,
} from '../core/schedule.js';
import { lifeOf, lifespans, odometerSeries, roundProgress } from '../core/insights.js';
import { addReading, validateReading } from '../core/records.js';
import {
  applySizes, lifeBar, lifespanChart, odometerChart, ringLegend, roundRing,
} from './charts.js';
import { field, h, icon, parseNumber, STATUS, submitting, tag } from './dom.js';
import { t } from '../core/i18n.js';

const MIN_HISTORY = 1;
const SUMMARY_STATES = ['overdue', 'watch', 'check', 'soon'];

const statusRow = (row) => {
  const life = lifeOf(row);
  return h('li', { class: 'row' },
    h('span', { class: 'row-name' }, row.item.name),
    h('span', { class: 'row-left' }, row.state === 'check' ? t('ยังไม่มีบันทึก') : leftText(row)),
    life ? lifeBar(row, life) : null,
    h('span', { class: 'row-sub' },
      [dueText(row) || t('บันทึกครั้งแรกเพื่อเริ่มนับ'), life ? t('ใช้ไป {pct}%', { pct: life.pct }) : '', row.last?.isAssumed ? t('ฐานจากค่าสมมติ') : '']
        .filter(Boolean).join(' · ')));
};

const section = (state, rows) => (rows.length === 0 ? null : h('section', { id: `s-${state}` },
  h('h2', {}, tag(state), h('span', { class: 'num' }, t('{count} รายการ', { count: rows.length }))),
  h('ul', { class: 'list' }, rows.map(statusRow))));

const okSection = (rows) => (rows.length === 0 ? null : h('details', { id: 's-ok' },
  h('summary', {}, tag('ok'), h('span', { class: 'num' }, t('{count} รายการ', { count: rows.length }))),
  h('ul', { class: 'list' }, rows.map(statusRow))));

const kmForm = (ctx) => {
  const input = h('input', { id: 'km-now', inputmode: 'numeric', autocomplete: 'off', placeholder: t('เช่น 115000'), required: true });
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const button = h('button', { class: 'btn btn-primary', type: 'submit' }, t('จด'));
  const submit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    const reading = { date: ctx.today, km: parseNumber(input.value) };
    try {
      await submitting(button, () => ctx.mutate((data) => {
        const errors = validateReading(data, reading, ctx.today);
        if (errors.length) throw new Error(errors[0]);
        return addReading(data, reading);
      }, `km: ${reading.km}`));
      ctx.toast(t('จดเลขไมล์แล้ว'));
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
      input.focus();
    }
  };
  return h('form', { class: 'stack', onSubmit: submit, novalidate: true },
    h('div', { class: 'inline-form' }, field(t('เลขไมล์วันนี้'), 'km-now', input), button), error);
};

const scrollTo = (state) => (event) => {
  event.preventDefault();
  document.getElementById(`s-${state}`)?.scrollIntoView({ block: 'start' });
};

const hero = (ctx, rows) => {
  const estimate = estimateKm(ctx.data, ctx.today);
  const progress = roundProgress(ctx.data, ctx.today);
  const count = (state) => rows.filter((row) => row.state === state).length;
  const lastLine = estimate.last
    ? t('จดจริงล่าสุด {km} km เมื่อ {date} · ใช้ราว {perDay} km/วัน', { km: formatKm(estimate.last.km), date: formatDate(estimate.last.date), perDay: Math.round(estimate.perDay) })
    : t('ยังไม่มีเลขไมล์');
  return h('section', { class: 'card hero' },
    h('h1', {}, ctx.data.car.name),
    h('div', { class: 'hero-grid' },
      h('div', { class: 'ring-box' },
        roundRing(progress),
        h('div', { class: 'ring-center' },
          h('b', { class: 'num' }, formatKm(estimate.km)),
          h('span', {}, estimate.isEstimated ? t('km ประมาณ') : 'km'))),
      h('div', { class: 'stack' },
        h('p', { class: 'round-head-text' }, h('span', { class: 'muted' }, t('เช็คระยะครั้งถัดไป')),
          h('strong', { class: 'round-target' }, `${formatKm(progress.due.km)} km`),
          h('span', { class: 'muted' }, t('หรือ {date}', { date: formatDate(progress.due.date) }))),
        ringLegend(progress),
        h('p', { class: 'muted' }, t('รอบ {km} km / {years} ปี', { km: formatKm(progress.round.km), years: progress.round.years })))),
    h('p', { class: 'muted' }, lastLine),
    kmForm(ctx),
    h('div', { class: 'summary' }, SUMMARY_STATES.map((state) => h('a', { href: `#s-${state}`, onClick: scrollTo(state) },
      h('b', {}, String(count(state))), h('span', {}, t(STATUS[state].label))))));
};

const spanName = (item) => (span) => (item.id === 'battery' ? t('ลูกที่ {number}', { number: span.number }) : t('ครั้งที่ {number}', { number: span.number }));

const historySection = (ctx) => {
  const items = ctx.data.items
    .map((item) => ({ item, spans: lifespans(ctx.data, item.id, ctx.today) }))
    .filter(({ item, spans }) => (item.rule === 'record' || item.intervalDays) && spans.length >= MIN_HISTORY);
  // MIN_HISTORY counts the factory part as one span.
  if (items.length === 0) return null;
  return h('section', { id: 's-history' },
    h('h2', {}, t('อายุแต่ละครั้งที่เปลี่ยน')),
    items.map(({ item, spans }) => h('div', { class: 'card chart-card' },
      h('h3', {}, item.name),
      lifespanChart(spans, item.intervalDays ?? null, spanName(item)))));
};

const odometerSection = (ctx) => {
  const points = odometerSeries(ctx.data, ctx.today);
  if (points.length < 2) return null;
  const { perDay } = estimateKm(ctx.data, ctx.today);
  return h('section', { id: 's-odo' },
    h('h2', {}, t('เลขไมล์ตั้งแต่รับรถ')),
    h('div', { class: 'card chart-card' },
      odometerChart(points),
      h('p', { class: 'muted' }, t('จุดทึบ = จดจริง · จุดกลวง = ค่าประมาณ · ช่วงหลังใช้ราว {perDay} km/วัน', { perDay: Math.round(perDay) }))));
};

const usageRow = (ctx, row) => {
  const usage = usageOf(row, ctx.data, ctx.today);
  const visit = ctx.data.visits.find((entry) => entry.id === row.last?.visitId);
  const since = row.last
    ? t('ล่าสุด {date}', { date: formatDate(row.last.date) }) + (row.last.km === null ? '' : t(' ที่ {km} km', { km: `${row.last.isKmEstimated ? '~' : ''}${formatKm(row.last.km)}` }))
    : t('ยังไม่มีบันทึก');
  return h('li', { class: 'row' },
    h('span', { class: 'row-name' }, row.item.name),
    h('span', { class: 'row-left' }, usage ? usageText(usage) : ''),
    h('span', { class: 'row-sub' }, [since, visit?.note].filter(Boolean).join(' · ')));
};

const usageSection = (ctx, rows) => (rows.length === 0 ? null : h('section', { id: 's-usage' },
  h('h2', {}, tag('record'), h('span', {}, t('อายุการใช้งาน'))),
  h('ul', { class: 'list' }, rows.map((row) => usageRow(ctx, row)))));

export const renderOverview = (ctx) => {
  const rows = sortByUrgency(buildStatuses(ctx.data, ctx.today));
  const pick = (state) => rows.filter((row) => row.state === state);
  const root = h('div', {},
    hero(ctx, rows),
    section('overdue', pick('overdue')),
    section('watch', pick('watch')),
    section('check', pick('check')),
    section('soon', pick('soon')),
    okSection(pick('ok')),
    usageSection(ctx, pick('record')),
    historySection(ctx),
    odometerSection(ctx),
    h('a', { class: 'btn btn-primary btn-block bottom-cta', href: '#/visit' }, icon('plus'), t('บันทึกการเข้าอู่')));
  applySizes(root);
  return root;
};
