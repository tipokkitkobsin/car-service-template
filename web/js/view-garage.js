// All cars at once: one card per car, most urgent first. Tapping a card opens that car's overview.
import { garageSummary } from '../core/garage.js';
import { formatDate, formatKm, leftText } from '../core/schedule.js';
import { t } from '../core/i18n.js';
import { roundRing } from './charts.js';
import { h, icon, tag } from './dom.js';

const COUNTED = ['overdue', 'watch', 'check', 'soon'];

const counts = (car) => {
  const shown = COUNTED.filter((state) => car.counts[state] > 0);
  if (shown.length === 0) return h('p', {}, tag('ok'), ' ', t('ทุกอย่างปกติ'));
  return h('p', { class: 'garage-counts' }, shown.map((state) => h('span', {}, tag(state), h('b', { class: 'num' }, ` ${car.counts[state]}`))));
};

const urgentList = (car) => (car.urgent.length === 0 ? null : h('ul', { class: 'garage-urgent' },
  car.urgent.map((row) => h('li', {}, h('span', {}, row.item.name), h('span', { class: 'muted' }, leftText(row) || (row.state === 'check' ? t('ต้องตรวจ') : t('ใกล้ถึง'))))),
  car.moreUrgent ? h('li', { class: 'muted' }, t('และอีก {count} รายการ', { count: car.moreUrgent })) : null));

const carCard = (car) => h('a', { class: 'card garage-card', href: `#/car/${encodeURIComponent(car.id)}` },
  h('div', { class: 'garage-head' },
    h('h2', {}, car.name),
    h('span', { class: 'num muted' }, `${car.isKmEstimated ? '~' : ''}${formatKm(car.km)} km`)),
  h('div', { class: 'garage-body' },
    h('div', { class: 'garage-ring' }, roundRing(car.progress)),
    h('div', { class: 'stack' },
      h('p', {}, h('span', { class: 'muted' }, t('เช็คระยะครั้งถัดไป')), ' ',
        h('strong', { class: 'num' }, `${formatKm(car.progress.due.km)} km`),
        h('span', { class: 'muted' }, ` · ${formatDate(car.progress.due.date)}`)),
      counts(car),
      urgentList(car))),
  h('span', { class: 'garage-more' }, t('ดูรายละเอียด'), icon('chevron')));

export const renderGarage = (ctx) => h('div', { class: 'stack' },
  h('h1', {}, t('รถทั้งหมด')),
  garageSummary(ctx.cars.map(({ id, data }) => ({ id, data })), ctx.today).map(carCard),
  h('a', { class: 'btn btn-block', href: '#/add-car' }, icon('plus'), t('เพิ่มรถ')));
