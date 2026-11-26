import { field, h } from './dom.js';
import { clearToken, readSource } from './session.js';

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

const sourceFields = (source) => h('div', { class: 'grid-2' },
  field('บัญชี GitHub', 'owner', h('input', {
    id: 'owner', name: 'owner', autocomplete: 'off', spellcheck: 'false', required: true, value: source.owner,
  })),
  field('repo ข้อมูล', 'repo', h('input', {
    id: 'repo', name: 'repo', autocomplete: 'off', spellcheck: 'false', required: true, value: source.repo,
  })));

export const renderLogin = ({ onToken, message }) => {
  const source = readSource();
  const input = h('input', { id: 'token', type: 'password', autocomplete: 'off', spellcheck: 'false', required: true });
  const remember = h('input', { type: 'checkbox', id: 'remember' });
  const error = h('p', { class: 'error', role: 'alert', hidden: !message }, message ?? '');
  const button = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'เชื่อมต่อ');
  const onSubmit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    const form = event.target.elements;
    const chosen = { owner: form.owner.value.trim(), repo: form.repo.value.trim() };
    button.disabled = true;
    try {
      await onToken(input.value.trim(), remember.checked, chosen);
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  };
  return h('form', { class: 'card stack', onSubmit },
    h('h1', {}, 'เชื่อมต่อข้อมูลรถ'),
    h('p', { class: 'muted' }, 'ข้อมูลรถเก็บใน repo private ของคุณเอง ใส่ชื่อบัญชีและชื่อ repo ที่สร้างไว้'),
    sourceFields(source),
    h('p', { class: 'muted' }, 'ใช้ fine-grained token ที่เลือกเฉพาะ repo ข้อมูล และให้สิทธิ์ Contents: Read and write'),
    h('a', { href: TOKEN_URL, target: '_blank', rel: 'noopener noreferrer' }, 'สร้าง token บน GitHub'),
    field('GitHub token', 'token', input, 'ปกติจะหายเมื่อปิดเบราว์เซอร์'),
    h('label', { class: 'check', htmlFor: 'remember' }, remember, h('span', {}, 'จำในเครื่องส่วนตัวนี้')),
    h('p', { class: 'muted' }, `ถ้าจำไว้ เว็บอื่นใน ${location.host} จะอ่าน token ได้ จึงไม่ควรเปิดเว็บที่ไม่ไว้ใจใต้โดเมนนี้`),
    error,
    button);
};

const backup = (data) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = h('a', { href: url, download: 'car-service-backup.json' });
  link.click();
  URL.revokeObjectURL(url);
};

export const renderSettings = (ctx) => {
  const source = readSource();
  return h('div', { class: 'stack' },
    h('h1', {}, 'ตั้งค่า'),
    h('section', { class: 'card stack' },
      h('h2', {}, 'รถและรายการดูแล'),
      h('p', { class: 'muted' }, 'แก้ชื่อรถ รอบเช็คระยะ และเพิ่ม แก้ หรือลบรายการอะไหล่'),
      h('a', { class: 'btn', href: '#/items' }, 'จัดการรถและรายการ')),
    h('section', { class: 'card stack' },
      h('h2', {}, 'ข้อมูลและการเชื่อมต่อ'),
      h('p', { class: 'muted' }, `ข้อมูลอยู่ใน repo private ${source.owner}/${source.repo}`),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onClick: () => backup(ctx.data) }, 'ดาวน์โหลดสำรอง'),
        h('button', {
          class: 'btn btn-danger',
          type: 'button',
          onClick: () => { clearToken(); ctx.reload(); },
        }, 'ออกจากเครื่องนี้'))));
};
