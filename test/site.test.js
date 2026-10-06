const test = require('node:test');
const assert = require('node:assert/strict');
const { SITE, siteLocalePrefix, welcomeUrl, uninstallUrl } = require('../site.js');

const locales = [
  ['zh-CN', '/zh'], ['zh-TW', '/zh'], ['pt-BR', '/pt-br'], ['pt-PT', '/pt-br'],
  ['es-419', '/es'], ['es', '/es'], ['en-US', ''], ['ar', ''], ['ja', ''], ['id', ''],
];

test('site locales map to the four supported site languages', () => {
  for (const [lang, prefix] of locales) assert.equal(siteLocalePrefix(lang), prefix);
});

test('welcome and uninstall URLs have the expected paths and query shapes', () => {
  assert.equal(SITE, 'https://xexport.goodexts.com');
  for (const [uiLang, prefix] of locales) {
    const details = { uiLang, version: '2.7.1', installed: '2026-10-06' };
    assert.equal(welcomeUrl(details),
      `${SITE}${prefix}/welcome?utm_source=extension&utm_medium=install&v=2.7.1&hl=${uiLang}`);
    assert.equal(uninstallUrl(details),
      `${SITE}${prefix}/uninstall?utm_source=extension&utm_medium=uninstall&ext=xap&v=2.7.1&hl=${uiLang}&installed=2026-10-06`);
  }
});

test('unknown install dates are omitted', () => {
  for (const installed of [undefined, null, '']) {
    const url = new URL(uninstallUrl({ uiLang: 'en-US', version: '2.7.1', installed }));
    assert.equal(url.searchParams.has('installed'), false);
  }
});

test('URLs encode query values with URLSearchParams', () => {
  const url = new URL(welcomeUrl({ uiLang: 'en-US', version: '2.7.1&extra=value' }));
  assert.equal(url.searchParams.get('v'), '2.7.1&extra=value');
  assert.equal(url.searchParams.has('extra'), false);
});

test('URLs contain no user identifiers and stay below the Chrome limit', () => {
  for (const [uiLang] of locales) {
    const details = { uiLang, version: '2.7.1', installed: '2026-10-06',
      handle: '@private-user', id: 'private-id', archive: ['private-post'] };
    for (const build of [welcomeUrl, uninstallUrl]) {
      const value = build(details);
      assert.ok(value.length < 1023);
      assert.ok(!decodeURIComponent(value).includes('@'));
      assert.ok(!value.includes('private-'));
      const keys = [...new URL(value).searchParams.keys()];
      assert.deepEqual(keys, build === welcomeUrl
        ? ['utm_source', 'utm_medium', 'v', 'hl']
        : ['utm_source', 'utm_medium', 'ext', 'v', 'hl', 'installed']);
    }
  }
});
