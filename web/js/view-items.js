// Car details and the list of maintenance items: add, edit, delete.
import {
  addItem, deleteItem, itemInUse, makeItemId, updateCar, updateItem,
} from '../core/items.js';
import { assumedLastFor } from '../core/setup.js';
import { estimateKm, formatKm } from '../core/schedule.js';
import { confirmDialog, field, h, parseNumber, submitting } from './dom.js';

// What the form calls a kind. "days" is stored as rule interval with intervalDays.
const KINDS = {
  interval: 'ตามระยะ km หรือเดือน',
  days: 'ตามจำนวนวัน (เตือนเบา ๆ เช่น แบต)',
  calendar: 'ทุกปีในเดือนที่กำหนด',
  record: 'จดอายุอย่างเดียว ไม่เตือน',
  event: 'เหตุการณ์ (ขึ้นในไทม์ไลน์)',
};

const kindOf = (item) => {
  if (item.rule === 'interval' && item.intervalDays) return 'days';
  if (item.rule === 'inspect') return 'interval';
  return item.rule;
};

const ruleSummary = (item) => {
  const kind = kindOf(item);
  if (kind === 'interval') return `ทุก ${formatKm(item.intervalKm)} km หรือ ${item.intervalMonths} เดือน`;
  if (kind === 'days') return `ราว ${item.intervalDays} วัน`;
  if (kind === 'calendar') return `ทุกปี เดือนที่ ${item.calendarMonth}`;
  return KINDS[kind];
};

const saveWith = (ctx, button, error, change, message, after) => async (event) => {
  event.preventDefault();
  error.hidden = true;
  try {
    await submitting(button, () => ctx.mutate(change(event.target), message));
    ctx.toast('บันทึกแล้ว');
    if (after) ctx.go(after);
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
  }
};

const carForm = (ctx) => {
  const { car } = ctx.data;
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, 'บันทึกข้อมูลรถ');
  const read = (form) => (data) => updateCar(data, {
    name: form.elements.carName.value,
    deliveredOn: form.elements.carDelivered.value,
    roundKm: parseNumber(form.elements.carRoundKm.value),
    roundMonths: parseNumber(form.elements.carRoundMonths.value),
  });
  return h('form', { class: 'card stack', onSubmit: saveWith(ctx, save, error, read, 'car: update details') },
    h('h2', {}, 'ข้อมูลรถ'),
    field('ชื่อรถ', 'carName', h('input', { id: 'carName', maxlength: 80, value: car.name })),
    field('วันรับรถ', 'carDelivered', h('input', { id: 'carDelivered', type: 'date', max: ctx.today, value: car.deliveredOn })),
    h('div', { class: 'grid-2' },
      field('เช็คระยะทุกกี่ km', 'carRoundKm', h('input', { id: 'carRoundKm', inputmode: 'numeric', value: String(car.roundKm) })),
      field('หรือทุกกี่เดือน', 'carRoundMonths', h('input', { id: 'carRoundMonths', inputmode: 'numeric', value: String(car.roundMonths) }))),
    error,
    save);
};

