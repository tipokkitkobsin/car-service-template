import { todayInBangkok } from '../core/schedule.js';
import { h, icon } from './dom.js';
import { buildCar } from '../core/setup.js';
import {
  clearToken, openGarage, readCurrentCar, readLanguage, readToken, writeCurrentCar, writeLanguage, writeSource, writeToken,
} from './session.js';
import { MAIN_CAR, makeCarId } from '../core/garage.js';
import { renderGarage } from './view-garage.js';
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
  const active = route.startsWith('#/car/') ? '#/'
    : route.startsWith('#/items') || route === '#/add-car' ? '#/settings'
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

// session: { garage, cars: [{ id, store, data }], currentId }. Views work on the current car.
const currentCar = () => session.cars.find((car) => car.id === session.currentId) ?? session.cars[0];

const selectCar = (id) => {
  if (!session.cars.some((car) => car.id === id)) return;
  session = { ...session, currentId: id };
  writeCurrentCar(id);
};

const mutate = async (change, message) => {
  const car = currentCar();
  const saved = await car.store.update(change, message);
  session = { ...session, cars: session.cars.map((entry) => (entry.id === car.id ? { ...entry, data: saved.data } : entry)) };
  if (!document.querySelector('dialog')) render();
  return saved;
};

const addCar = (id, store, data) => {
  session = { ...session, cars: [...session.cars, { id, store, data }] };
  selectCar(id);
};

const deleteCar = async () => {
  const car = currentCar();
  if (car.id === MAIN_CAR) return;
  await car.store.remove(`car: delete ${car.id}`);
  session = { ...session, cars: session.cars.filter((entry) => entry.id !== car.id) };
  selectCar(session.cars[0].id);
  go('#/');
};

const setupView = (ctx) => renderSetup({
  today: ctx.today,
  onLanguage: (language) => {
    writeLanguage(language);
    applyLanguage(language);
    main.replaceChildren(setupView(ctx));
  },
  onCreate: async (form) => {
    const id = makeCarId(form.name, session.cars.map((car) => car.id));
    const store = session.garage.storeFor(id);
    const { data } = await store.create(buildCar(form, ctx.today), `setup: add car ${id}`);
    addCar(id, store, data);
    toast(t('สร้างข้อมูลรถแล้ว'));
    go(`#/car/${id}`);
  },
});

// A car picker above every page except the all-cars overview.
const carSwitcher = () => {
  const select = h('select', { 'aria-label': t('เลือกรถ') },
    session.cars.map((car) => h('option', { value: car.id, selected: car.id === currentCar().id }, car.data.car.name)));
  select.addEventListener('change', () => {
    selectCar(select.value);
    render();
  });
  return h('div', { class: 'car-switch' }, select);
};

const viewFor = (route, ctx) => {
  if (route === '#/' && session.cars.length > 1) return renderGarage(ctx);
  if (route.startsWith('#/car/')) return renderOverview(ctx);
  if (route === '#/add-car') return setupView(ctx);
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
  const route = currentRoute();
  if (route.startsWith('#/car/')) selectCar(decodeURIComponent(route.slice('#/car/'.length)));
  const car = currentCar();
  applyLanguage(car.data.car.language ?? getLanguage());
  const ctx = {
    data: car.data,
    carId: car.id,
    cars: session.cars,
    today: todayInBangkok(),
    mutate,
    toast,
    go,
    changeLanguage,
    deleteCar,
    reload: () => location.reload(),
  };
  const showSwitcher = session.cars.length > 1 && route !== '#/' && route !== '#/add-car';
  main.replaceChildren(...[showSwitcher ? carSwitcher() : null, viewFor(route, ctx)].filter(Boolean));
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
const showSetup = (garage) => {
  const store = garage.storeFor(MAIN_CAR);
  nav.hidden = true;
  const today = todayInBangkok();
  main.replaceChildren(renderSetup({
    today,
    onLanguage: (language) => {
      writeLanguage(language);
      applyLanguage(language);
      showSetup(garage);
    },
    onCreate: async (form) => {
      const { data } = await store.create(buildCar(form, today), 'setup: create car');
      session = { garage, cars: [{ id: MAIN_CAR, store, data }], currentId: MAIN_CAR };
      if (location.hash && location.hash !== '#/') location.hash = '#/';
      render();
      toast(t('สร้างข้อมูลรถแล้ว'));
    },
  }));
};

// No car files yet: either the repo is missing or unreadable, or it is empty and ready for setup.
const checkEmptyRepo = async (garage) => {
  const status = await garage.storeFor(MAIN_CAR).repoStatus();
  if (status === 'missing') throw Object.assign(new Error(t(NO_REPO)), { code: 'missing' });
  // Car data must never be written into a public repo, such as the site repo itself.
  if (status === 'public') throw Object.assign(new Error(t(PUBLIC_REPO)), { code: 'public' });
};

const loadCars = (garage, ids) => Promise.all(ids.map(async (id) => {
  const store = garage.storeFor(id);
  return { id, store, data: (await store.load()).data };
}));

async function connect(token, shouldRemember, source) {
  if (source) writeSource(source);
  const garage = openGarage(token);
  const ids = await garage.listCars();
  if (ids.length === 0) await checkEmptyRepo(garage);
  rememberToken(token, shouldRemember);
  if (ids.length === 0) {
    showSetup(garage);
    return;
  }
  const cars = await loadCars(garage, ids);
  const saved = readCurrentCar();
  session = { garage, cars, currentId: ids.includes(saved) ? saved : ids[0] };
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
