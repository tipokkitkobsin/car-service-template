import { deleteReading, updateReading, validateReading } from '../core/records.js';
import { formatDate, formatKm } from '../core/schedule.js';
import { confirmDialog, field, h, parseNumber, submitting } from './dom.js';
import { t } from '../core/i18n.js';

const deleteButton = (ctx, reading) => h('button', {
  class: 'btn btn-danger',
  type: 'button',
  onClick: async () => {
    const message = t('ลบเลขไมล์ {km} km ของวันที่ {date}?', { km: formatKm(reading.km), date: formatDate(reading.date) });
    if (!await confirmDialog(message, t('ลบ'))) return;
    try {
      await ctx.mutate((data) => deleteReading(data, reading.date), `km: delete ${reading.date}`);
      ctx.toast(t('ลบแล้ว'));
      ctx.go('#/history');
    } catch (failure) {
      ctx.toast(failure.message);
    }
  },
}, t('ลบ'));

export const renderReading = (ctx, date) => {
  const reading = ctx.data.readings.find((entry) => entry.date === date);
  if (!reading) {
    return h('div', { class: 'card stack' },
      h('h1', {}, t('ไม่พบเลขไมล์นี้')),
      h('a', { class: 'btn', href: '#/history' }, t('กลับไปประวัติ')));
  }
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('บันทึก'));
  const onSubmit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    const form = event.target;
    const next = { date: form.elements.date.value, km: parseNumber(form.elements.km.value) };
    try {
      await submitting(save, () => ctx.mutate((data) => {
        const errors = validateReading(data, next, ctx.today, { replaceDate: reading.date });
        if (errors.length) throw new Error(errors[0]);
        return updateReading(data, reading.date, next);
      }, `km: edit ${reading.date}`));
      ctx.toast(t('แก้แล้ว'));
      ctx.go('#/history');
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    }
  };
  return h('form', { class: 'stack', onSubmit, novalidate: true },
    h('h1', {}, t('แก้เลขไมล์')),
    h('div', { class: 'grid-2' },
      field(t('วันที่'), 'date', h('input', { id: 'date', name: 'date', type: 'date', max: ctx.today, value: reading.date, required: true })),
      field(t('เลขไมล์'), 'km', h('input', { id: 'km', name: 'km', inputmode: 'numeric', autocomplete: 'off', value: String(reading.km), required: true }))),
    error,
    save,
    deleteButton(ctx, reading));
};
