// 产品官网的地址拼装（纯函数）。只带版本、浏览器语言和安装日期，不带任何用户标识。
// background.js 是经典 service worker，靠 importScripts 载入，所以挂在 self.XAESite 上；
// 测试里用 require 取同一份。
(function (root) {
  const SITE = 'https://xexport.goodexts.com';

  // 子站只有 en（无前缀）/ zh / pt-br / es，其他界面语言一律落到英文页。
  function siteLocalePrefix(uiLang) {
    const lang = String(uiLang || '').toLowerCase();
    if (lang.startsWith('zh')) return '/zh';
    if (lang.startsWith('pt')) return '/pt-br';
    if (lang.startsWith('es')) return '/es';
    return '';
  }

  function welcomeUrl({ uiLang, version }) {
    const params = new URLSearchParams({
      utm_source: 'extension', utm_medium: 'install', v: version, hl: uiLang,
    });
    return `${SITE}${siteLocalePrefix(uiLang)}/welcome?${params}`;
  }

  function uninstallUrl({ uiLang, version, installed }) {
    const params = new URLSearchParams({
      utm_source: 'extension', utm_medium: 'uninstall', ext: 'xap', v: version, hl: uiLang,
    });
    if (installed) params.set('installed', installed);
    return `${SITE}${siteLocalePrefix(uiLang)}/uninstall?${params}`;
  }

  const api = { SITE, siteLocalePrefix, welcomeUrl, uninstallUrl };
  root.XAESite = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
