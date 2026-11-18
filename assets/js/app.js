(function () {
  'use strict';

  var CFG = window.TTX_CONFIG;
  var D = window.TTX_DATA;
  var DRU = window.TTX_DATA_RU;
  var I18N = window.TTX_I18N;
  var LANG = I18N.lang;
  var t = I18N.t;

  if (LANG === 'en' && CFG.ownerLatin) CFG.owner = CFG.ownerLatin;

  /* ---------- helpers ---------- */
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem('ttx:' + k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('ttx:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
    del: function (k) { try { localStorage.removeItem('ttx:' + k); } catch (e) { /* private mode */ } },
  };
  // Расчёт и черновик заявки помним неделю с последнего изменения.
  var WEEK = 7 * 24 * 60 * 60 * 1000;
  function getFresh(k) {
    var x = store.get(k);
    if (x && typeof x.ts === 'number' && Date.now() - x.ts < WEEK) return x.v;
    if (x) store.del(k);
    return null;
  }
  function setFresh(k, v) { store.set(k, { ts: Date.now(), v: v }); }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return list[0]; }
  // Первую букву делаем строчной, кроме названий и аббревиатур (Telegram, CRM, iOS).
  function lowerFirst(s) {
    if (/^([A-ZА-ЯЁ]{2}|i[A-Z]|Telegram|Google|WhatsApp|Windows|Apple)/.test(s)) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  function fmtNum(n, lang) {
    var sep = (lang || LANG) === 'en' ? ',' : ' ';
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }
  function money(n, cur, lang) {
    return cur === 'usd' ? '$' + fmtNum(n, lang) : fmtNum(n, lang) + ' ₸';
  }
  // В шрифте PDF (Roboto) нет глифа ₸, поэтому в PDF пишем «тг» или KZT.
  function moneyPdf(n, cur) {
    return cur === 'usd' ? '$' + fmtNum(n) : fmtNum(n) + ' ' + t('pdf.tg');
  }
  function fmtK(k, lang) { return '×' + ((lang || LANG) === 'en' ? String(k) : String(k).replace('.', ',')); }
  function from(x) { return t('js.from', { x: x }); }

  function estimate(state) {
    var c = byId(D.complexity, state.complexity);
    var u = byId(D.users, state.users);
    var d = byId(D.data, state.data);
    var cur = state.currency;
    var base = c[cur];
    var raw = base * u.k * d.k;
    var step = cur === 'usd' ? 10 : 10000;
    var total = Math.round(raw / step) * step;
    return {
      currency: cur, complexity: c, users: u, data: d,
      base: base, total: total,
      individual: !!(u.plus || d.plus || c.id === 'enterprise'),
    };
  }

  window.TTX = { money: money, moneyPdf: moneyPdf, fmtK: fmtK, fmtNum: fmtNum, estimate: estimate, byId: byId, from: from };

  /* ---------- state ---------- */
  var saved = getFresh('calc') || {};
  var state = {
    complexity: saved.complexity || 'medium',
    users: saved.users || 'u1k',
    data: saved.data || 'dMid',
    currency: saved.currency === 'usd' || saved.currency === 'kzt' ? saved.currency : (LANG === 'en' ? 'usd' : 'kzt'),
  };

  /* ---------- static renders ---------- */
  function render(name, html) {
    $all('[data-render="' + name + '"]').forEach(function (el) { el.innerHTML = html; });
  }
  function defs(list) {
    return list.map(function (x) { return '<div><dt>' + esc(x.title) + '</dt><dd>' + esc(x.text) + '</dd></div>'; }).join('');
  }
  function thead(cols) {
    return '<thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead>';
  }

  function renderStatic() {
    render('pains', D.pains.map(function (p, i) { return '<li class="pains__item">' + painArt(i) + '<p>' + esc(p) + '</p></li>'; }).join('') +
      '<li class="pains__item pains__cta"><p>' + t('ui.pains.cta') + '</p><a class="btn btn--primary" href="#calc">' + t('ui.pains.ctaLink') + '</a></li>');
    render('why', defs(D.why));
    render('payment', defs(D.payment));

    render('projects', D.projects.map(function (p) {
      var links = '<a href="' + esc(p.repo) + '" target="_blank" rel="noopener">' + esc(t('js.code')) + '</a>';
      if (p.site) links += '<a href="' + esc(p.site) + '" target="_blank" rel="noopener">' + esc(t('js.site')) + '</a>';
      return '<article class="project"><div class="project__head"><h3>' + esc(p.name) + '</h3><span>' + esc(p.kind) + '</span></div>' +
        '<p>' + esc(p.text) + '</p>' +
        '<p class="project__meta"><span>' + esc(p.stack.join(', ')) + '</span>' + links + '</p></article>';
    }).join(''));

    render('process', D.process.map(function (s) {
      return '<li><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></li>';
    }).join(''));

    render('operation-note', esc(D.operationNote));

    render('price-users', thead(t('js.headUsers')) + '<tbody>' +
      D.users.map(function (u) {
        return '<tr><td class="strong">' + esc(u.range) + '</td><td class="num">' + fmtK(u.k) + (u.plus ? esc(t('js.andUp')) : '') + '</td><td class="muted">' + esc(u.adds) + '</td></tr>';
      }).join('') + '</tbody>');

    render('price-data', thead(t('js.headData')) + '<tbody>' +
      D.data.map(function (d) {
        return '<tr><td class="strong">' + esc(d.name) + '</td><td class="num">' + esc(d.ops) + '</td><td class="num">' + esc(d.rps) + '</td><td class="num">' + fmtK(d.k) + (d.plus ? esc(t('js.andUp')) : '') + '</td><td class="muted">' + esc(d.adds) + '</td></tr>';
      }).join('') + '</tbody>');

    render('sel-users', D.users.map(function (u) { return selOption('users', u.id, u.range); }).join(''));
    render('sel-data', D.data.map(function (d) { return selOption('data', d.id, d.ops); }).join(''));
    render('sel-complexity', D.complexity.map(function (c) { return selOption('complexity', c.id, c.phrase); }).join(''));

    render('contacts', contactItems().map(function (c) {
      var copy = c.copy ? '<button class="copy" type="button" data-copy="' + esc(c.copy) + '" aria-label="' + esc(t('js.copyLabel', { x: c.label })) + '" title="' + esc(t('js.copy')) + '">' + COPY_ICONS + '</button>' : '';
      return '<li><span class="contacts__ico" title="' + esc(c.label) + '">' + contactIco(c.ico) + '<span class="vh">' + esc(c.label) + '</span></span>' + copy + '<a href="' + esc(c.href) + '"' + (c.external ? ' target="_blank" rel="noopener"' : '') + '>' + esc(c.value) + '</a></li>';
    }).join(''));
    $all('[data-qr]').forEach(function (el) {
      var svg = window.TTX_QR && window.TTX_QR[el.getAttribute('data-qr')];
      if (svg && !el.firstChild) el.innerHTML = svg;
    });

    $all('[data-owner]').forEach(function (el) { el.textContent = CFG.owner; });
    var mark = $('.logo__mark');
    if (mark) $all('[data-brand]').forEach(function (el) {
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', el.textContent);
      el.innerHTML = mark.outerHTML;
    });
    var tg = (CFG.contacts.telegram || '').replace(/^@/, '');
    $all('[data-tg]').forEach(function (el) {
      if (!tg) return;
      var a = el.querySelector('a');
      a.href = 'https://t.me/' + tg; a.textContent = '@' + tg;
      el.hidden = false;
    });
    $all('[data-max-mb]').forEach(function (el) { el.textContent = CFG.maxUploadMb; });
    var year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  function selOption(group, id, text) {
    return '<option value="' + id + '"' + (state[group] === id ? ' selected' : '') + '>' + esc(text) + '</option>';
  }

  var COPY_ICONS = '<svg class="copy__ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2.4"/><path d="M15.5 8.5V6.9a2.4 2.4 0 0 0-2.4-2.4H6.9a2.4 2.4 0 0 0-2.4 2.4v6.2a2.4 2.4 0 0 0 2.4 2.4h1.6"/></g></svg><svg class="copy__done" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M5.5 12.6l4.2 4.1 8.8-9.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function contactItems() {
    var c = CFG.contacts, out = [];
    if (c.telegram) out.push({ ico: 'telegram', label: 'Telegram', value: '@' + c.telegram.replace(/^@/, ''), href: 'https://t.me/' + c.telegram.replace(/^@/, ''), external: true, copy: '@' + c.telegram.replace(/^@/, '') });
    if (c.whatsapp) {
      var wa = c.whatsapp.replace(/\D/g, '');
      // если WhatsApp на том же номере, показываем его так же, с пробелами
      var waText = c.phone && c.phone.replace(/\D/g, '') === wa ? c.phone : '+' + wa;
      out.push({ ico: 'whatsapp', label: 'WhatsApp', value: waText, href: 'https://wa.me/' + wa, external: true, copy: waText });
    }
    if (c.phone) out.push({ ico: 'phone', label: t('js.phone'), value: c.phone, href: 'tel:' + c.phone.replace(/[^\d+]/g, ''), copy: c.phone });
    if (c.email) { var mail = atob(c.email); out.push({ ico: 'email', label: t('js.email'), value: mail, href: 'mailto:' + mail, copy: mail }); }
    if (c.github) out.push({ ico: 'github', label: 'GitHub', value: c.github.replace(/^https?:\/\//, ''), href: c.github, external: true, copy: c.github });
    if (c.linkedin) out.push({ ico: 'linkedin', label: 'LinkedIn', value: c.linkedin.replace(/^https?:\/\/(www\.)?/, ''), href: c.linkedin, external: true, copy: c.linkedin });
    return out;
  }
  window.TTX.contactItems = contactItems;

  // Значки контактов той же линией, что и остальные рисунки
  var CONTACT_ICO = {
    telegram: '<path d="M20.6 4.3 3.4 11c-.8.3-.8 1.5 0 1.8l4.2 1.4 1.6 4.9c.2.7 1.1.9 1.6.4l2.4-2.2 4.3 3.1c.6.4 1.4.1 1.6-.6l2.9-14.2c.2-.9-.6-1.6-1.4-1.3z"/><path d="M7.7 14.2 17.4 8l-7.6 7.4-.6 3.6"/>',
    whatsapp: '<path d="M4.2 19.8l1.1-3.6a8.3 8.3 0 1 1 3 2.6z"/><path d="M9.3 8.3c.3-.5.8-.5 1.1 0l.7 1.4c.1.3.1.6-.2.8l-.6.6c.6 1.3 1.6 2.3 2.9 2.9l.6-.6c.2-.3.5-.3.8-.2l1.4.7c.5.3.5.8 0 1.1-1.5 1-3.4.5-5-1.1S8.4 9.8 9.3 8.3z"/>',
    phone: '<path d="M6.8 3.8h2.4l1.3 3.9-1.9 1.3a10.6 10.6 0 0 0 6.4 6.4l1.3-1.9 3.9 1.3v2.4a2 2 0 0 1-2.2 2C10.6 18.6 5.4 13.4 4.8 6a2 2 0 0 1 2-2.2z"/>',
    email: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.2"/><path d="m4.2 7.2 7.8 5.9 7.8-5.9"/>',
    github: '<path d="M9 19.5c-4.3 1.3-4.3-2.2-6-2.6m12 4.6v-3.3a2.9 2.9 0 0 0-.8-2.3c2.7-.3 5.6-1.3 5.6-6a4.7 4.7 0 0 0-1.3-3.3 4.4 4.4 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.6 2.1 5.6 2.4 5.6 2.4a4.4 4.4 0 0 0-.1 3.2 4.7 4.7 0 0 0-1.3 3.3c0 4.7 2.9 5.7 5.6 6a2.9 2.9 0 0 0-.8 2.2v4.4"/>',
    linkedin: '<path d="M16 8.5a5.5 5.5 0 0 1 5.5 5.5v6.5H18V14a2 2 0 0 0-4 0v6.5h-3.5V14A5.5 5.5 0 0 1 16 8.5z"/><path d="M2.5 9.5h3.5v11H2.5z"/><circle cx="4.25" cy="4.75" r="1.75"/>',
    brief: '<path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13.5 3.5V9H19M8.5 13h7M8.5 16.5h4.5"/>',
  };
  function contactIco(name) {
    return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (CONTACT_ICO[name] || CONTACT_ICO.brief) + '</g></svg>';
  }

  // Рисунки к «С чем приходят», в той же манере, что и услуги.
  var PAIN_ART = [
    // данные вручную из одной программы в другую, по дороге ошибка
    '<circle class="mk" cx="32" cy="38" r="7"/><path d="M4 8.5h19l.4 21H4.6z"/><path d="M4.2 13.5h19"/><path d="M8 18h11M8 22h8"/><path d="M41 8h19l.4 21H41.4z"/><path d="M41.2 13h19"/><path d="M45 17.5h11M45 21.5h8"/><path d="M25.5 16c4-3 8.5-3 13 0"/><path d="M35.5 13.6 38.5 16l-3.6 1.2"/><path d="M32 33.5v4.5M32 41.5h.01"/>',
    // заказы в Excel, мессенджерах и блокнотах
    '<path class="mk" d="M24 27h18v16H24z"/><path d="M4 7h20v16H4z"/><path d="M4 12.3h20M4 17.6h20M10.7 7v16M17.4 7v16"/><path d="M40 5h16a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-8l-5 4v-4h-3a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z"/><path d="M41 10.5h14M41 14.5h9"/><path d="M24 27h18v16H24z"/><path d="M27.5 25v4M31.5 25v4M35.5 25v4M39 25v4"/><path d="M28 34h10M28 38h6"/>',
    // готовая CRM не подходит: круглое в квадратное
    '<circle class="mk" cx="46" cy="18" r="10"/><path d="M6 20h22v22H6z"/><circle cx="46" cy="18" r="10"/><path d="M37.5 31c-3 4-8 6-13 5.5"/><path d="M27.5 33.6 24.5 36.5l3.8 1.6"/><path d="M42.5 15.5l7 5M49.5 15.5l-7 5"/>',
    // клиентам нужен кабинет, приложение или бот, а его нет
    '<path class="mk" d="M27 12h16v22H27z"/><circle cx="10" cy="19" r="4"/><path d="M3 33c1.2-5 3.8-7.6 7-7.6s5.8 2.6 7 7.6"/><path d="M27 5h16a3.5 3.5 0 0 1 3.5 3.5v31A3.5 3.5 0 0 1 43 43H27a3.5 3.5 0 0 1-3.5-3.5v-31A3.5 3.5 0 0 1 27 5z"/><path d="M27 12h16v22H27z" stroke-dasharray="2.6 3.2"/><path d="M35 18v10M30 23h10"/><path d="M35 38.5h.01"/><path d="M51 14c2 2.4 2 7.6 0 10M56 10.5c3.6 4.4 3.6 12.6 0 17"/>',
    // отчёт собирают полдня
    '<path class="mk" d="M47 18V7a11 11 0 0 1 0 22z"/><path d="M5 42h32"/><path d="M10 42V30M17 42V23M24 42V33M31 42V17"/><circle cx="47" cy="18" r="11"/><path d="M47 11v7l5 3"/>',
  ];
  function painArt(i) {
    return PAIN_ART[i] ? '<svg class="svc__art" viewBox="0 0 64 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">' + PAIN_ART[i] + '</g></svg>' : '';
  }

  /* ---------- services ---------- */
  // Рисунки к услугам: линии синей ручкой и пятно маркера, как пометки на смете.
  var ART = {
    web: '<path class="mk" d="M13 22.5c2.5-3 11-3.2 13.5.5 1.6 3 .8 9.5-1.5 11.5-3 2.2-10 2-12.4-.6-1.8-2.4-1.8-8.8.4-11.4z"/><path d="M7 8.5 57 7.6l.6 32.6-51 .6z"/><path d="M7 15.5h50"/><path d="M11 12h.01M15 12h.01M19 12h.01"/><circle cx="20" cy="25" r="3.2"/><path d="M14 35.5c1.2-3.6 3.4-5.4 6-5.4s4.8 1.8 6 5.4"/><path d="M32 23.5h18M32 29.5h14M32 35.5h9"/>',
    crm: '<path class="mk" d="M41.5 12.5h12v7h-12z"/><path d="M6.5 7.5 57.5 8 57 40.5 7 40z"/><path d="M23.5 8.2v31.6M40.5 8.3v31.9"/><path d="M10 12.5h10v6H10zM10 22.5h10v6H10zM10 32.5h10v4H10zM27 12.5h10v6H27zM41.5 12.5h12v7h-12zM44 25.5h9v6h-9z"/><path d="M30 28c2.5 3.5 6.5 4 10 1.5"/><path d="M37.5 28.6l2.6.8-.6 2.6"/>',
    integr: '<path class="mk" d="M43 15h16v18H43z"/><path d="M5 15.5 21 15l.5 18-16 .5z"/><path d="M43 15h16v18H43z"/><path d="M9 21h8M9 25.5h8M9 30h5"/><circle cx="51" cy="24" r="3.5"/><path d="M24.5 20c5.5-4 10-4 15.5 0"/><path d="M36.6 17.4 40 20l-4 1.3"/><path d="M40 28c-5.5 4-10 4-15.5 0"/><path d="M27.9 30.6 24.5 28l4-1.3"/>',
    bot: '<path class="mk" d="M55.5 27h-20a3.5 3.5 0 0 0-3.5 3.5v6a3.5 3.5 0 0 0 3.5 3.5H47l6 5v-5h2.5a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-3.5-3.5z"/><path d="M9 7h26a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H19l-7 6v-6H9a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4z"/><path d="M12 13h20M12 18.5h13"/><path d="M55.5 27h-20a3.5 3.5 0 0 0-3.5 3.5v6a3.5 3.5 0 0 0 3.5 3.5H47l6 5v-5h2.5a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-3.5-3.5z"/><path d="M38.5 33.5l2.5 2.5 5-5"/>',
    mobile: '<path class="mk" d="M26 14h14v9H26z"/><path d="M23 4.5h18a3.5 3.5 0 0 1 3.5 3.5v32a3.5 3.5 0 0 1-3.5 3.5H23a3.5 3.5 0 0 1-3.5-3.5V8A3.5 3.5 0 0 1 23 4.5z"/><path d="M29.5 8.5h5"/><path d="M26 14h14v9H26z"/><path d="M26 28h14M26 32.5h9"/><path d="M32 39h.01"/><path d="M13 19c-2 2.4-2 7.6 0 10M8.5 15.5c-3.6 4.4-3.6 12.6 0 17M51 19c2 2.4 2 7.6 0 10M55.5 15.5c3.6 4.4 3.6 12.6 0 17"/>',
    ai: '<path class="mk" d="M49 8c.9 4.6 2.4 6.1 7 7-4.6.9-6.1 2.4-7 7-.9-4.6-2.4-6.1-7-7 4.6-.9 6.1-2.4 7-7z"/><path d="M9 6.5h19l8 8v27H9z"/><path d="M28 6.5v8h8"/><path d="M14 20h16M14 25h16M14 30h11M14 35h14"/><path d="M49 8c.9 4.6 2.4 6.1 7 7-4.6.9-6.1 2.4-7 7-.9-4.6-2.4-6.1-7-7 4.6-.9 6.1-2.4 7-7z"/><path d="M46 29c.5 2.4 1.3 3.2 3.7 3.7-2.4.5-3.2 1.3-3.7 3.7-.5-2.4-1.3-3.2-3.7-3.7 2.4-.5 3.2-1.3 3.7-3.7z"/>',
    legacy: '<path class="mk" d="M21.5 21 41 15.5l2.2 8L23.7 29z"/><path d="M15 13 6 24l9 11"/><path d="M49 13l9 11-9 11"/><path d="M37 7 27 41"/><path d="M21.5 21 41 15.5l2.2 8L23.7 29z"/><path d="M29 22.5h.01M33 21.4h.01M30.3 26h.01M34.3 24.9h.01"/>',
    script: '<path class="mk" d="M53.5 6 47 22h6l-4 14 10-18h-6l4-12z"/><path d="M6 8.5h38.5l.5 31H6.5z"/><path d="M6.3 15h38.5"/><path d="M12 22l5 4-5 4"/><path d="M21 31h9"/><path d="M53.5 6 47 22h6l-4 14 10-18h-6l4-12z"/>',
    consult: '<path class="mk" d="M56 21H38a3.5 3.5 0 0 0-3.5 3.5V33a3.5 3.5 0 0 0 3.5 3.5h9l6 5v-5h3a3.5 3.5 0 0 0 3.5-3.5v-8.5A3.5 3.5 0 0 0 56 21z"/><path d="M8 7h22a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H17l-6 5v-5H8a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4z"/><path d="M16 12.5a3 3 0 1 1 4 2.8c-.8.4-1.2 1-1.2 1.9v.4"/><path d="M18.8 20.5h.01"/><path d="M56 21H38a3.5 3.5 0 0 0-3.5 3.5V33a3.5 3.5 0 0 0 3.5 3.5h9l6 5v-5h3a3.5 3.5 0 0 0 3.5-3.5v-8.5A3.5 3.5 0 0 0 56 21z"/><path d="M39.5 27h15M39.5 31h10"/>',
    audit: '<circle class="mk" cx="48" cy="29" r="7.5"/><path d="M6 8h14v9H6zM6 31h14v9H6zM27 19.5h14v9H27z"/><path d="M20 12.5h3.5v11H27M20 35.5h3.5V28"/><circle cx="48" cy="29" r="7.5"/><path d="M53.5 34.5 59 40"/>',
    spec: '<path class="mk" d="M14 23h19v6H14z"/><path d="M10 6.5h21l8 8V42H10z"/><path d="M31 6.5v8h8"/><path d="M15 14h4v4h-4zM22 16h10M15 24h4v4h-4zM22 26h10M15 34h4v4h-4zM22 36h7"/><path d="M16 15.8l1 1 2-2.3"/><path d="M53 11.5 57.5 16 43 30.5l-6 1.5 1.5-6z"/><path d="M50.5 14l4.5 4.5"/>',
    review: '<path class="mk" d="M15.5 27h21v5.5h-21z"/><path d="M12 6.5h21l8 8V42H12z"/><path d="M33 6.5v8h8"/><path d="M17 16.5l2 2 3.5-3.5M25 17h10"/><path d="M17 23l2 2 3.5-3.5M25 23.5h10"/><path d="M17.5 30h17"/><path d="M17 36.5h12"/><path d="M14 30.5c-1.3-3.6 6.4-5.5 13.5-5.4 6.5.1 12.6 1.4 12 4.6-.6 3.6-10 4.6-16.5 4.2-4.4-.3-8-1.4-9-3.4z"/><path d="M52 18.5v10M52 34h.01"/>',
    hours: '<path class="mk" d="M24 24V10a14 14 0 0 1 12.1 7z"/><circle cx="24" cy="24" r="14"/><path d="M24 14.5V24l6.5 3.5"/><path d="M24 12v1.6M24 34.4v1.6M12 24h1.6M34.4 24h1.6"/><path d="M50 30v12M44 36h12"/>',
    support: '<path class="mk" d="M50 11c1.6-2.8 6-2 6 1.2 0 2.6-3.4 4.6-6 6.6-2.6-2-6-4-6-6.6 0-3.2 4.4-4 6-1.2z"/><path d="M6 8h52v26H6z"/><path d="M26 34l-2 7h16l-2-7M21 41h22"/><path d="M10 25h10l3-7 5 14 4-10 3 3h18"/><path d="M50 11c1.6-2.8 6-2 6 1.2 0 2.6-3.4 4.6-6 6.6-2.6-2-6-4-6-6.6 0-3.2 4.4-4 6-1.2z"/>',
  };
  // Порядок совпадает с порядком в словарях: data.services, data.consult, data.extras.
  var DEV_ART = ['web', 'crm', 'integr', 'bot', 'mobile', 'ai', 'legacy'];
  var CONSULT_ART = ['consult', 'audit', 'spec', 'review'];
  var AFTER_ART = ['hours', 'support'];

  function art(name) {
    return '<svg class="svc__art" viewBox="0 0 64 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">' + ART[name] + '</g></svg>';
  }
  function svcItem(name, title, text, price, term) {
    // Длинную цену делим: сумма жирным, уточнение второй строкой («…, минимум 150 000 ₸»).
    var cut = price && !term ? price.indexOf(', ') : -1;
    if (cut > 0) { term = price.slice(cut + 2); term = term.charAt(0).toUpperCase() + term.slice(1); price = price.slice(0, cut); }
    return '<li class="svc__item">' + art(name) + '<h4>' + esc(title) + '</h4>' +
      (text ? '<p>' + esc(text) + '</p>' : '') +
      (price ? '<p class="svc__price">' + esc(price) + (term ? '<span>' + esc(term) + '</span>' : '') + '</p>' : '') + '</li>';
  }
  function renderServices(cur) {
    var mini = D.complexity[0];
    render('svc-dev', D.services.slice(0, DEV_ART.length).map(function (x, i) { return svcItem(DEV_ART[i], x.title, x.text); }).join('') +
      svcItem('script', t('ui.services.mini'), mini.examples + '.', from(money(mini[cur], cur)), mini.term));
    render('svc-consult', D.consult.map(function (x, i) { return svcItem(CONSULT_ART[i], x.name, x.what, x[cur]); }).join(''));
    render('svc-after', D.extras.slice(0, AFTER_ART.length).map(function (x, i) { return svcItem(AFTER_ART[i], x.name, x.text, x[cur]); }).join(''));
    var srv = D.extras[AFTER_ART.length];
    render('svc-after-note', srv ? esc(srv.name + ': ' + lowerFirst(srv[cur]) + '.') : '');
  }

  /* ---------- currency-dependent renders ---------- */
  function renderPrices() {
    var cur = state.currency;
    render('price-complexity', thead(t('js.headComplexity')) + '<tbody>' +
      D.complexity.map(function (c) {
        return '<tr><td class="strong">' + esc(c.name) + '</td><td class="muted">' + esc(c.what) + '</td><td class="muted">' + esc(c.examples) + '</td><td class="num">' + esc(from(money(c[cur], cur))) + '</td><td class="num">' + esc(c.term) + '</td></tr>';
      }).join('') + '</tbody>');

    renderServices(cur);

    $all('[data-currency]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.currency === cur)); });
  }

  function renderEstimate() {
    if (!$('#calcTotal')) return; // калькулятор только на главной
    var e = estimate(state);
    var cur = e.currency;
    var level = e.complexity.level || t('js.level', { name: e.complexity.name });
    $('#calcTotal').textContent = from(money(e.total, cur));
    $('#calcTerm').textContent = t('js.term', { t: e.complexity.term });
    $('#calcLines').textContent = t('js.lines', { base: money(e.base, cur), ku: fmtK(e.users.k), kd: fmtK(e.data.k) });
    $('#calcWhat').textContent = t('js.what', { level: level, what: lowerFirst(e.complexity.what), examples: lowerFirst(e.complexity.examples) });
    $('#calcHint').textContent = e.individual ? t('js.individual') : '';

    $('#briefEstimate').innerHTML = t('js.briefEst', {
      total: esc(from(money(e.total, cur))), term: esc(e.complexity.term),
      level: esc(level), users: esc(e.users.range), ops: esc(e.data.ops),
    });
  }
  function saveCalc() { setFresh('calc', state); }

  // Ширина зависит от шрифта: пересчитываем, когда догрузятся все начертания и алфавиты.
  function onFontsChange(fn) {
    if (!document.fonts) return;
    if (document.fonts.ready) document.fonts.ready.then(fn, fn);
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fn);
    if (document.fonts.load) {
      var sample = $all('.pick select option').map(function (o) { return o.text; }).join(' ');
      document.fonts.load('600 1em Onest', sample).then(fn, fn);
    }
  }

  /* ---------- calculator dropdowns ---------- */
  // Свой список вместо системного: системный на телефоне не оформить, а здесь у вариантов есть подсказки с ценой.
  // Разметка по шаблону APG «select-only combobox»: фокус остаётся на поле, активный вариант через aria-activedescendant.
  var CHEV = '<svg class="pick__chev" viewBox="0 0 12 8" aria-hidden="true" focusable="false"><path d="M1.5 1.8 6 6.2l4.5-4.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var sheetQuery = window.matchMedia ? window.matchMedia('(max-width: 560px)') : { matches: false };
  var backdrop;

  function optionHint(group, id) {
    var cur = state.currency;
    if (group === 'complexity') { var c = byId(D.complexity, id); return from(money(c[cur], cur)) + ', ' + c.term; }
    if (group === 'users') return t('js.coef', { k: fmtK(byId(D.users, id).k) });
    var d = byId(D.data, id);
    return t('pdf.load', { name: d.name }) + ', ' + t('js.coef', { k: fmtK(d.k) });
  }

  function wirePicks() {
    if (!$('.pick') || backdrop) return;
    backdrop = document.createElement('div');
    backdrop.className = 'pick-backdrop';
    backdrop.hidden = true;
    document.body.appendChild(backdrop);

    var picks = $all('.pick').map(function (pick) {
      var sel = pick.querySelector('select');
      var group = sel.name;
      var label = sel.getAttribute('aria-label') || group;
      var listId = 'pick-' + group;

      sel.classList.add('pick__native');
      sel.tabIndex = -1;
      sel.setAttribute('aria-hidden', 'true');

      var box = document.createElement('span');
      box.className = 'pick__box';
      box.tabIndex = 0;
      box.setAttribute('role', 'combobox');
      box.setAttribute('aria-haspopup', 'listbox');
      box.setAttribute('aria-expanded', 'false');
      box.setAttribute('aria-controls', listId);
      box.setAttribute('aria-label', label);

      var pop = document.createElement('span');
      pop.className = 'pick__pop';
      pop.hidden = true;
      pop.innerHTML = '<span class="pick__title" aria-hidden="true">' + esc(label) + '</span><ul class="pick__list" role="listbox" id="' + listId + '" aria-label="' + esc(label) + '" tabindex="-1"></ul>';
      var list = pop.querySelector('ul');

      pick.appendChild(box);
      pick.appendChild(pop);

      var p = { pick: pick, sel: sel, box: box, pop: pop, list: list, group: group, active: -1 };

      // Число не рвём посередине («10 000»), предлог держим со словом, стрелку с последним словом.
      function sync() {
        var txt = sel.options[sel.selectedIndex].text.replace(/(\d) (?=\d)/g, '$1 ').replace(/(^|\s)(\S{1,2}) /g, '$1$2 ');
        var cut = txt.lastIndexOf(' ') + 1;
        box.innerHTML = '<span class="pick__val">' + esc(txt.slice(0, cut)) + '<span class="pick__tail">' + esc(txt.slice(cut)) + CHEV + '</span></span>';
      }
      p.sync = sync;
      sync();
      sel.addEventListener('change', sync);

      box.addEventListener('click', function () { p.open ? pickClose(p) : pickOpen(p); });
      box.addEventListener('keydown', function (ev) { pickKey(p, ev); });
      box.addEventListener('blur', function () { setTimeout(function () { if (p.open && !pick.contains(document.activeElement)) pickClose(p); }, 0); });
      // mousedown не отдаёт фокус списку, чтобы клавиатура и чтение экрана оставались на поле
      list.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
      list.addEventListener('click', function (ev) {
        var li = ev.target.closest('[role="option"]');
        if (li) { pickChoose(p, +li.dataset.i); pickClose(p, true); }
      });
      return p;
    });

    backdrop.addEventListener('click', function () { picks.forEach(function (p) { if (p.open) pickClose(p, true); }); });
    document.addEventListener('mousedown', function (ev) {
      picks.forEach(function (p) { if (p.open && !p.pick.contains(ev.target)) pickClose(p); });
    });
    window.addEventListener('resize', function () { picks.forEach(function (p) { if (p.open) pickPlace(p); }); });
  }

  function pickFill(p) {
    var opts = p.sel.options;
    var html = '';
    for (var i = 0; i < opts.length; i++) {
      var on = i === p.sel.selectedIndex;
      html += '<li role="option" id="pick-' + p.group + '-' + i + '" data-i="' + i + '" aria-selected="' + on + '">' +
        '<span class="pick__mark">' + (on ? CHECK : '') + '</span>' +
        '<span class="pick__opt">' + esc(opts[i].text) + '</span>' +
        '<span class="pick__hint">' + esc(optionHint(p.group, opts[i].value)) + '</span></li>';
    }
    p.list.innerHTML = html;
  }

  function pickActive(p, i) {
    var items = p.list.children;
    if (!items.length) return;
    i = Math.max(0, Math.min(items.length - 1, i));
    if (items[p.active]) items[p.active].classList.remove('is-active');
    p.active = i;
    items[i].classList.add('is-active');
    p.box.setAttribute('aria-activedescendant', items[i].id);
    var li = items[i], top = li.offsetTop, bottom = top + li.offsetHeight;
    if (top < p.list.scrollTop) p.list.scrollTop = top;
    else if (bottom > p.list.scrollTop + p.list.clientHeight) p.list.scrollTop = bottom - p.list.clientHeight;
  }

  function pickPlace(p) {
    p.pop.style.left = '';
    if (sheetQuery.matches) return;
    var r = p.pop.getBoundingClientRect();
    var room = document.documentElement.clientWidth - 16;
    if (r.right > room) p.pop.style.left = Math.round(room - r.right) + 'px';
  }

  function pickOpen(p) {
    if (p.open) return;
    pickFill(p);
    p.open = true;
    p.pop.hidden = false;
    p.pick.classList.add('is-open');
    p.box.setAttribute('aria-expanded', 'true');
    backdrop.hidden = !sheetQuery.matches;
    pickPlace(p);
    pickActive(p, p.sel.selectedIndex);
  }

  function pickClose(p, refocus) {
    if (!p.open) return;
    p.open = false;
    p.pop.hidden = true;
    p.pick.classList.remove('is-open');
    p.box.setAttribute('aria-expanded', 'false');
    p.box.removeAttribute('aria-activedescendant');
    backdrop.hidden = true;
    if (refocus) p.box.focus();
  }

  function pickChoose(p, i) {
    if (i === p.sel.selectedIndex) return;
    p.sel.selectedIndex = i;
    p.sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pickKey(p, ev) {
    var k = ev.key, n = p.sel.options.length;
    if (!p.open) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ' || k === 'Home' || k === 'End') {
        ev.preventDefault();
        pickOpen(p);
        if (k === 'Home') pickActive(p, 0);
        if (k === 'End') pickActive(p, n - 1);
      }
      return;
    }
    if (k === 'ArrowDown') { ev.preventDefault(); pickActive(p, p.active + 1); }
    else if (k === 'ArrowUp') { ev.preventDefault(); pickActive(p, p.active - 1); }
    else if (k === 'Home' || k === 'PageUp') { ev.preventDefault(); pickActive(p, 0); }
    else if (k === 'End' || k === 'PageDown') { ev.preventDefault(); pickActive(p, n - 1); }
    else if (k === 'Enter' || k === ' ') { ev.preventDefault(); pickChoose(p, p.active); pickClose(p, true); }
    else if (k === 'Escape') { ev.preventDefault(); pickClose(p, true); }
    else if (k === 'Tab') { pickChoose(p, p.active); pickClose(p); }
  }

  /* ---------- UI wiring ---------- */
  function wireCalc() {
    var form = $('#calcForm');
    if (form) form.addEventListener('change', function (ev) {
      var el = ev.target;
      if (el && el.name && state.hasOwnProperty(el.name)) {
        state[el.name] = el.value;
        renderEstimate();
        saveCalc();
      }
    });
  }
  function wireCurrency() {
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-currency]');
      if (b) {
        state.currency = b.dataset.currency;
        renderPrices();
        renderEstimate();
        saveCalc();
      }
    });
  }

  // Кнопки копирования у контактов. Список перерисовывается при смене языка, поэтому слушаем документ.
  function wireCopy() {
    function fallback(text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
    }
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest('.copy');
      if (!btn) return;
      var text = btn.getAttribute('data-copy');
      var job = navigator.clipboard && window.isSecureContext
        ? navigator.clipboard.writeText(text).catch(function () { return fallback(text); })
        : fallback(text);
      job.then(function () {
        btn.classList.add('is-done');
        clearTimeout(btn._t);
        btn._t = setTimeout(function () { btn.classList.remove('is-done'); }, 1600);
        toast(t('js.copied', { x: text }));
      }, function () { toast(t('js.copyFail')); });
    });
  }

  // Светлая и тёмная тема. Пока посетитель не выбрал сам, следуем настройке системы.
  function wireTheme() {
    var btn = $('#themeBtn');
    if (!btn) return;
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    function current() {
      var set = document.documentElement.getAttribute('data-theme');
      if (set === 'light' || set === 'dark') return set;
      return mq && mq.matches ? 'dark' : 'light';
    }
    function label() {
      var text = t(current() === 'dark' ? 'js.themeToLight' : 'js.themeToDark');
      btn.setAttribute('aria-label', text);
      btn.setAttribute('title', text);
    }
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store.set('theme', next);
      label();
    });
    if (mq) {
      var onChange = function () { label(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    }
    label();
  }

  /*
   * Услуги: три слайда. Листаются сами, полоска над слайдом заполняется
   * и показывает, сколько осталось до следующего. Под курсором и при фокусе
   * листание замирает, после касания или колёсика ждёт подольше.
   */
  function wireCarousel() {
    var track = $('#svcTrack');
    if (!track) return;
    var area = track.closest('.svc-area') || track.parentNode;
    var slides = $all('.svc-slide', track);
    var tabs = $all('.svc-steps [role="tab"]');
    var fills = tabs.map(function (tab) { return $('.svc-steps__bar i', tab); });
    var arrows = $all('.svc-arrow', area);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DUR = 8000, HOLD = 12000;
    var auto = !reduce, cur = 0, elapsed = 0, last = 0, raf = 0, holdUntil = 0;
    var seen = !('IntersectionObserver' in window), hover = false, focused = false, scrollTimer;

    function fit() { track.style.height = slides[cur].offsetHeight + 'px'; }
    function paint() {
      fills.forEach(function (f, j) {
        var k = j < cur ? 1 : j > cur ? 0 : auto ? Math.min(1, elapsed / DUR) : 1;
        f.style.transform = 'scaleX(' + k.toFixed(4) + ')';
      });
    }
    function mark(i) {
      cur = i; elapsed = 0;
      tabs.forEach(function (tab, j) {
        tab.setAttribute('aria-selected', String(j === i));
        tab.tabIndex = j === i ? 0 : -1;
      });
      paint();
      fit();
    }
    function go(i, instant) {
      i = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[i].offsetLeft, behavior: instant || reduce ? 'auto' : 'smooth' });
      mark(i);
    }
    function frame(now) {
      raf = 0;
      if (!auto || !seen) return;
      if (last && !hover && !focused && !document.hidden && Date.now() >= holdUntil) {
        elapsed += Math.min(now - last, 100);
        if (elapsed >= DUR) go(cur + 1);
      }
      last = now;
      paint();
      raf = requestAnimationFrame(frame);
    }
    function run() { if (auto && seen && !raf) { last = 0; raf = requestAnimationFrame(frame); } }
    function hold() { holdUntil = Date.now() + HOLD; }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { go(i); });
      tab.addEventListener('keydown', function (ev) {
        var to = ev.key === 'ArrowRight' ? i + 1 : ev.key === 'ArrowLeft' ? i - 1 : ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1 : null;
        if (to === null) return;
        ev.preventDefault();
        to = (to + tabs.length) % tabs.length;
        tabs[to].focus();
        go(to);
      });
    });
    arrows.forEach(function (b) { b.addEventListener('click', function () { go(cur + Number(b.dataset.step)); }); });
    // свайп пальцем: когда прокрутка остановилась, отмечаем слайд, который виден
    track.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (i !== cur && slides[i]) mark(i);
      }, 90);
    }, { passive: true });
    area.addEventListener('touchstart', hold, { passive: true });
    track.addEventListener('wheel', function (ev) { if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) hold(); }, { passive: true });
    area.addEventListener('mouseenter', function () { hover = true; });
    area.addEventListener('mouseleave', function () { hover = false; });
    area.addEventListener('focusin', function () { focused = true; });
    area.addEventListener('focusout', function (ev) { focused = area.contains(ev.relatedTarget); });
    if (!seen) {
      new IntersectionObserver(function (entries) {
        seen = entries[0].isIntersecting;
        run();
      }, { threshold: 0.35 }).observe(area);
    }
    window.addEventListener('resize', function () { track.scrollTo({ left: slides[cur].offsetLeft }); fit(); });
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(fit);
      slides.forEach(function (s) { ro.observe(s); });
    }
    onFontsChange(fit);
    // после перехода между страницами браузер сбрасывает прокрутку ленты
    track._sync = function () { track.scrollTo({ left: slides[cur].offsetLeft }); fit(); };
    mark(0);
    run();
  }

  // Курсор по всему сайту: капля чернил, за ней след, который быстро высыхает.
  function wireInk() {
    if (!window.matchMedia) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cv = document.createElement('canvas');
    var ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return;
    cv.className = 'ink-trail';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    var LIFE = 750, pts = [], raf = 0, dpr = 1, color = '#2B3FB8', brk = true;
    function setColor() { color = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || color; }
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(window.innerWidth * dpr);
      cv.height = Math.round(window.innerHeight * dpr);
    }
    function draw() {
      raf = 0;
      var now = performance.now();
      while (pts.length && now - pts[0].t > LIFE) pts.shift();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (!pts.length) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        if (b.gap) continue;
        var life = 1 - (now - b.t) / LIFE;
        ctx.globalAlpha = 0.5 * life;
        ctx.lineWidth = b.w * (0.35 + 0.65 * life);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    document.addEventListener('pointermove', function (ev) {
      if (ev.pointerType && ev.pointerType !== 'mouse') return;
      var x = ev.clientX, y = ev.clientY, now = performance.now();
      var p = pts[pts.length - 1];
      // медленно ведёшь, чернил больше: линия толще
      var speed = p ? Math.sqrt((x - p.x) * (x - p.x) + (y - p.y) * (y - p.y)) / Math.max(1, now - p.t) : 0;
      pts.push({ x: x, y: y, t: now, w: Math.max(1.4, Math.min(5.5, 5.5 - speed * 1.6)), gap: brk || !p || now - p.t > 120 });
      brk = false;
      if (!raf) raf = requestAnimationFrame(draw);
    });
    document.documentElement.addEventListener('mouseleave', function () { brk = true; });
    setColor();
    if ('MutationObserver' in window) new MutationObserver(setColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    var dark = matchMedia('(prefers-color-scheme: dark)');
    if (dark.addEventListener) dark.addEventListener('change', setColor);
    size();
    window.addEventListener('resize', size);
  }

  // Тонкая линия над шапкой: сколько страницы уже прокручено.
  function wireScrollLine() {
    var bar = $('.topbar');
    if (!bar) return;
    var line = document.createElement('div');
    line.className = 'scroll-line';
    line.setAttribute('aria-hidden', 'true');
    bar.appendChild(line);
    var ticking = false;
    function upd() {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var k = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      line.style.transform = 'scaleX(' + k.toFixed(4) + ')';
    }
    function req() { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', req);
    upd();
  }

  // Форма заявки уже на экране (рядом с расчётом): ссылка на неё ставит курсор в первое пустое поле.
  function wireBriefLinks() {
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[href="#brief"]');
      var brief = $('#brief'), form = $('#briefForm');
      if (!a || !brief || !form) return;
      var r = brief.getBoundingClientRect();
      if (r.top < 0 || r.top > window.innerHeight * 0.5) return; // далеко: пусть прокрутит как обычно
      ev.preventDefault();
      var empty = $all('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not(.hp), textarea', form)
        .filter(function (el) { return !el.value.trim(); })[0];
      (empty || $('textarea', form)).focus({ preventScroll: true });
    });
  }

  // Кнопка «наверх» появляется, когда первый экран ушёл из виду.
  function wireToTop() {
    var btn = $('#toTop');
    if (!btn) return;
    var on = null;
    function check() {
      var show = window.scrollY > window.innerHeight * 1.2;
      if (show !== on) { on = show; btn.classList.toggle('is-on', show); }
    }
    window.addEventListener('scroll', check, { passive: true });
    check();
    btn.addEventListener('click', function () {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      // фокус тоже возвращаем в начало, чтобы с клавиатуры не прыгать обратно вниз
      var logo = $('.logo');
      if (logo) logo.focus({ preventScroll: true });
    });
  }

  /*
   * Активный пункт меню. Подчёркивание ведёт себя как капля чернил:
   * появляется точкой и растекается под словом, при переходе сначала тянется
   * передним краем к новому пункту, потом подтягивает хвост.
   */
  function wireNavDrop() {
    var nav = $('#nav');
    var drop = $('.nav__drop', nav);
    var links = $all('a', nav);
    function isHash(a) { return a.getAttribute('href').charAt(0) === '#'; }
    // пункт отдельной страницы, на которой мы сейчас
    var here = null, targets = [];
    function scan() {
      here = links.filter(function (a) { return !isHash(a) && a.pathname === location.pathname; })[0] || null;
      targets = links.filter(isHash).map(function (a) { return { link: a, el: $(a.getAttribute('href')) }; }).filter(function (x) { return x.el; });
    }
    scan();
    var current = null, lockUntil = 0, moveTimer;

    function place(link, instant) {
      links.forEach(function (a) {
        a.classList.toggle('is-active', a === link);
        if (a === link) a.setAttribute('aria-current', a === here ? 'page' : 'location'); else a.removeAttribute('aria-current');
      });
      if (!link) {
        drop.classList.remove('is-on');
        current = null;
        return;
      }
      var nr = nav.getBoundingClientRect(), r = link.getBoundingClientRect();
      if (!nr.width || !r.width) { current = link; return; } // меню свёрнуто на телефоне
      var left = r.left - nr.left, right = nr.right - r.right;

      if (!current || instant) {
        // капля появляется точкой посередине слова и растекается
        var mid = (r.left + r.right) / 2 - nr.left;
        drop.style.transition = 'none';
        drop.style.left = (mid - 3) + 'px';
        drop.style.right = (nr.width - mid - 3) + 'px';
        void drop.offsetWidth;
        drop.style.transition = '';
        drop.style.setProperty('--tl', '.32s');
        drop.style.setProperty('--tr', '.32s');
      } else if (current !== link) {
        var toRight = r.left > current.getBoundingClientRect().left;
        drop.style.setProperty('--tl', toRight ? '.46s' : '.24s');
        drop.style.setProperty('--tr', toRight ? '.24s' : '.46s');
        drop.classList.add('is-moving');
        clearTimeout(moveTimer);
        moveTimer = setTimeout(function () { drop.classList.remove('is-moving'); }, 460);
      }
      drop.classList.add('is-on');
      drop.style.left = left + 'px';
      drop.style.right = right + 'px';
      current = link;
    }

    function spy() {
      if (here || !targets.length || Date.now() < lockUntil) return;
      var line = Math.min(window.innerHeight * 0.4, 360);
      var active = null;
      // разделы по порядку на странице, а не в меню: «Расчёт» в меню первый, а на странице ниже услуг
      var live = targets.filter(function (x) { return getComputedStyle(x.el).position !== 'fixed'; })
        .map(function (x) { return { link: x.link, top: x.el.getBoundingClientRect().top }; })
        .sort(function (a, b) { return a.top - b.top; });
      live.forEach(function (x) { if (x.top <= line) active = x.link; });
      // в самом низу страницы активен последний пункт
      if (live.length && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = live[live.length - 1].link;
      if (active !== current) place(active);
    }

    var ticking = false, settle;
    // когда прокрутка остановилась, сверяемся ещё раз: после клика блокировка
    // могла закончиться уже без новых событий scroll
    function settleLater(ms) {
      clearTimeout(settle);
      settle = setTimeout(function () { lockUntil = 0; spy(); }, ms);
    }
    window.addEventListener('scroll', function () {
      if (Date.now() < lockUntil) lockUntil = Date.now() + 160; // пока идёт плавная прокрутка после клика
      settleLater(Math.max(180, lockUntil - Date.now() + 20));
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; spy(); });
    }, { passive: true });

    nav.addEventListener('click', function (ev) {
      var a = ev.target.closest('a[href^="#"]');
      if (!a) return;
      lockUntil = Date.now() + 900;
      place(a);
      settleLater(1200);
    });
    window.addEventListener('resize', function () { if (current) place(current, true); });
    onFontsChange(function () { if (current) place(current, true); });
    if (here) place(here, true); else spy();
    navRefresh = function () {
      scan();
      lockUntil = 0;
      if (here) place(here); else { place(null); spy(); }
    };
  }
  var navRefresh = function () {};

  // Шапка одна на все страницы: якоря на разделы главной ведут на главную.
  function fixAnchors() {
    $all('.topbar a').forEach(function (a) {
      if (!a.dataset.hash) {
        var href = a.getAttribute('href') || '';
        if (href.charAt(0) !== '#') return;
        a.dataset.hash = href;
      }
      var id = a.dataset.hash.slice(1);
      a.setAttribute('href', id && !document.getElementById(id) ? './' + a.dataset.hash : a.dataset.hash);
    });
  }

  /*
   * Переходы между страницами без перезагрузки. Каждая страница остаётся
   * отдельным HTML-файлом (прямые ссылки и поисковики работают как раньше),
   * а здесь подменяется только <main>. Открытые страницы держим в памяти,
   * поэтому калькулятор, слайд услуг и черновик заявки остаются как были.
   */
  var PAGES = { '': 'home', 'index.html': 'home', 'about.html': 'about', 'projects.html': 'projects', 'pricing.html': 'pricing' };
  var BASE = location.pathname.replace(/[^\/]*$/, '');
  function pageOf(url) {
    if (url.origin !== location.origin || url.pathname.indexOf(BASE) !== 0) return null;
    var rest = url.pathname.slice(BASE.length);
    return PAGES.hasOwnProperty(rest) ? PAGES[rest] : null;
  }

  // Всё, что живёт внутри <main>: рисуем и оживляем один раз на страницу.
  function mountMain() {
    var main = $('#main');
    if (!main || main._ttx) return;
    main._ttx = true;
    renderStatic();
    renderPrices();
    renderEstimate();
    wirePicks();
    wireCarousel();
    wireCalc();
    wireBrief();
  }

  function wireRouter() {
    var pageNow = pageOf(new URL(location.href));
    if (pageNow === null || !window.history || !history.pushState || !window.fetch || !window.DOMParser) return;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    var mains = {}, busy = false, saveTimer;
    function remember() {
      var st = {};
      if (history.state) for (var k in history.state) st[k] = history.state[k];
      st.ttx = pageNow; st.y = window.scrollY;
      history.replaceState(st, '');
    }
    remember();
    window.addEventListener('scroll', function () { clearTimeout(saveTimer); saveTimer = setTimeout(remember, 150); }, { passive: true });

    function load(page, url) {
      if (mains[page]) return Promise.resolve(mains[page]);
      return fetch(url.pathname, { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (html) {
          var m = new DOMParser().parseFromString(html, 'text/html').getElementById('main');
          if (!m) throw new Error('no <main>');
          return document.adoptNode(m);
        });
    }
    function scrollTo(y, target) {
      var root = document.documentElement, was = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      if (target) target.scrollIntoView(); else window.scrollTo(0, y || 0);
      root.style.scrollBehavior = was;
    }
    function show(url, push) {
      var page = pageOf(url);
      if (busy || page === null) return;
      busy = true;
      load(page, url).then(function (next) {
        clearTimeout(saveTimer);
        var cur = $('#main');
        mains[pageNow] = cur;
        cur.parentNode.replaceChild(next, cur);
        pageNow = page;
        if (page === 'home') document.body.removeAttribute('data-page'); else document.body.setAttribute('data-page', page);
        if (push) history.pushState({ ttx: page, y: 0 }, '', url.pathname + url.search + url.hash);
        var I18N = window.TTX_I18N;
        if (I18N) { if (next._ttx) I18N.applyMeta(); else I18N.apply(next); }
        mountMain();
        renderPrices(); // валюту могли переключить на другой странице
        renderEstimate();
        var tr = $('#svcTrack');
        if (tr && tr._sync) tr._sync();
        fixAnchors();
        navRefresh();
        var target = push && url.hash ? document.getElementById(url.hash.slice(1)) : null;
        scrollTo(!push && history.state ? history.state.y : 0, target);
        next.setAttribute('tabindex', '-1');
        next.focus({ preventScroll: true });
        window.dispatchEvent(new Event('scroll')); // полоска прокрутки, меню, кнопка «наверх»
        busy = false;
      }).catch(function () { location.href = url.href; });
    }

    document.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var a = ev.target.closest && ev.target.closest('a[href]');
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-lang')) return;
      var url = new URL(a.href, location.href);
      var page = pageOf(url);
      if (page === null) return;
      if (page === pageNow) {
        if (url.hash && url.search === location.search) return; // обычный якорь на этой же странице
        ev.preventDefault();
        var el = url.hash && document.getElementById(url.hash.slice(1));
        if (el) el.scrollIntoView(); else window.scrollTo({ top: 0 });
        return;
      }
      ev.preventDefault();
      remember();
      show(url, true);
    });
    window.addEventListener('popstate', function () {
      var url = new URL(location.href);
      var page = pageOf(url);
      if (page === null) return;
      if (page !== pageNow) { show(url, false); return; }
      if (history.state && typeof history.state.y === 'number') scrollTo(history.state.y);
    });
  }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, 3500);
  }
  window.TTX.toast = toast;

  function wirePdf() {
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-action]');
      if (!b) return;
      var action = b.dataset.action;
      if (action !== 'download-kp' && action !== 'download-estimate') return;
      b.disabled = true;
      toast(t('js.pdfBuilding'));
      var job = action === 'download-kp'
        ? window.TTXPdf.downloadKp(state.currency)
        : window.TTXPdf.downloadEstimate(estimate(state), {});
      job.then(function () { toast(t('js.pdfDone')); })
        .catch(function (err) { console.error(err); toast(t('js.pdfFail')); })
        .then(function () { b.disabled = false; });
    });
  }

  /* ---------- brief form ---------- */
  // Текст для владельца сайта: всегда по-русски, с теми же цифрами.
  function estimateForOwner(e) {
    var cur = e.currency;
    var c = byId(DRU.complexity, e.complexity.id), u = byId(DRU.users, e.users.id), d = byId(DRU.data, e.data.id);
    return 'от ' + money(e.total, cur, 'ru') + ' | ' + (c.level || c.name + ' уровень') + ' (база ' + money(e.base, cur, 'ru') + ') | пользователей: ' + u.range +
      ' (' + fmtK(u.k, 'ru') + ') | данные: ' + d.ops + ' оп/сутки (' + fmtK(d.k, 'ru') + ') | срок: ' + c.term;
  }

  function wireBrief() {
    var form = $('#briefForm');
    if (!form) return;
    var fileInput = $('#tzFile');
    var drop = $('#drop');
    var dropText = $('#dropText');
    var clearBtn = $('#dropClear');
    var status = $('#briefStatus');
    var submitBtn = $('#briefSubmit');
    var submitLabel = $('.btn__label', submitBtn);
    var frame = $('#briefFrame');
    var maxBytes = CFG.maxUploadMb * 1024 * 1024;
    var defaultDropText = dropText.innerHTML;
    var waiting = false, slowTimer, giveUpTimer;

    // Библиотеку PDF качаем заранее, пока человек читает и заполняет форму.
    function preloadPdf() { if (window.TTXPdf && window.TTXPdf.preload) window.TTXPdf.preload(); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) { preloadPdf(); io.disconnect(); }
      }, { rootMargin: '800px 0px' });
      io.observe($('#brief'));
    }
    form.addEventListener('focusin', preloadPdf, { once: true });

    function busy(on, label) {
      submitBtn.disabled = on;
      submitBtn.classList.toggle('is-loading', on);
      submitBtn.setAttribute('aria-busy', String(on));
      submitLabel.textContent = label || t('ui.form.submit');
    }

    function showFile() {
      var f = fileInput.files && fileInput.files[0];
      if (f) {
        var size = (f.size / 1024 / 1024).toFixed(1);
        if (LANG !== 'en') size = size.replace('.', ',');
        dropText.innerHTML = '<strong>' + esc(f.name) + '</strong>, ' + esc(t('js.fileSize', { size: size }));
        drop.classList.add('has-file');
        clearBtn.hidden = false;
      } else {
        dropText.innerHTML = defaultDropText;
        drop.classList.remove('has-file');
        clearBtn.hidden = true;
      }
    }
    fileInput.addEventListener('change', showFile);
    clearBtn.addEventListener('click', function () { fileInput.value = ''; showFile(); });
    ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function () { drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function () { drop.classList.remove('is-over'); }); });

    function setError(field, msg) {
      var wrap = field.closest('.field');
      if (!wrap) return;
      wrap.classList.add('is-invalid');
      var err = wrap.querySelector('.field__error');
      if (!err) { err = document.createElement('span'); err.className = 'field__error'; wrap.appendChild(err); }
      err.textContent = msg;
    }
    function clearErrors() {
      $all('.field.is-invalid', form).forEach(function (w) {
        w.classList.remove('is-invalid');
        var e = w.querySelector('.field__error'); if (e) e.remove();
      });
    }
    form.addEventListener('input', function (ev) {
      var w = ev.target.closest('.field');
      if (w && w.classList.contains('is-invalid')) { w.classList.remove('is-invalid'); var e = w.querySelector('.field__error'); if (e) e.remove(); }
    });

    // Черновик заявки: переживает перезагрузку и переход на другие страницы.
    // Приложенный файл браузер сохранить не даёт, его придётся выбрать заново.
    var DRAFT = ['name', 'company', 'email', 'phone', 'message'];
    var attach = $('#attachEstimate');
    var draft = getFresh('brief');
    if (draft) {
      DRAFT.forEach(function (n) { var el = form.elements.namedItem(n); if (el && typeof draft[n] === 'string') el.value = draft[n]; });
      if (typeof draft.attach === 'boolean') attach.checked = draft.attach;
    }
    var draftTimer = null;
    function saveDraft() {
      clearTimeout(draftTimer); draftTimer = null;
      var d = { attach: attach.checked }, any = !attach.checked;
      DRAFT.forEach(function (n) { var v = form.elements.namedItem(n).value; d[n] = v; if (v.trim()) any = true; });
      if (any) setFresh('brief', d); else store.del('brief');
    }
    form.addEventListener('input', function () { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 300); });
    attach.addEventListener('change', saveDraft);
    window.addEventListener('pagehide', function () { if (draftTimer) saveDraft(); });

    function setStatus(msg, kind) {
      status.textContent = msg;
      status.className = 'form__status' + (kind ? ' is-' + kind : '');
    }

    frame.addEventListener('load', function () {
      if (!waiting) return;
      waiting = false;
      clearTimeout(slowTimer); clearTimeout(giveUpTimer);
      busy(false);
      setStatus(t('js.sentStatus'), 'ok');
      toast(t('js.sentToast'));
      form.reset();
      showFile();
      $('#attachEstimate').checked = true;
      clearTimeout(draftTimer); draftTimer = null;
      store.del('brief');
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (waiting) return;
      clearErrors();
      setStatus('');

      var name = form.elements.name, email = form.elements.email, message = form.elements.message;
      var bad = null;
      if (!name.value.trim()) { setError(name, t('js.errName')); bad = bad || name; }
      if (!email.value.trim() || !email.checkValidity()) { setError(email, t('js.errEmail')); bad = bad || email; }
      if (!message.value.trim()) { setError(message, t('js.errMsg')); bad = bad || message; }
      var f = fileInput.files && fileInput.files[0];
      if (f && f.size > maxBytes) { setStatus(t('js.errFile', { mb: CFG.maxUploadMb }), 'error'); bad = bad || fileInput; }
      if (bad) { bad.focus(); return; }
      if (form.elements._honey.value) return; // бот

      var withEstimate = $('#attachEstimate').checked;
      var e = estimate(state);
      var cur = e.currency;
      var company = form.elements.company.value.trim();
      form.elements.estimate.value = withEstimate ? estimateForOwner(e) : 'не приложен';
      form.elements.language.value = LANG === 'kk' ? 'Казахский' : LANG === 'en' ? 'Английский' : 'Русский';
      form.elements._subject.value = 'Заявка с сайта ttx.dev' + (LANG !== 'ru' ? ' [' + LANG.toUpperCase() + ']' : '') + ': ' + name.value.trim() + (company ? ' (' + company + ')' : '');
      form.elements._autoresponse.value =
        t('js.autoHello', { name: name.value.trim() }) +
        (withEstimate ? t('js.autoEst', { total: from(money(e.total, cur)), term: e.complexity.term }) : '') +
        '\n\n' + t('js.signature', { owner: CFG.owner }) + '\n' + CFG.siteUrl;

      busy(true, withEstimate ? t('js.preparing') : t('js.sending'));

      var kpInput = $('#kpFile');
      var attachPdf = withEstimate
        ? window.TTXPdf.estimateBlob(e, { name: name.value.trim(), company: company })
            .then(function (blob) {
              try {
                var dt = new DataTransfer();
                dt.items.add(new File([blob], t('js.estFile'), { type: 'application/pdf' }));
                kpInput.files = dt.files;
                kpInput.name = 'kp_attachment';
              } catch (err) { kpInput.removeAttribute('name'); }
            })
            .catch(function () { kpInput.removeAttribute('name'); })
        : Promise.resolve().then(function () { kpInput.removeAttribute('name'); });

      attachPdf.then(function () {
        busy(true, t('js.sending'));
        form.action = CFG.formEndpoint();
        waiting = true;
        form.submit();
        // FormSubmit бывает медленным: честно говорим, что ждём, и не просим отправлять повторно
        slowTimer = setTimeout(function () { if (waiting) setStatus(t('js.slow')); }, 10000);
        giveUpTimer = setTimeout(function () {
          if (!waiting) return;
          waiting = false;
          busy(false);
          setStatus(t('js.timeout', { tg: (CFG.contacts.telegram || '').replace(/^@/, '') }), 'error');
        }, 120000);
      });
    });
  }

  /* ---------- init ---------- */
  fixAnchors();
  mountMain();
  wireCurrency();
  wireInk();
  wireScrollLine();
  wireBriefLinks();
  wireTheme();
  wireToTop();
  wireCopy();
  wireNavDrop();
  wirePdf();
  wireRouter();
})();
