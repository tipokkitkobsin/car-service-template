// Thai is the source language: t() takes the Thai text and returns it, or its English translation.
// {name} placeholders are filled from vars. Missing translations fall back to the Thai text.
import { en } from './lang/en.js';

export const LANGUAGES = { th: 'ไทย', en: 'English' }; // i18n-ignore: language names stay in their own language
const DICTIONARIES = { en };
const DEFAULT_LANGUAGE = 'th';
let current = DEFAULT_LANGUAGE;

export const setLanguage = (language) => {
  current = language in LANGUAGES ? language : DEFAULT_LANGUAGE;
};

export const getLanguage = () => current;

// Saved choice first, then the browser's language: Thai browsers get Thai, everyone else English.
export const pickLanguage = (saved, browserLanguage = '') => {
  if (saved in LANGUAGES) return saved;
  return String(browserLanguage).toLowerCase().startsWith('th') ? 'th' : 'en';
};

// "text|context" tells apart the same Thai word with different English meanings; Thai shows the text only.
export const t = (text, vars = {}) => {
  const template = DICTIONARIES[current]?.[text] ?? text.split('|')[0];
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
};

// Marks Thai text for translation without translating it yet. Used for constants made at load time,
// which are passed through t() when shown, so a language change takes effect at once.
export const tx = (text) => text;

// One text in a given language, without changing the current language (used for Discord command names).
export const translateTo = (language, text, vars = {}) => {
  const saved = current;
  setLanguage(language);
  try {
    return t(text, vars);
  } finally {
    current = saved;
  }
};
