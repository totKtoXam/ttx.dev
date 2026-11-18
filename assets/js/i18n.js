/*
 * Язык сайта: ?lang=ru|en|kz в адресе, потом сохранённый выбор, потом язык браузера.
 * Переводит статичную разметку по атрибутам:
 *   data-i18n="ui.hero.h1"                      innerHTML из словаря (словари свои, HTML доверенный)
 *   data-i18n-attr="placeholder:ui.form.taskPh"  атрибуты, через «;»
 */
(function () {
  'use strict';

  var L10N = window.TTX_L10N || {};
  var LANGS = ['ru', 'kk', 'en'];

  function norm(l) {
    l = String(l || '').toLowerCase();
    if (l === 'kz' || l.indexOf('kk') === 0) return 'kk';
    if (l.indexOf('ru') === 0) return 'ru';
    if (l.indexOf('en') === 0) return 'en';
    return null;
  }

  var fromUrl = null;
  try { fromUrl = norm(new URLSearchParams(location.search).get('lang')); } catch (e) { /* old browser */ }
  var saved = null;
  try { saved = norm(localStorage.getItem('ttx:lang')); } catch (e) { /* private mode */ }
  var browser = norm((navigator.languages && navigator.languages[0]) || navigator.language);
  var lang = fromUrl || saved || browser || 'en';
  if (fromUrl) { try { localStorage.setItem('ttx:lang', fromUrl); } catch (e) { /* private mode */ } }

  function lookup(path, l) {
    var o = L10N[l];
    var parts = path.split('.');
    for (var i = 0; i < parts.length && o != null; i++) o = o[parts[i]];
    return o;
  }

  function t(path, vars) {
    var s = lookup(path, lang);
    if (s == null) s = lookup(path, 'ru');
    if (s == null) return path;
    if (typeof s === 'string' && vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    }
    return s;
  }

  // Код языка для ссылок: казахский в адресе пишем как kz, это привычнее.
  function urlCode(l) { return l === 'kk' ? 'kz' : l; }

  function applyMeta() {
    document.documentElement.lang = lang;

    // у отдельных страниц свой заголовок вкладки: <body data-page="about">
    var page = document.body && document.body.getAttribute('data-page');
    var title = page && L10N[lang] && L10N[lang].meta.pages && L10N[lang].meta.pages[page] ? t('meta.pages.' + page) : t('meta.title');
    document.title = title;
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', t('meta.description'));
    var ogt = document.querySelector('meta[property="og:title"]');
    if (ogt) ogt.setAttribute('content', title);
    var ogd = document.querySelector('meta[property="og:description"]');
    if (ogd) ogd.setAttribute('content', t('meta.ogDescription'));
  }

  function apply(root) {
    root = root || document;
    applyMeta();

    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n]'), function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n-attr]'), function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var i = pair.indexOf(':');
        if (i > 0) el.setAttribute(pair.slice(0, i).trim(), t(pair.slice(i + 1).trim()));
      });
    });

    Array.prototype.forEach.call(root.querySelectorAll('[data-lang]'), function (a) {
      var l = a.getAttribute('data-lang');
      a.setAttribute('href', '?lang=' + urlCode(l));
      a.textContent = (L10N[l] && L10N[l].meta.label) || l;
      if (l === lang) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }

  window.TTX_LANG = lang;
  window.TTX_I18N = {
    lang: lang,
    langs: LANGS,
    t: t,
    locale: t('meta.locale'),
    dict: function (l) { return L10N[l] || L10N.ru; },
    apply: apply,
    applyMeta: applyMeta,
  };

  apply(document);
})();
