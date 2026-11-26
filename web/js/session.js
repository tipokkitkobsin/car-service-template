// The GitHub token stays in this browser. By default it ends with the browser session.
// The data source (owner and repo name) is not secret and is remembered in localStorage.
import { createGarage } from '../core/github-store.js';
import { defaultSource, sourceErrors } from '../core/source.js';

const TOKEN_KEY = 'car-service.token';
const SOURCE_KEY = 'car-service.source';
const LANGUAGE_KEY = 'car-service.language';
const CAR_KEY = 'car-service.car';

const attempt = (work, fallback) => {
  try {
    return work();
  } catch {
    return fallback;
  }
};

export const readToken = () => attempt(
  () => sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY),
  null,
);

export const clearToken = () => {
  attempt(() => sessionStorage.removeItem(TOKEN_KEY));
  attempt(() => localStorage.removeItem(TOKEN_KEY));
};

export const writeToken = (token, shouldRemember) => attempt(() => {
  clearToken();
  (shouldRemember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  return true;
}, false);

export const readSource = () => {
  const saved = attempt(() => JSON.parse(localStorage.getItem(SOURCE_KEY)), null);
  return saved && sourceErrors(saved).length === 0
    ? { owner: saved.owner, repo: saved.repo }
    : defaultSource(location.hostname);
};

export const writeSource = (source) => {
  const errors = sourceErrors(source);
  if (errors.length) throw new Error(errors.join(' · '));
  attempt(() => localStorage.setItem(SOURCE_KEY, JSON.stringify({ owner: source.owner, repo: source.repo })));
};

export const openGarage = (token, source = readSource()) => createGarage({ ...source, token });

// The car last looked at in this browser.
export const readCurrentCar = () => attempt(() => localStorage.getItem(CAR_KEY), null);
export const writeCurrentCar = (id) => attempt(() => localStorage.setItem(CAR_KEY, id));

// The language chosen in this browser, used before the car data has loaded.
export const readLanguage = () => attempt(() => localStorage.getItem(LANGUAGE_KEY), null);
export const writeLanguage = (language) => attempt(() => localStorage.setItem(LANGUAGE_KEY, language));
