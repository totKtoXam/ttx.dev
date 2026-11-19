/*
 * Выбор языка до загрузки словарей: ?lang=ru|en|kz в адресе, потом сохранённый выбор,
 * потом язык браузера. Русский словарь грузится всегда (запасные строки и письмо владельцу),
 * второй словарь подключается, только если выбран другой язык.
 */
(function () {
  'use strict';

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

  window.TTX_LANG = lang;
  // скрипт подключается синхронно, поэтому словарь выполнится раньше i18n.js
  if (lang !== 'ru') document.write('<script src="assets/js/i18n/' + lang + '.js"><\/script>');
})();
