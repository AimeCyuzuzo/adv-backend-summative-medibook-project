const { LOCALES, resolveLang, getMessages, formatDate } = require('../src/utils/i18n');
const { renderFeedbackPage, escapeHtml } = require('../src/views/feedback.view');

describe('resolveLang', () => {
  test('supported languages are used, case-insensitively', () => {
    expect(resolveLang('fr')).toBe('fr');
    expect(resolveLang(' FR ')).toBe('fr');
    expect(resolveLang('en')).toBe('en');
  });

  test.each([
    ['missing', undefined],
    ['unsupported code', 'de'],
    ['empty string', ''],
    ['repeated param (array)', ['fr', 'en']],
    ['inherited object key', '__proto__'],
    ['another inherited key', 'toString'],
  ])('falls back to English for %s', (_label, input) => {
    expect(resolveLang(input)).toBe('en');
  });
});

describe('locale files', () => {
  test('every locale has the same keys as English and exactly 5 questions', () => {
    const englishKeys = Object.keys(LOCALES.en).sort();
    for (const [lang, messages] of Object.entries(LOCALES)) {
      expect({ lang, keys: Object.keys(messages).sort() }).toEqual({ lang, keys: englishKeys });
      expect(messages.questions).toHaveLength(5);
      expect(messages.answers).toHaveLength(5);
    }
  });
});

describe('formatDate', () => {
  const instant = new Date('2026-11-24T10:00:00Z');

  // Exact punctuation (e.g. "Tuesday, 24" vs "Tuesday 24") varies between Node/ICU
  // versions, so check the localised words rather than the whole string.
  test('formats the same day differently per locale', () => {
    expect(formatDate(instant, 'en-GB', 'Africa/Kigali')).toMatch(/^Tuesday,? 24 November 2026$/);
    expect(formatDate(instant, 'fr-FR', 'Africa/Kigali')).toMatch(/^mardi,? 24 novembre 2026$/);
  });

  test('uses the clinic timezone, not UTC (23:30 UTC is already the next day in Kigali)', () => {
    expect(formatDate(new Date('2026-11-24T23:30:00Z'), 'en-GB', 'Africa/Kigali')).toMatch(/^Wednesday,? 25 November 2026$/);
  });
});

describe('renderFeedbackPage', () => {
  const render = (lang) =>
    renderFeedbackPage({ lang, messages: getMessages(lang), today: 'TODAY', otherLang: lang === 'en' ? 'fr' : 'en' });

  test('French page has French title, lang attribute and exactly 5 textareas', () => {
    const html = render('fr');
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('<title>Évaluation du cours</title>');
    expect(html.match(/<textarea/g)).toHaveLength(5);
    expect(html).toContain(escapeHtml(LOCALES.fr.questions[0]));
    expect(html).toContain(`required>${escapeHtml(LOCALES.fr.answers[0])}</textarea>`);
  });

  test('escapes HTML special characters', () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`))
      .toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;');
  });
});
