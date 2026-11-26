import {
  buildStatuses, daysBetween, estimateKm, formatKm, kmAt, nextRound, roundForKm,
} from '../core/schedule.js';
import {
  addVisit, deleteVisit, isBrandable, isValidDate, partsFrom, validateVisit,
} from '../core/records.js';
import { brandPicker, readBrand } from './brand-picker.js';
import { KINDS, kindOf } from '../core/timeline.js';
import { confirmDialog, field, h, parseNumber, submitting, tag } from './dom.js';
import { t } from '../core/i18n.js';

const SAME_ROUND_DAYS = 45;
const URGENT = new Set(['overdue', 'watch', 'check', 'soon']);

const defaultRound = (data, today) => {
  const latest = data.visits[data.visits.length - 1];
  return latest && daysBetween(latest.date, today) <= SAME_ROUND_DAYS ? latest.roundKm : nextRound(data).km;
};

const roundOptions = (data, selected) => {
  const { roundKm, roundMonths } = data.car;
  const top = Math.max(nextRound(data).km, selected) + roundKm;
  const values = Array.from({ length: top / roundKm }, (_, index) => top - index * roundKm);
  return values.map((km) => h('option', { value: String(km), selected: km === selected },
    t('{km} km / {years} ปี', { km: formatKm(km), years: (km / roundKm) * roundMonths / 12 })));
};

const itemRow = (ctx, row, visit, isChosen) => {
  const picker = isBrandable(row.item)
    ? brandPicker(ctx.data, row.item, visit?.parts?.[row.item.id] ?? '', isChosen) : null;
  const box = h('input', { type: 'checkbox', name: 'item', value: row.item.id, checked: isChosen });
  if (picker) box.addEventListener('change', () => { picker.hidden = !box.checked; });
  return h('div', {},
    h('label', { class: 'check' }, box, h('span', {}, row.item.name), URGENT.has(row.state) ? tag(row.state) : null),
    picker);
};

const itemChecks = (ctx, visit) => {
  const chosen = new Set(visit?.itemIds ?? []);
  const rows = buildStatuses(ctx.data, ctx.today);
  const groups = [...new Set(rows.map((row) => row.item.group ?? t('อื่น ๆ')))];
  return groups.map((group) => [
    h('p', { class: 'group-title' }, group),
    rows.filter((row) => (row.item.group ?? t('อื่น ๆ')) === group)
      .map((row) => itemRow(ctx, row, visit, chosen.has(row.item.id))),
  ]);
};

const readForm = (form, base, data) => {
  const value = (name) => form.elements[name].value.trim();
  const itemIds = [...form.querySelectorAll('input[name=item]:checked')].map((box) => box.value);
  const brandable = itemIds.filter((id) => data.items.some((item) => item.id === id && isBrandable(item)));
  const parts = partsFrom(brandable.map((id) => [id, readBrand(form, id)]));
  return {
    id: base?.id ?? `v-${crypto.randomUUID()}`,
    date: value('date'),
    km: parseNumber(value('km')),
    roundKm: Number(value('roundKm')),
    itemIds,
    shop: value('shop'),
    cost: parseNumber(value('cost')),
    note: value('note'),
    kind: value('kind'),
    ...(Object.keys(parts).length ? { parts } : {}),
    ...(form.elements.isKmEstimated.checked ? { isKmEstimated: true } : {}),
  };
};

const selectDue = (form, ctx) => {
  const due = new Set(buildStatuses(ctx.data, ctx.today)
    .filter((row) => ['overdue', 'watch', 'soon'].includes(row.state)).map((row) => row.item.id));
  form.querySelectorAll('input[name=item]').forEach((box) => {
    box.checked = due.has(box.value);
    box.dispatchEvent(new Event('change'));
  });
};

const shopList = (data) => h('datalist', { id: 'shops' },
  [...new Set(data.visits.map((visit) => visit.shop).filter(Boolean))].map((shop) => h('option', { value: shop })));

const removeButton = (ctx, visit) => h('button', {
  class: 'btn btn-danger',
  type: 'button',
  onClick: async () => {
    if (!await confirmDialog(t('ลบการเข้าอู่วันที่ {date}? ย้อนกลับได้จากประวัติ commit เท่านั้น', { date: visit.date }), t('ลบ'))) return;
    try {
      await ctx.mutate((data) => deleteVisit(data, visit.id), `visit: delete ${visit.date}`);
      ctx.toast(t('ลบแล้ว'));
      ctx.go('#/history');
    } catch (failure) {
      ctx.toast(failure.message);
    }
  },
}, t('ลบ'));