export const renderItems = (ctx) => {
  const groups = [...new Set(ctx.data.items.map((item) => item.group ?? 'อื่น ๆ'))];
  return h('div', { class: 'stack' },
    h('h1', {}, 'รถและรายการดูแล'),
    carForm(ctx),
    h('section', { class: 'card stack' },
      h('div', { class: 'round-head' },
        h('h2', {}, 'รายการ'),
        h('a', { class: 'btn btn-primary', href: '#/items/new' }, 'เพิ่มรายการ')),
      groups.map((group) => [
        h('p', { class: 'group-title' }, group),
        h('ul', { class: 'list' }, ctx.data.items.filter((item) => (item.group ?? 'อื่น ๆ') === group).map((item) => h('li', {},
          h('a', { class: 'row', href: `#/items/${encodeURIComponent(item.id)}` },
            h('span', { class: 'row-name' }, item.name),
            h('span', { class: 'row-left' }, 'แก้'),
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
  intervalKm: numberField('ทุกกี่ km', 'intervalKm', item?.intervalKm),
  intervalMonths: numberField('หรือทุกกี่เดือน', 'intervalMonths', item?.intervalMonths),
  intervalDays: numberField('ประมาณกี่วัน', 'intervalDays', item?.intervalDays),
  calendarMonth: numberField('เดือนที่ (1-12)', 'calendarMonth', item?.calendarMonth),
});

const showFieldsFor = (fields, kind) => Object.entries(fields).forEach(([name, element]) => {
  element.hidden = !KIND_FIELDS[kind].includes(name);
});

const readItem = (form, kind) => {
  const number = (name) => (KIND_FIELDS[kind].includes(name) ? parseNumber(form.elements[name].value) ?? undefined : undefined);
  return {
    name: form.elements.itemName.value,
    group: form.elements.itemGroup.value || 'อื่น ๆ',
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
    return h('p', { class: 'muted' }, 'ลบไม่ได้ เพราะมีประวัติใช้รายการนี้ ถ้าไม่ใช้แล้ว เปลี่ยนเป็น "จดอายุอย่างเดียว" แทน');
  }
  return h('button', {
    class: 'btn btn-danger',
    type: 'button',
    onClick: async () => {
      if (!await confirmDialog(`ลบรายการ ${item.name}?`, 'ลบ')) return;
      try {
        await ctx.mutate((data) => deleteItem(data, item.id), `item: delete ${item.id}`);
        ctx.toast('ลบแล้ว');
        ctx.go('#/items');
      } catch (failure) {
        ctx.toast(failure.message);
      }
    },
  }, 'ลบรายการ');
};

const startFields = (ctx) => h('details', { class: 'last-done' },
  h('summary', {}, 'ทำล่าสุดเมื่อ (ไม่บังคับ ถ้าไม่ใส่จะนับจากวันนี้)'),
  h('div', { class: 'grid-2' },
    field('วันที่', 'lastDate', h('input', { id: 'lastDate', name: 'lastDate', type: 'date', max: ctx.today })),
    field('เลขไมล์', 'lastKm', h('input', { id: 'lastKm', name: 'lastKm', inputmode: 'numeric', autocomplete: 'off' }))));

export const renderItemEdit = (ctx, itemId) => {
  const item = itemId === 'new' ? null : ctx.data.items.find((entry) => entry.id === itemId);
  if (itemId !== 'new' && !item) return h('p', { class: 'card' }, 'ไม่พบรายการนี้ ', h('a', { href: '#/items' }, 'กลับ'));
  const fields = ruleFields(item);
  const kindSelect = h('select', { id: 'kind', name: 'kind' },
    Object.entries(KINDS).map(([kind, label]) => h('option', { value: kind, selected: kind === (item ? kindOf(item) : 'interval') }, label)));
  kindSelect.addEventListener('change', () => showFieldsFor(fields, kindSelect.value));
  showFieldsFor(fields, kindSelect.value);
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'บันทึก');
  const change = (form) => {
    const next = readItem(form, kindSelect.value);
    // An item that starts being scheduled needs a starting point, or its first due date is a guess.
    const needsStart = item && !item.assumedLast && !['record', 'event'].includes(next.rule);
    if (item) return (data) => updateItem(data, item.id, needsStart ? withStart(ctx, form, next) : next, ctx.today);
    return (data) => addItem(data, withStart(ctx, form, { ...next, id: makeItemId(next.name, data.items.map((entry) => entry.id)) }), ctx.today);
  };
  const groups = [...new Set(ctx.data.items.map((entry) => entry.group).filter(Boolean))];
  return h('form', { class: 'card stack', novalidate: true, onSubmit: saveWith(ctx, save, error, change, `item: ${item ? 'edit' : 'add'}`, '#/items') },
    h('h1', {}, item ? 'แก้รายการ' : 'เพิ่มรายการ'),
    field('ชื่อรายการ *', 'itemName', h('input', { id: 'itemName', maxlength: 80, required: true, value: item?.name ?? '' })),
    field('หมวด', 'itemGroup', h('input', { id: 'itemGroup', list: 'item-groups', maxlength: 40, value: item?.group ?? '' })),
    h('datalist', { id: 'item-groups' }, groups.map((group) => h('option', { value: group }))),
    field('แบบการเตือน', 'kind', kindSelect),
    h('div', { class: 'grid-2' }, fields.intervalKm, fields.intervalMonths),
    fields.intervalDays,
    fields.calendarMonth,
    h('label', { class: 'check', htmlFor: 'hasBrand' },
      h('input', { type: 'checkbox', id: 'hasBrand', checked: Boolean(item?.hasBrand) }),
      h('span', {}, 'จดยี่ห้อ/รุ่นตอนบันทึกการเข้าอู่')),
    item ? null : startFields(ctx),
    error,
    save,
    item ? deleteButton(ctx, item) : null,
    h('a', { href: '#/items' }, 'กลับ'));
};
