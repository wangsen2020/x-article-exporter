// background.js 是经典 service worker：在 vm 里跑一遍，chrome API 全部打桩。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function boot(data, { fail = () => false } = {}) {
  const tabs = [];
  const urls = [];
  let onInstalled;
  const listener = { addListener() {} };
  const chrome = {
    storage: {
      local: {
        async get(key) { return { [key]: data[key] }; },
        async set(values) { Object.assign(data, values); },
      },
      session: { async get() { return {}; }, async set() {}, async remove() {} },
    },
    i18n: { getUILanguage: () => 'pt-PT' },
    runtime: {
      getManifest: () => ({ version: '2.7.1' }),
      async setUninstallURL(url) {
        if (fail()) throw new Error('registration failed');
        urls.push(url);
      },
      onInstalled: { addListener(fn) { onInstalled = fn; } },
      onMessage: listener,
    },
    downloads: { onChanged: listener },
    tabs: { async create(options) {
      assert.ok(data.installedDate, 'install date is saved before opening welcome');
      tabs.push(options.url);
    } },
  };
  const ctx = vm.createContext({ chrome, console, URL, URLSearchParams, setTimeout, clearTimeout, Date });
  ctx.self = ctx;
  // archive.js 依赖 IndexedDB，这里只载入 site.js
  ctx.importScripts = (...files) => {
    for (const f of files) {
      if (f === 'site.js') vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
    }
  };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8'), ctx);
  return { tabs, urls, install: (reason) => onInstalled({ reason }) };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('startup and updates register feedback; only install saves a local date and opens welcome', async () => {
  const data = {};
  const bg = boot(data);
  await tick();
  assert.equal(bg.urls.length, 1);
  assert.equal(new URL(bg.urls[0]).searchParams.has('installed'), false);
  await bg.install('update');
  await bg.install('chrome_update');
  assert.equal(data.installedDate, undefined);
  assert.equal(bg.tabs.length, 0);
  assert.equal(bg.urls.length, 2);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  await bg.install('install');
  assert.equal(data.installedDate, today);
  assert.equal(bg.tabs.length, 1);
  assert.equal(new URL(bg.tabs[0]).pathname, '/pt-br/welcome');
  assert.equal(new URL(bg.urls.at(-1)).pathname, '/pt-br/uninstall');
  assert.equal(new URL(bg.urls.at(-1)).searchParams.get('installed'), today);

  // 已有的安装日期不会被覆盖
  data.installedDate = '2026-01-02';
  await bg.install('install');
  await bg.install('update');
  assert.equal(data.installedDate, '2026-01-02');
  assert.equal(bg.tabs.length, 2);
  assert.equal(new URL(bg.urls.at(-1)).searchParams.get('installed'), '2026-01-02');
});

test('a failing setUninstallURL does not throw out of the worker', async () => {
  const bg = boot({}, { fail: () => true });
  await tick();
  await bg.install('update');
  assert.equal(bg.urls.length, 0);
});
