// Car details and the list of maintenance items: add, edit, delete.
import {
  addItem, deleteItem, itemInUse, makeItemId, updateCar, updateItem,
} from '../core/items.js';
import { assumedLastFor } from '../core/setup.js';
import { estimateKm, formatKm } from '../core/schedule.js';
import { confirmDialog, field, h, parseNumber, submitting } from './dom.js';
import { t, tx } from '../core/i18n.js';

// What the form calls a kind. "days" is stored as rule interval with intervalDays.
const KINDS = {
  interval: tx('ตามระยะ km หรือเดือน'),
  days: tx('ตามจำนวนวัน (เตือนเบา ๆ เช่น แบต)'),
  calendar: tx('ทุกปีในเดือนที่กำหนด'),
  record: tx('จดอายุอย่างเดียว ไม่เตือน'),
  event: tx('เหตุการณ์ (ขึ้นในไทม์ไลน์)'),
};

const kindOf = (item) => {
  if (item.rule === 'interval' && item.intervalDays) return 'days';
  if (item.rule === 'inspect') return 'interval';
  return item.rule;
};

const ruleSummary = (item) => {
  const kind = kindOf(item);
  if (kind === 'interval') return t('ทุก {km} km หรือ {months} เดือน', { km: formatKm(item.intervalKm), months: item.intervalMonths });
  if (kind === 'days') return t('ราว {days} วัน', { days: item.intervalDays });
  if (kind === 'calendar') return t('ทุกปี เดือนที่ {month}', { month: item.calendarMonth });
  return t(KINDS[kind]);
};

const saveWith = (ctx, button, error, change, message, after) => async (event) => {
  event.preventDefault();
  error.hidden = true;
  try {
    await submitting(button, () => ctx.mutate(change(event.target), message));
    ctx.toast(t('บันทึกแล้ว'));
    if (after) ctx.go(after);
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
  }
};

const carForm = (ctx) => {
  const { car } = ctx.data;
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, t('บันทึกข้อมูลรถ'));
  const read = (form) => (data) => updateCar(data, {
    name: form.elements.carName.value,
    deliveredOn: form.elements.carDelivered.value,
    roundKm: parseNumber(form.elements.carRoundKm.value),
    roundMonths: parseNumber(form.elements.carRoundMonths.value),
  });
  return h('form', { class: 'card stack', onSubmit: saveWith(ctx, save, error, read, 'car: update details') },
    h('h2', {}, t('ข้อมูลรถ')),
    field(t('ชื่อรถ'), 'carName', h('input', { id: 'carName', maxlength: 80, value: car.name })),
    field(t('วันรับรถ'), 'carDelivered', h('input', { id: 'carDelivered', type: 'date', max: ctx.today, value: car.deliveredOn })),
    h('div', { class: 'grid-2' },
      field(t('เช็คระยะทุกกี่ km'), 'carRoundKm', h('input', { id: 'carRoundKm', inputmode: 'numeric', value: String(car.roundKm) })),
      field(t('หรือทุกกี่เดือน'), 'carRoundMonths', h('input', { id: 'carRoundMonths', inputmode: 'numeric', value: String(car.roundMonths) }))),
    error,
    save);
};

export const renderItems = (ctx) => {
  const groups = [...new Set(ctx.data.items.map((item) => item.group ?? t('อื่น ๆ')))];
  return h('div', { class: 'stack' },
    h('h1', {}, t('รถและรายการดูแล')),
    carForm(ctx),
    h('section', { class: 'card stack' },
      h('div', { class: 'round-head' },
        h('h2', {}, t('รายการ')),
        h('a', { class: 'btn btn-primary', href: '#/items/new' }, t('เพิ่มรายการ'))),
      groups.map((group) => [
        h('p', { class: 'group-title' }, group),
        h('ul', { class: 'list' }, ctx.data.items.filter((item) => (item.group ?? t('อื่น ๆ')) === group).map((item) => h('li', {},
          h('a', { class: 'row', href: `#/items/${encodeURIComponent(item.id)}` },
            h('span', { class: 'row-name' }, item.name),
            h('span', { class: 'row-left' }, t('แก้')),
            h('span', { class: 'row-sub' }, ruleSummary(item)))))),
      ])));
};

const KIND_FIELDS = {
  interval: ['intervalKm', 'intervalMonths'],
  days: ['intervalDays'],
  calendar: ['calendarMonth'],
  record: [],
  event: [],
};

const numberField = (label, name, value) => field(label, name,
  h('input', { id: name, name, inputmode: 'numeric', autocomplete: 'off', value: value === undefined ? '' : String(value) }));

const ruleFields = (item) => ({
  intervalKm: numberField(t('ทุกกี่ km'), 'intervalKm', item?.intervalKm),
  intervalMonths: numberField(t('หรือทุกกี่เดือน'), 'intervalMonths', item?.intervalMonths),
  intervalDays: numberField(t('ประมาณกี่วัน'), 'intervalDays', item?.intervalDays),
  calendarMonth: numberField(t('เดือนที่ (1-12)'), 'calendarMonth', item?.calendarMonth),
});

const showFieldsFor = (fields, kind) => Object.entries(fields).forEach(([name, element]) => {
  element.hidden = !KIND_FIELDS[kind].includes(name);
});

