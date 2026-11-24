// HTML for the course-feedback page. Plain template strings — no template engine needed
// for one page. Every piece of text goes through escapeHtml, so nothing from a locale
// file (or a future user-supplied value) can inject markup.

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout({ lang, title, body }) {
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #1f2933; }
    header { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
    .date { color: #52606d; margin: 0; }
    ol { padding-left: 1.25rem; }
    li { margin-bottom: 1.25rem; }
    label { display: block; font-weight: 600; margin-bottom: .4rem; }
    textarea { width: 100%; min-height: 6rem; padding: .5rem; font: inherit; box-sizing: border-box; }
    button { padding: .6rem 1.2rem; font: inherit; cursor: pointer; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * @param {object} p
 * @param {string} p.lang       active language code ('en' | 'fr')
 * @param {object} p.messages   contents of locales/<lang>.json
 * @param {string} p.today      already formatted for the locale
 * @param {string} p.otherLang  language the switch link points to
 */
function renderFeedbackPage({ lang, messages, today, otherLang }) {
  const questions = messages.questions
    .map((question, i) => {
      const id = `q${i + 1}`;
      return `      <li>
        <label for="${id}">${escapeHtml(question)}</label>
        <textarea id="${id}" name="${id}" required></textarea>
      </li>`;
    })
    .join('\n');

  const body = `  <header>
    <h1>${escapeHtml(messages.title)}</h1>
    <a href="/feedback?lang=${escapeHtml(otherLang)}">${escapeHtml(messages.switch_language)}</a>
  </header>
  <p class="date">${escapeHtml(messages.date_label)}: <time>${escapeHtml(today)}</time></p>
  <p>${escapeHtml(messages.instructions)}</p>
  <form method="post" action="/feedback?lang=${escapeHtml(lang)}">
    <ol>
${questions}
    </ol>
    <button type="submit">${escapeHtml(messages.submit)}</button>
  </form>`;

  return layout({ lang, title: messages.title, body });
}

function renderThankYouPage({ lang, messages }) {
  const body = `  <h1>${escapeHtml(messages.title)}</h1>
  <p>${escapeHtml(messages.thank_you)}</p>
  <p><a href="/feedback?lang=${escapeHtml(lang)}">${escapeHtml(messages.back)}</a></p>`;
  return layout({ lang, title: messages.title, body });
}

module.exports = { escapeHtml, renderFeedbackPage, renderThankYouPage };
