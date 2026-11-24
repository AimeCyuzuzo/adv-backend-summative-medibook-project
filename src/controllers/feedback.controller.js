const { resolveLang, getMessages, formatDate } = require('../utils/i18n');
const { DEFAULT_TZ } = require('../utils/clock');
const { renderFeedbackPage, renderThankYouPage } = require('../views/feedback.view');

// GET /feedback?lang=fr — unsupported or missing lang falls back to English.
function showFeedbackForm(req, res) {
  const lang = resolveLang(req.query.lang);
  const messages = getMessages(lang);
  const today = formatDate(new Date(), messages.locale, process.env.CLINIC_TZ || DEFAULT_TZ);
  const otherLang = lang === 'en' ? 'fr' : 'en';

  res.type('html').send(renderFeedbackPage({ lang, messages, today, otherLang }));
}

// POST /feedback — the brief only asks for the page; answers are not stored.
// This just confirms in the same language so the submit button isn't a dead end.
function submitFeedback(req, res) {
  const lang = resolveLang(req.query.lang);
  res.type('html').send(renderThankYouPage({ lang, messages: getMessages(lang) }));
}

module.exports = { showFeedbackForm, submitFeedback };