const readItem = (form, kind) => {
  const number = (name) => (KIND_FIELDS[kind].includes(name) ? parseNumber(form.elements[name].value) ?? undefined : undefined);
  return {
    name: form.elements.itemName.value,
    group: form.elements.itemGroup.value || t('อื่น ๆ'),
    rule: kind === 'days' ? 'interval' : kind,
    intervalKm: number('intervalKm'),
    intervalMonths: number('intervalMonths'),
    intervalDays: number('intervalDays'),
    isSoft: kind === 'days' ? true : undefined,
    calendarMonth: number('calendarMonth'),
    hasBrand: form.elements.hasBrand.checked || undefined,
  };
};

// A new item counts from today (or the date given), like the first setup.
const withStart = (ctx, form, item) => {
  const lastDate = form.elements.lastDate?.value || undefined;
  const lastKm = parseNumber(form.elements.lastKm?.value ?? '') ?? undefined;
  const assumedLast = assumedLastFor(item, { lastDate, lastKm }, estimateKm(ctx.data, ctx.today).km, ctx.today);
  return assumedLast ? { ...item, assumedLast } : item;
};

const deleteButton = (ctx, item) => {
  if (itemInUse(ctx.data, item.id)) {
    return h('p', { class: 'muted' }, t('ลบไม่ได้ เพราะมีประวัติใช้รายการนี้ ถ้าไม่ใช้แล้ว เปลี่ยนเป็น "จดอายุอย่างเดียว" แทน'));
  }
  return h('button', {
    class: 'btn btn-danger',
    type: 'button',
    onClick: async () => {
      if (!await confirmDialog(t('ลบรายการ {name}?', { name: item.name }), t('ลบ'))) return;
      try {
        await ctx.mutate((data) => deleteItem(data, item.id), `item: delete ${item.id}`);
        ctx.toast(t('ลบแล้ว'));
        ctx.go('#/items');
      } catch (failure) {
        ctx.toast(failure.message);
      }
    },
  }, t('ลบรายการ'));
};

const startFields = (ctx) => h('details', { class: 'last-done' },
  h('summary', {}, t('ทำล่าสุดเมื่อ (ไม่บังคับ ถ้าไม่ใส่จะนับจากวันนี้)')),
  h('div', { class: 'grid-2' },
    field(t('วันที่'), 'lastDate', h('input', { id: 'lastDate', name: 'lastDate', type: 'date', max: ctx.today })),
    field(t('เลขไมล์'), 'lastKm', h('input', { id: 'lastKm', name: 'lastKm', inputmode: 'numeric', autocomplete: 'off' }))));

export const renderItemEdit = (ctx, itemId) => {
  const item = itemId === 'new' ? null : ctx.data.items.find((entry) => entry.id === itemId);
  if (itemId !== 'new' && !item) return h('p', { class: 'card' }, t('ไม่พบรายการนี้ '), h('a', { href: '#/items' }, t('กลับ')));
  const fields = ruleFields(item);
  const kindSelect = h('select', { id: 'kind', name: 'kind' },
    Object.entries(KINDS).map(([kind, label]) => h('option', { value: kind, selected: kind === (item ? kindOf(item) : 'interval') }, t(label))));
  kindSelect.addEventListener('change', () => showFieldsFor(fields, kindSelect.value));
  showFieldsFor(fields, kindSelect.value);
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('บันทึก'));
  const change = (form) => {
    const next = readItem(form, kindSelect.value);
    // An item that starts being scheduled needs a starting point, or its first due date is a guess.
    const needsStart = item && !item.assumedLast && !['record', 'event'].includes(next.rule);
    if (item) return (data) => updateItem(data, item.id, needsStart ? withStart(ctx, form, next) : next, ctx.today);
    return (data) => addItem(data, withStart(ctx, form, { ...next, id: makeItemId(next.name, data.items.map((entry) => entry.id)) }), ctx.today);
  };
  const groups = [...new Set(ctx.data.items.map((entry) => entry.group).filter(Boolean))];
  return h('form', { class: 'card stack', novalidate: true, onSubmit: saveWith(ctx, save, error, change, `item: ${item ? 'edit' : 'add'}`, '#/items') },
    h('h1', {}, item ? t('แก้รายการ') : t('เพิ่มรายการ')),
    field(t('ชื่อรายการ *'), 'itemName', h('input', { id: 'itemName', maxlength: 80, required: true, value: item?.name ?? '' })),
    field(t('หมวด'), 'itemGroup', h('input', { id: 'itemGroup', list: 'item-groups', maxlength: 40, value: item?.group ?? '' })),
    h('datalist', { id: 'item-groups' }, groups.map((group) => h('option', { value: group }))),
    field(t('แบบการเตือน'), 'kind', kindSelect),
    h('div', { class: 'grid-2' }, fields.intervalKm, fields.intervalMonths),
    fields.intervalDays,
    fields.calendarMonth,
    h('label', { class: 'check', htmlFor: 'hasBrand' },
      h('input', { type: 'checkbox', id: 'hasBrand', checked: Boolean(item?.hasBrand) }),
      h('span', {}, t('จดยี่ห้อ/รุ่นตอนบันทึกการเข้าอู่'))),
    item ? null : startFields(ctx),
    error,
    save,
    item ? deleteButton(ctx, item) : null,
    h('a', { href: '#/items' }, t('กลับ')));
};
