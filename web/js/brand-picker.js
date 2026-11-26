// Brand dropdown for one item: brands used before, plus "other" for typing a new one.
// A typed brand is saved on the visit, so it shows up in this list next time.
import { knownBrands } from '../core/records.js';
import { h } from './dom.js';

const OTHER = '__other';
const UNKNOWN = 'ไม่ทราบยี่ห้อ';

export const brandPicker = (data, item, current, isOpen) => {
  const known = knownBrands(data, item.id).filter((brand) => brand !== UNKNOWN);
  const withCurrent = current && current !== UNKNOWN && !known.includes(current) ? [current, ...known] : known;
  const options = [...withCurrent, UNKNOWN];
  const text = h('input', {
    name: `brand-text-${item.id}`, maxlength: 100, autocomplete: 'off', hidden: true,
    placeholder: 'พิมพ์ยี่ห้อ/รุ่น', 'aria-label': `ยี่ห้อใหม่ของ ${item.name}`,
  });
  const select = h('select', { name: `brand-${item.id}`, 'aria-label': `ยี่ห้อของ ${item.name}` },
    h('option', { value: '', selected: !current }, 'ไม่ระบุยี่ห้อ'),
    options.map((brand) => h('option', { value: brand, selected: brand === current }, brand)),
    h('option', { value: OTHER }, 'อื่นๆ (พิมพ์เอง)'));
  select.addEventListener('change', () => {
    text.hidden = select.value !== OTHER;
    if (!text.hidden) text.focus();
  });
  return h('div', { class: 'brand-pick', 'data-item': item.id, hidden: !isOpen }, select, text);
};

export const readBrand = (form, itemId) => {
  const select = form.elements[`brand-${itemId}`];
  if (!select) return '';
  return select.value === OTHER ? form.elements[`brand-text-${itemId}`].value : select.value;
};