const fields = (ctx, visit, round) => [
  h('div', { class: 'grid-2' },
    field(t('วันที่ *'), 'date', h('input', { id: 'date', name: 'date', type: 'date', max: ctx.today, value: visit?.date ?? ctx.today, required: true })),
    field(t('เลขไมล์ *'), 'km', h('input', {
      id: 'km', name: 'km', inputmode: 'numeric', autocomplete: 'off', required: true,
      value: String(visit?.km ?? estimateKm(ctx.data, ctx.today).km),
    }))),
  h('label', { class: 'check', htmlFor: 'isKmEstimated' },
    h('input', { type: 'checkbox', id: 'isKmEstimated', name: 'isKmEstimated', checked: Boolean(visit?.isKmEstimated) }),
    h('span', {}, t('เลขไมล์เป็นค่าประมาณ (ไม่ได้จดจากหน้าปัด)'))),
  field(t('หมวด'), 'kind', h('select', { id: 'kind', name: 'kind' },
    Object.entries(KINDS).map(([kind, label]) => h('option', { value: kind, selected: kind === (visit ? kindOf(visit) : 'service') }, t(label))))),
  field(t('รอบเช็คระยะ *'), 'roundKm', h('select', { id: 'roundKm', name: 'roundKm' }, roundOptions(ctx.data, round)),
    t('เข้าหลายอู่ในรอบเดียวกัน ให้เลือกรอบเดิม')),
  h('div', { class: 'grid-2' },
    field(t('อู่'), 'shop', h('input', { id: 'shop', name: 'shop', list: 'shops', maxlength: 200, value: visit?.shop ?? '' })),
    field(t('ค่าใช้จ่าย (บาท)'), 'cost', h('input', { id: 'cost', name: 'cost', inputmode: 'decimal', autocomplete: 'off', value: visit?.cost ?? '' }))),
  shopList(ctx.data),
  field(t('โน้ต'), 'note', h('textarea', { id: 'note', name: 'note', maxlength: 1000, value: visit?.note ?? '' })),
];

// A new visit's km starts as the estimate for the chosen date, until the user types one.
const followDate = (form, ctx) => {
  let isKmTouched = false;
  form.elements.km.addEventListener('input', () => { isKmTouched = true; });
  form.elements.date.addEventListener('change', (event) => {
    if (isKmTouched || !isValidDate(event.target.value)) return;
    const km = kmAt(ctx.data, event.target.value);
    form.elements.km.value = String(km);
    if (event.target.value < ctx.today) form.elements.roundKm.value = String(roundForKm(km, ctx.data.car.roundKm));
  });
};

export const renderVisit = (ctx, visitId) => {
  const visit = ctx.data.visits.find((entry) => entry.id === visitId);
  const round = visit?.roundKm ?? defaultRound(ctx.data, ctx.today);
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('บันทึก'));
  const onSubmit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    const next = readForm(event.target, visit, ctx.data);
    try {
      await submitting(save, () => ctx.mutate((data) => {
        const errors = validateVisit(data, next, ctx.today);
        if (errors.length) throw new Error(errors.join(' · '));
        return addVisit(data, next);
      }, `visit: ${next.date} round ${next.roundKm}`));
      ctx.toast(t('บันทึกแล้ว'));
      ctx.go('#/history');
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
      error.scrollIntoView({ block: 'center' });
    }
  };
  const form = h('form', { class: 'stack', onSubmit, novalidate: true },
    h('h1', {}, visit ? t('แก้การเข้าอู่') : t('บันทึกการเข้าอู่')),
    fields(ctx, visit, round),
    h('fieldset', { class: 'card' },
      h('legend', {}, t('งานที่ทำ *')),
      h('button', { class: 'btn', type: 'button', onClick: () => selectDue(form, ctx) }, t('เลือกงานที่ถึงกำหนด')),
      h('p', { class: 'muted' }, t('รายการที่มียี่ห้อ ติ๊กแล้วเลือกยี่ห้อได้ ยี่ห้อที่พิมพ์ใหม่จะขึ้นในตัวเลือกครั้งต่อไป')),
      itemChecks(ctx, visit)),
    error,
    save,
    visit ? removeButton(ctx, visit) : null);
  if (!visit) followDate(form, ctx);
  return form;
};
