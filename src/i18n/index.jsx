import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import en from './en.js';
import { readLocalString, writeLocal } from '../lib/storage.js';

// code: what we store and send to the server; label: shown in its own
// language; speech: the BCP 47 tag used to pick a text-to-speech voice.
export const LANGUAGES = [
  { code: 'en', label: 'English', speech: 'en-SG' },
  { code: 'zh', label: '中文', speech: 'zh-CN' },
  { code: 'ms', label: 'Bahasa Melayu', speech: 'ms-MY' },
  { code: 'ta', label: 'தமிழ்', speech: 'ta-IN' },
];
// English ships with the app. Other languages are separate chunks that are
// only downloaded when someone picks them (code splitting), so English users
// don't pay for ~100 kB of text they never see.
const LOADERS = {
  zh: () => Promise.all([import('./zh.js'), import('../data/i18n/zh.json')]),
  ms: () => Promise.all([import('./ms.js'), import('../data/i18n/ms.json')]),
  ta: () => Promise.all([import('./ta.js'), import('../data/i18n/ta.json')]),
};
export async function loadLanguage(code) {
  if (code === 'en' || !Object.hasOwn(LOADERS, code)) return { strings: en, items: {} };
  const [strings, items] = await LOADERS[code]();
  return { strings: strings.default, items: items.default };
}
const ITEM_FIELDS = ['name', 'material', 'answer', 'instruction', 'tip'];
export const isSupported = code => LANGUAGES.some(l => l.code === code);

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : match));

// Pure translator: easy to test without React. pack = { strings, items } for
// the language; anything missing falls back to English.
export function createTranslator(lang, pack = { strings: en, items: {} }) {
  const dict = pack.strings || en;
  // Falls back to English, then to the key itself, so a missing translation
  // shows something readable instead of crashing the page.
  const t = (key, vars = {}) => fill(dict[key] ?? en[key] ?? key, vars);
  const tn = (key, count, vars = {}) => t(`${key}_${count === 1 ? 'one' : 'other'}`, { count, ...vars });
  const localizeItem = item => {
    if (!item || lang === 'en') return item;
    const tr = pack.items?.[item.id];
    if (!tr) return item;
    const localized = { ...item };
    for (const field of ITEM_FIELDS) if (tr[field]) localized[field] = tr[field];
    return localized;
  };
  return { lang, t, tn, localizeItem };
}

const I18nContext = createContext(createTranslator('en'));

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = readLocalString('binsense-lang');
    return isSupported(saved) ? saved : 'en';
  });
  useEffect(() => {
    writeLocal('binsense-lang', lang);
    // Lets screen readers and the browser pick the right pronunciation/fonts.
    document.documentElement.lang = lang;
  }, [lang]);
  const [pack, setPack] = useState({ lang: 'en', strings: en, items: {} });
  useEffect(() => {
    let cancelled = false;
    loadLanguage(lang)
      .then(loaded => { if (!cancelled) setPack({ lang, ...loaded }); })
      .catch(() => { if (!cancelled) setPack({ lang: 'en', strings: en, items: {} }); });
    // If the person switches again before this finishes, ignore the old result.
    return () => { cancelled = true; };
  }, [lang]);
  // Until the chosen language arrives, keep showing English.
  const value = useMemo(() => ({ ...createTranslator(pack.lang, pack), lang, setLang }), [pack, lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
