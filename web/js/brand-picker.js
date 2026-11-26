// Brand dropdown for one item: brands used before, plus "other" for typing a new one.
// A typed brand is saved on the visit, so it shows up in this list next time.
import { knownBrands } from '../core/records.js';
import { h } from './dom.js';
import { t } from '../core/i18n.js';

const OTHER = '__other';
// Saved in visit data as Thai text, so it is compared in Thai and only translated for display.
const UNKNOWN = 'ไม่ทราบยี่ห้อ'; // i18n-ignore: stored value

export const brandPicker = (data, item, current, isOpen) => {
  const known = knownBrands(data, item.id).filter((brand) => brand !== UNKNOWN);
  const withCurrent = current && current !== UNKNOWN && !known.includes(current) ? [current, ...known] : known;
  const options = [...withCurrent, UNKNOWN];
  const text = h('input', {
    name: `brand-text-${item.id}`, maxlength: 100, autocomplete: 'off', hidden: true,
    placeholder: t('พิมพ์ยี่ห้อ/รุ่น'), 'aria-label': t('ยี่ห้อใหม่ของ {name}', { name: item.name }),
  });
  const select = h('select', { name: `brand-${item.id}`, 'aria-label': t('ยี่ห้อของ {name}', { name: item.name }) },
    h('option', { value: '', selected: !current }, t('ไม่ระบุยี่ห้อ')),
    options.map((brand) => h('option', { value: brand, selected: brand === current }, t(brand))),
    h('option', { value: OTHER }, t('อื่นๆ (พิมพ์เอง)')));
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
