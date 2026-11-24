// Minimal i18n: locale files are plain JSON, loaded once at startup (require caches them).
// Adding a language = adding locales/<code>.json and one line below.

const LOCALES = {
  en: require('../../locales/en.json'),
  fr: require('../../locales/fr.json'),
};

const DEFAULT_LANG = 'en';

/**
 * Picks a supported language from ?lang=..., falling back to English.
 * Handles anything a query string can produce: missing, arrays (?lang=fr&lang=en),
 * odd casing, and keys like "__proto__" (Object.hasOwn ignores inherited properties).
 */
function resolveLang(input) {
  if (typeof input !== 'string') return DEFAULT_LANG;
  const lang = input.trim().toLowerCase();
  return Object.hasOwn(LOCALES, lang) ? lang : DEFAULT_LANG;
}

function getMessages(lang) {
  return LOCALES[resolveLang(lang)];
}

/** Today's date written the way the active locale writes dates, e.g. "Tuesday 24 November 2026" / "mardi 24 novembre 2026". */
function formatDate(date, locale, timeZone) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone }).format(date);
}

module.exports = { LOCALES, DEFAULT_LANG, resolveLang, getMessages, formatDate };
