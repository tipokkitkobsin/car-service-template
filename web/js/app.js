import { todayInBangkok } from '../core/schedule.js';
import { h, icon } from './dom.js';
import { buildCar } from '../core/setup.js';
import {
  clearToken, openStore, readLanguage, readToken, writeLanguage, writeSource, writeToken,
} from './session.js';
import { updateCar } from '../core/items.js';
import { renderItemEdit, renderItems } from './view-items.js';
import { renderSetup } from './view-setup.js';
import { renderHistory } from './view-history.js';
import { renderOverview } from './view-overview.js';
import { renderReading } from './view-reading.js';
import { renderTimeline } from './view-timeline.js';
import { renderLogin, renderSettings } from './view-settings.js';
import { renderVisit } from './view-visit.js';
import {
  getLanguage, pickLanguage, setLanguage, t, tx,
} from '../core/i18n.js';

const TOAST_MS = 3500;
const TABS = [
  { hash: '#/', label: tx('ภาพรวม'), icon: 'gauge' },
  { hash: '#/visit', label: tx('บันทึก|nav'), icon: 'plus' },
  { hash: '#/timeline', label: tx('ไทม์ไลน์'), icon: 'route' },
  { hash: '#/history', label: tx('ประวัติ'), icon: 'history' },
  { hash: '#/settings', label: tx('ตั้งค่า'), icon: 'settings' },
];

const main = document.getElementById('main');
const nav = document.getElementById('nav');
const toastBox = document.getElementById('toast');
let session = null;
let toastTimer = null;

// Sets the language and the page parts that live outside the views.
const applyLanguage = (language) => {
  setLanguage(language);
  document.documentElement.lang = getLanguage();
  document.title = t('เช็คระยะ');
  document.querySelector('.skip').textContent = t('ข้ามไปเนื้อหา');
  nav.setAttribute('aria-label', t('เมนูหลัก'));
};

const toast = (message) => {
  toastBox.textContent = message;
  toastBox.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastBox.classList.remove('show'), TOAST_MS);
};

const currentRoute = () => {
  const hash = location.hash || '#/';
  return hash.startsWith('#/') ? hash : '#/';
};

const renderNav = (route) => {
  const active = route.startsWith('#/items') ? '#/settings'
    : route.startsWith('#/visit/') || route.startsWith('#/reading/') ? '#/history'
    : route.startsWith('#/visit') ? '#/visit' : route;
  nav.replaceChildren(...TABS.map((tab) => h('a', {
    href: tab.hash,
    'aria-current': tab.hash === active ? 'page' : null,
  }, icon(tab.icon), t(tab.label))));
  nav.hidden = false;
};

const go = (hash) => {
  if (location.hash === hash) render();
  else location.hash = hash;
};

const mutate = async (change, message) => {
  const saved = await session.store.update(change, message);
  session = { ...session, data: saved.data };
  if (!document.querySelector('dialog')) render();
  return saved;
};

const viewFor = (route, ctx) => {
  if (route.startsWith('#/visit/')) return renderVisit(ctx, decodeURIComponent(route.slice('#/visit/'.length)));
  if (route === '#/visit') return renderVisit(ctx, null);
  if (route.startsWith('#/reading/')) return renderReading(ctx, route.slice('#/reading/'.length));
  if (route === '#/history') return renderHistory(ctx);
  if (route === '#/timeline') return renderTimeline(ctx);
  if (route === '#/settings') return renderSettings(ctx);
  if (route === '#/items') return renderItems(ctx);
  if (route.startsWith('#/items/')) return renderItemEdit(ctx, decodeURIComponent(route.slice('#/items/'.length)));
  return renderOverview(ctx);
};

// Saved with the car data, so Discord follows it too, and remembered in this browser for the login page.
const changeLanguage = async (language) => {
  writeLanguage(language);
  await mutate((data) => updateCar(data, { language }), `car: language ${language}`);
};

function render() {
  if (!session) return;
  applyLanguage(session.data.car.language ?? getLanguage());
  const route = currentRoute();
  const ctx = {
    data: session.data, today: todayInBangkok(), mutate, toast, go, changeLanguage, reload: () => location.reload(),
  };
  main.replaceChildren(viewFor(route, ctx));
  renderNav(route);
}

const showLogin = (message) => {
  session = null;
  nav.hidden = true;
  const onLanguage = (language) => {
    writeLanguage(language);
    applyLanguage(language);
    showLogin(message);
  };
  main.replaceChildren(renderLogin({ onToken: connect, onLanguage, message }));
};

const PUBLIC_REPO = tx('repo ข้อมูลเป็น Public ทุกคนจะเห็นข้อมูลรถ ให้ใช้ repo ที่เป็น Private (ดูขั้นที่ 3 ในคู่มือ)');
const NO_REPO = tx('ไม่พบ repo ข้อมูล หรือ token ไม่มีสิทธิ์ ตรวจชื่อบัญชี ชื่อ repo และสิทธิ์ของ token');

const rememberToken = (token, shouldRemember) => {
  if (shouldRemember !== undefined && !writeToken(token, shouldRemember)) {
    toast(t('เบราว์เซอร์นี้จำ token ไม่ได้ ต้องใส่ใหม่ทุกครั้ง'));
  }
};

// An empty data repo gets the first-run setup form instead of an error.
const showSetup = (store) => {
  nav.hidden = true;
  const today = todayInBangkok();
  main.replaceChildren(renderSetup({
    today,
    onLanguage: (language) => {
      writeLanguage(language);
      applyLanguage(language);
      showSetup(store);
    },
    onCreate: async (form) => {
      const { data } = await store.create(buildCar(form, today), 'setup: create car');
      session = { store, data };
      if (location.hash && location.hash !== '#/') location.hash = '#/';
      render();
      toast(t('สร้างข้อมูลรถแล้ว'));
    },
  }));
};

const loadOrSetup = async (store) => {
  try {
    return (await store.load()).data;
  } catch (failure) {
    if (failure.code !== 'missing') throw failure;
    const status = await store.repoStatus();
    if (status === 'missing') throw Object.assign(new Error(t(NO_REPO)), { code: 'missing' });
    // Car data must never be written into a public repo, such as the site repo itself.
    if (status === 'public') throw Object.assign(new Error(t(PUBLIC_REPO)), { code: 'public' });
    return null;
  }
};

async function connect(token, shouldRemember, source) {
  if (source) writeSource(source);
  const store = openStore(token);
  const data = await loadOrSetup(store);
  rememberToken(token, shouldRemember);
  if (!data) {
    showSetup(store);
    return;
  }
  session = { store, data };
  render();
}

const boot = async () => {
  applyLanguage(pickLanguage(readLanguage(), navigator.language));
  const token = readToken();
  if (!token) {
    showLogin();
    return;
  }
  try {
    await connect(token);
  } catch (failure) {
    if (failure.code === 'auth') clearToken();
    showLogin(failure.message);
  }
};

window.addEventListener('hashchange', () => {
  render();
  if (session) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
});

if (window.top === window.self) boot();
else main.textContent = t('เปิดเว็บนี้ในแท็บของตัวเองเท่านั้น');
