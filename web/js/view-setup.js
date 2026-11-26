// First-run form: makes the car file in an empty data repo.
import { GEARBOXES, STARTER_ITEMS, defaultPicks } from '../core/starter-items.js';
import { validateSetup } from '../core/setup.js';
import { formatKm } from '../core/schedule.js';
import { field, h, parseNumber, submitting } from './dom.js';
import { languageSwitch } from './view-settings.js';
import { t } from '../core/i18n.js';

const GEARBOX_IDS = new Set(STARTER_ITEMS.filter((item) => item.gearbox).map((item) => item.id));
const AGE_ONLY = new Set(['record', 'event']);

const ruleText = (item) => {
  if (item.rule === 'calendar') return t('ทุกปี เดือนที่ {month}', { month: item.calendarMonth });
  if (item.intervalDays) return t('ราว {days} วัน (เตือนเบา ๆ)', { days: item.intervalDays });
  if (item.rule === 'interval') return t('ทุก {km} km หรือ {months} เดือน', { km: formatKm(item.intervalKm), months: item.intervalMonths });
  return t('จดอายุการใช้งาน');
};

const lastDoneFields = (item, today) => h('details', { class: 'last-done' },
  h('summary', {}, t('ทำล่าสุดเมื่อ (ไม่บังคับ)')),
  h('div', { class: 'grid-2' },
    field(t('วันที่'), `last-date-${item.id}`, h('input', { id: `last-date-${item.id}`, name: `last-date-${item.id}`, type: 'date', max: today })),
    item.rule === 'calendar' ? null
      : field(t('เลขไมล์'), `last-km-${item.id}`, h('input', { id: `last-km-${item.id}`, name: `last-km-${item.id}`, inputmode: 'numeric', autocomplete: 'off' }))));

const itemRow = (item, isChosen, today) => {
  const extra = AGE_ONLY.has(item.rule) ? null : lastDoneFields(item, today);
  const box = h('input', { type: 'checkbox', name: 'pick', value: item.id, checked: isChosen });
  if (extra) {
    extra.hidden = !isChosen;
    box.addEventListener('change', () => { extra.hidden = !box.checked; });
  }
  return h('div', { class: 'setup-item' },
    h('label', { class: 'check' }, box, h('span', {}, t(item.name), h('small', { class: 'muted' }, ruleText(item)))),
    extra);
};

const itemList = (today) => {
  const chosen = new Set(defaultPicks('auto'));
  const groups = [...new Set(STARTER_ITEMS.map((item) => item.group))];
  return groups.map((group) => [
    h('p', { class: 'group-title' }, t(group)),
    STARTER_ITEMS.filter((item) => item.group === group).map((item) => itemRow(item, chosen.has(item.id), today)),
  ]);
};

const optionalNumber = (form, name) => {
  const input = form.elements[name];
  return input ? parseNumber(input.value) ?? undefined : undefined;
};

const readForm = (form) => {
  const value = (name) => form.elements[name].value.trim();
  const picks = [...form.querySelectorAll('input[name=pick]:checked')].map((box) => ({
    id: box.value,
    lastDate: form.elements[`last-date-${box.value}`]?.value || undefined,
    lastKm: optionalNumber(form, `last-km-${box.value}`),
  }));
  return {
    name: value('name'),
    deliveredOn: value('deliveredOn'),
    currentKm: parseNumber(value('currentKm')),
    roundKm: parseNumber(value('roundKm')),
    roundMonths: parseNumber(value('roundMonths')),
    gearbox: value('gearbox'),
    picks,
  };
};

// Switching the gearbox ticks the matching gear oil and unticks the other one.
const followGearbox = (form) => form.querySelectorAll('input[name=gearbox]').forEach((radio) => {
  radio.addEventListener('change', () => {
    const wanted = new Set(defaultPicks(radio.value));
    form.querySelectorAll('input[name=pick]').forEach((box) => {
      if (!GEARBOX_IDS.has(box.value)) return;
      box.checked = wanted.has(box.value);
      box.dispatchEvent(new Event('change'));
    });
  });
});

const carFields = (today) => [
  field(t('ชื่อรถ *'), 'name', h('input', { id: 'name', name: 'name', maxlength: 80, required: true, placeholder: t('เช่น Toyota Yaris 1.2 สีขาว') })),
  h('div', { class: 'grid-2' },
    field(t('วันรับรถ *'), 'deliveredOn', h('input', { id: 'deliveredOn', name: 'deliveredOn', type: 'date', max: today, required: true }),
      t('ถ้าเป็นรถมือสอง ใช้วันจดทะเบียนครั้งแรก')),
    field(t('เลขไมล์ตอนนี้ *'), 'currentKm', h('input', { id: 'currentKm', name: 'currentKm', inputmode: 'numeric', autocomplete: 'off', required: true }))),
  h('div', { class: 'grid-2' },
    field(t('เช็คระยะทุกกี่ km'), 'roundKm', h('input', { id: 'roundKm', name: 'roundKm', inputmode: 'numeric', value: '10000' })),
    field(t('หรือทุกกี่เดือน'), 'roundMonths', h('input', { id: 'roundMonths', name: 'roundMonths', inputmode: 'numeric', value: '6' }))),
  h('fieldset', { class: 'choice' },
    h('legend', {}, t('เกียร์')),
    Object.entries(GEARBOXES).map(([value, label]) => h('label', { class: 'check' },
      h('input', { type: 'radio', name: 'gearbox', value, checked: value === 'auto' }), h('span', {}, t(label))))),
];

export const renderSetup = ({ today, onCreate, onLanguage }) => {
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('สร้างข้อมูลรถ'));
  const onSubmit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    const setup = readForm(event.target);
    const errors = validateSetup(setup, today);
    try {
      if (errors.length) throw new Error(errors.join(' · '));
      await submitting(save, () => onCreate(setup));
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
      error.scrollIntoView({ block: 'center' });
    }
  };
  const form = h('form', { class: 'stack', onSubmit, novalidate: true },
    h('section', { class: 'card stack' },
      languageSwitch(onLanguage),
      h('h1', {}, t('ตั้งค่ารถครั้งแรก')),
      h('p', { class: 'muted' }, t('repo ข้อมูลยังว่าง กรอกข้อมูลรถแล้วระบบจะสร้างไฟล์ให้ แก้ทุกอย่างได้ภายหลังในหน้าตั้งค่า')),
      carFields(today)),
    h('fieldset', { class: 'card' },
      h('legend', {}, t('รายการที่จะดูแล')),
      h('p', { class: 'muted' }, t('ระยะเป็นค่าทั่วไป ควรเทียบกับสมุดคู่มือรถของคุณ รายการที่ไม่ใส่วันที่ทำล่าสุด จะนับเริ่มจากวันนี้')),
      itemList(today)),
    error,
    save);
  followGearbox(form);
  return form;
};
