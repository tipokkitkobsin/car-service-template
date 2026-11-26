// Small DOM helpers. Text always goes in as text nodes, never as HTML.
const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  gauge: ['m12 14 4-4', 'M3.34 19a10 10 0 1 1 17.32 0'],
  plus: ['M5 12h14', 'M12 5v14'],
  history: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', 'M12 7v5l4 2'],
  settings: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M2 14h4', 'M10 8h4', 'M18 16h4'],
  alert: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4', 'M12 17h.01'],
  clock: ['M12 6v6l4 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'],
  check: ['M20 6 9 17l-5-5'],
  search: ['m21 21-4.3-4.3', 'M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0'],
  note: ['M4 5h16', 'M4 12h16', 'M4 19h10'],
  wrench: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'],
  sparkle: ['M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z'],
  flag: ['M4 22V4', 'M4 4h12l-2 4 2 4H4'],
  route: ['M3 12h4l3-8 4 16 3-8h4'],
};

export const STATUS = {
  overdue: { label: 'เกินกำหนด', icon: 'alert' },
  check: { label: 'ต้องตรวจ', icon: 'search' },
  watch: { label: 'ช่วงระวัง', icon: 'alert' },
  soon: { label: 'ใกล้ถึง', icon: 'clock' },
  ok: { label: 'ปกติ', icon: 'check' },
  record: { label: 'บันทึก', icon: 'note' },
};

export const icon = (name) => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  ICONS[name].forEach((d) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  });
  return svg;
};

const setProp = (el, key, value) => {
  if (value === null || value === undefined || value === false) return;
  if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
  else if (key === 'class') el.className = value;
  else if (key === 'htmlFor' || key === 'value' || key === 'checked' || key === 'disabled') el[key] = value;
  else el.setAttribute(key, value === true ? '' : value);
};

export const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => setProp(el, key, value));
  el.append(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
  return el;
};

export const tag = (state) => h('span', { class: `tag tag-${state}` }, icon(STATUS[state].icon), STATUS[state].label);

export const field = (label, id, control, help) => h('div', { class: 'field' },
  h('label', { htmlFor: id }, label),
  control,
  help ? h('span', { class: 'muted' }, help) : null);

export const parseNumber = (text) => {
  const clean = String(text).replace(/[,\s]/g, '');
  return clean === '' ? null : Number(clean);
};

export const confirmDialog = (message, confirmLabel) => new Promise((resolve) => {
  const dialog = h('dialog', {});
  const close = (answer) => { dialog.close(); dialog.remove(); resolve(answer); };
  dialog.append(
    h('p', {}, message),
    h('div', { class: 'actions', style: null },
      h('button', { class: 'btn', type: 'button', onClick: () => close(false) }, 'ยกเลิก'),
      h('button', { class: 'btn btn-danger', type: 'button', onClick: () => close(true) }, confirmLabel)),
  );
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(false); });
  document.body.append(dialog);
  dialog.showModal();
});

export const submitting = async (button, work) => {
  button.disabled = true;
  try {
    return await work();
  } finally {
    button.disabled = false;
  }
};
