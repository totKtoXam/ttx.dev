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
  // «2-го», «5-ші», «2nd-»: строка не рвётся на дефисе после цифры (U+2060 запрещает перенос)
  function keepHyphen(s) { return String(s).replace(/(\d)-(?=[^\s\d])/g, '$1-⁠'); }

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
    // крупные суммы округляем до 10 000 ₸, мелкие до 1 000 ₸, иначе скидка на скрипт теряется в округлении
    var step = cur === 'usd' ? (raw < 1000 ? 1 : 10) : (raw < 500000 ? 1000 : 10000);
    var parts = discountParts(state, c.id);
    var pct = parts.reduce(function (s, x) { return s + x.pct; }, 0);
    return {
      currency: cur, complexity: c, users: u, data: d,
      base: base,
      gross: Math.round(raw / step) * step,
      total: Math.round(raw * (1 - pct / 100) / step) * step,
      pct: pct, parts: parts,
      individual: !!(u.plus || d.plus || c.id === 'enterprise'),
    };
  }

  // Какие скидки подходят к выбранной сложности. Скидки складываются.
  function discountParts(state, level) {
    var S = D.discounts, out = [];
    if (level === 'task') {
      var l = byId(S.loyalty, state.order);
      if (l.pct) out.push({ key: 'order', pct: l.pct });
    }
    if (level === 'simple' || level === 'medium') {
      var p = byId(S.prepay, state.prepay);
      if (p.pct) out.push({ key: 'prepay', pct: p.pct, share: p.share });
    }
    if (level === 'complex' && state.full === 'full') out.push({ key: 'full', pct: S.full });
    if (state.cash) out.push({ key: 'cash', pct: S.cash });
    return out;
  }
  function discText(e, lang) {
    var parts = lang ? window.TTX_I18N.dict(lang).js.discParts : null;
    return e.parts.map(function (x) {
      return String(parts ? parts[x.key] : t('js.discParts.' + x.key)).replace('{s}', x.share || '');
    }).join(', ');
  }

  window.TTX = { money: money, moneyPdf: moneyPdf, fmtK: fmtK, fmtNum: fmtNum, estimate: estimate, byId: byId, from: from, discText: discText };

  /* ---------- state ---------- */
  var saved = getFresh('calc') || {};
  var state = {
    complexity: saved.complexity || 'medium',
    users: saved.users || 'u1k',
    data: saved.data || 'dMid',
    currency: saved.currency === 'usd' || saved.currency === 'kzt' ? saved.currency : (LANG === 'en' ? 'usd' : 'kzt'),
    order: saved.order || 'n1',
    prepay: saved.prepay || 'p20',
    full: saved.full === 'full' ? 'full' : 'stages',
    cash: !!saved.cash,
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

    render('projects', renderProjects());

    render('price-discounts', thead(t('js.headDiscounts')) + '<tbody>' +
      (D.discountRows || []).map(function (r) {
        return '<tr><td class="strong">' + esc(r.name) + '</td><td class="muted">' + esc(r.text) + '</td><td class="num">' + esc(r.size) + '</td></tr>';
      }).join('') + '</tbody>');

    render('process', D.process.map(function (s) {
      return '<li><span class="road__dot" aria-hidden="true"></span><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></li>';
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

    // подписи колонок у ячеек: на телефоне таблица превращается в карточки «подпись: значение»
    $all('table.table').forEach(function (tb) {
      var heads = $all('thead th', tb).map(function (th) { return th.textContent; });
      $all('tbody tr', tb).forEach(function (tr) {
        Array.prototype.forEach.call(tr.children, function (td, i) { if (heads[i]) td.setAttribute('data-label', heads[i]); });
      });
    });

    render('sel-users', D.users.map(function (u) { return selOption('users', u.id, u.range); }).join(''));
    render('sel-data', D.data.map(function (d) { return selOption('data', d.id, d.ops); }).join(''));
    render('sel-complexity', D.complexity.map(function (c) { return selOption('complexity', c.id, c.phrase); }).join(''));

    render('contacts', contactItems().map(function (c) {
      var copy = c.copy ? '<button class="copy" type="button" data-copy="' + esc(c.copy) + '" aria-label="' + esc(t('js.copyLabel', { x: c.label })) + '" title="' + esc(t('js.copy')) + '">' + COPY_ICONS + '</button>' : '';
      return '<li><span class="contacts__ico" title="' + esc(c.label) + '">' + contactIco(c.ico) + '<span class="vh">' + esc(c.label) + '</span></span>' + copy + '<a href="' + esc(c.href) + '"' + (c.external ? ' target="_blank" rel="noopener"' : '') + '>' + esc(c.value) + '</a>' + (c.qr && window.TTX_QR && window.TTX_QR[c.qr]
        ? '<button class="qrbtn" type="button" data-qr-open="' + c.qr + '" data-qr-name="' + esc(c.label) + '" aria-label="' + esc(t('ui.contacts.qrShow') + ': ' + c.label) + '" title="' + esc(t('ui.contacts.qrShow')) + '">' + QR_ICON + '</button>' : '') + '</li>';
    }).join(''));

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

  var QR_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5M20 14v.01M14 20h.01M17 20h3v-3"/></g></svg>';

  function contactItems() {
    var c = CFG.contacts, out = [];
    if (c.telegram) out.push({ ico: 'telegram', label: 'Telegram', value: '@' + c.telegram.replace(/^@/, ''), href: 'https://t.me/' + c.telegram.replace(/^@/, ''), external: true, copy: '@' + c.telegram.replace(/^@/, ''), qr: 'telegram' });
    if (c.whatsapp) {
      var wa = c.whatsapp.replace(/\D/g, '');
      // если WhatsApp на том же номере, номер второй раз не повторяем: строка просто зовёт написать
      var same = c.phone && c.phone.replace(/\D/g, '') === wa;
      var waNum = same ? c.phone : '+' + wa;
      out.push({ ico: 'whatsapp', label: 'WhatsApp', value: same ? t('js.waWrite') : waNum, plain: waNum, href: 'https://wa.me/' + wa, external: true, copy: waNum, qr: 'whatsapp' });
    }
    if (c.phone) out.push({ ico: 'phone', label: t('js.phone'), value: c.phone, href: 'tel:' + c.phone.replace(/[^\d+]/g, ''), copy: c.phone, qr: 'phone' });
    if (c.email) { var mail = atob(c.email); out.push({ ico: 'email', label: t('js.email'), value: mail, href: 'mailto:' + mail, copy: mail, qr: 'email' }); }
    if (c.github) out.push({ ico: 'github', label: 'GitHub', value: c.github.replace(/^https?:\/\//, ''), href: c.github, external: true, copy: c.github, qr: 'github' });
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
    // цен у карточек разработки нет: стартовая цена и ссылка на калькулятор стоят в подзаголовке слайда
    render('svc-dev', D.services.slice(0, DEV_ART.length).map(function (x, i) { return svcItem(DEV_ART[i], x.title, x.text); }).join('') +
      svcItem('script', t('ui.services.mini'), mini.examples + '.'));
    render('svc-consult', D.consult.map(function (x, i) { return svcItem(CONSULT_ART[i], x.name, x.what, x[cur]); }).join(''));
    render('svc-after', D.extras.slice(0, AFTER_ART.length).map(function (x, i) { return svcItem(AFTER_ART[i], x.name, x.text, x[cur]); }).join(''));
    var srv = D.extras[AFTER_ART.length];
    render('svc-after-note', srv ? esc(srv.name + ': ' + lowerFirst(srv[cur]) + '.') : '');
  }

  /* ---------- projects ---------- */
  // Рисунки к проектам тем же пером, что и к услугам. Порядок как в data.projects.
  var PRJ_ART = [
    // onwin: окно Windows внутри Mac
    '<path class="mk" d="M24 17h16v15H24z"/><path d="M6 7h52v30H6z"/><path d="M6 13h52"/><path d="M10 10h.01M14 10h.01M18 10h.01"/><path d="M24 17h7v6.5h-7zM33 17h7v6.5h-7zM24 25.5h7V32h-7zM33 25.5h7V32h-7z"/><path d="M22 42h20M32 37v5"/>',
    // ATS: канбан с карточками кандидатов
    '<path class="mk" d="M27 14h12v7H27z"/><path d="M5 7h54v34H5z"/><path d="M23 7v34M41 7v34"/><path d="M9 12h10v6H9zM9 21h10v6H9zM27 14h12v7H27zM45 12h10v6H45zM45 21h10v6H45zM45 30h10v6H45z"/><path d="M19.5 33.5c3 2.5 6 2.5 8.5 0"/><path d="M26 31.3l2.2 2.2-2.6 1.2"/>',
    // Cue: сообщение и часы
    '<circle class="mk" cx="47" cy="18" r="10"/><path d="M8 10h24a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H19l-7 6v-6H8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z"/><path d="M11 17h18M11 22.5h12"/><circle cx="47" cy="18" r="10"/><path d="M47 12v6l4 2.5"/><path d="M28 39h28M28 44h16"/>',
    // MarkItDown: документ превращается в Markdown
    '<path class="mk" d="M40 16h18v18H40z"/><path d="M6 6.5h19l7 7V41H6z"/><path d="M25 6.5v7h7"/><path d="M11 20h15M11 25h15M11 30h10"/><path d="M33.5 24h4.5M36 21l3 3-3 3"/><path d="M40 16h18v18H40z"/><path d="M43.5 29.5v-9l3.5 4.5 3.5-4.5v9"/><path d="M54.5 21v8M52.5 27l2 2.5 2-2.5"/>',
    // sshgui: терминал и список подключений
    '<path class="mk" d="M39 18h15v14H39z"/><path d="M5 7h54v34H5z"/><path d="M5 13h54"/><path d="M9 10h.01M13 10h.01M17 10h.01"/><path d="M11 20l6 4.5-6 4.5"/><path d="M21 31h10"/><path d="M41 21h11M41 25h8M41 29h11"/>',
  ];
  var ARROW_PREV = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ARROW_NEXT = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function renderProjects() {
    var tabs = '', slides = '';
    D.projects.forEach(function (p, i) {
      var n = i + 1, on = i === 0;
      tabs += '<button type="button" role="tab" id="prjTab' + n + '" aria-controls="prjSlide' + n + '" aria-selected="' + on + '"' + (on ? '' : ' tabindex="-1"') + '>' +
        '<span class="svc-steps__label">' + esc(p.name) + '</span><span class="svc-steps__bar"><i></i></span></button>';
      var links = '<a class="btn btn--primary" href="' + esc(p.repo) + '" target="_blank" rel="noopener">' + esc(t('js.code')) + '</a>';
      if (p.site) links += '<a class="btn" href="' + esc(p.site) + '" target="_blank" rel="noopener">' + esc(t('js.site')) + '</a>';
      var pic = PRJ_ART[i] ? '<svg class="svc__art" viewBox="0 0 64 48" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">' + PRJ_ART[i] + '</g></svg>' : '';
      slides += '<div class="svc-slide" id="prjSlide' + n + '" role="tabpanel" aria-labelledby="prjTab' + n + '">' +
        '<article class="prj">' + pic +
        '<div class="prj__head"><h3>' + esc(p.name) + '</h3><span>' + esc(p.kind) + '</span></div>' +
        '<p class="prj__text">' + esc(p.text) + '</p>' +
        '<ul class="prj__stack">' + p.stack.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
        '<p class="prj__links">' + links + '</p></article></div>';
    });
    return '<div class="svc-steps" role="tablist" aria-label="' + esc(t('ui.projects.h')) + '">' + tabs + '</div>' +
      '<div class="svc-stage">' +
      '<button class="svc-arrow svc-arrow--prev" type="button" data-step="-1" aria-label="' + esc(t('ui.services.prev')) + '" title="' + esc(t('ui.services.prev')) + '">' + ARROW_PREV + '</button>' +
      '<div class="svc-track">' + slides + '</div>' +
      '<button class="svc-arrow svc-arrow--next" type="button" data-step="1" aria-label="' + esc(t('ui.services.next')) + '" title="' + esc(t('ui.services.next')) + '">' + ARROW_NEXT + '</button>' +
      '</div>';
  }

  /* ---------- currency-dependent renders ---------- */
  function renderPrices() {
    var cur = state.currency;
    render('price-complexity', thead(t('js.headComplexity')) + '<tbody>' +
      D.complexity.map(function (c) {
        return '<tr><td class="strong">' + esc(c.name) + '</td><td class="muted">' + esc(c.what) + '</td><td class="muted">' + esc(c.examples) + '</td><td class="num">' + esc(from(money(c[cur], cur))) + '</td><td class="num">' + esc(c.term) + '</td></tr>';
      }).join('') + '</tbody>');

    var TD = D.tierDisc || [];
    render('tiers', D.complexity.map(function (c, i) {
      var d = TD[i] || {};
      return '<li class="tier">' +
        '<h4 class="tier__name">' + (d.title || esc(c.name)) + '</h4>' +
        '<p class="tier__price">' + esc(from(money(c[cur], cur))) + '</p>' +
        '<p class="tier__term">' + esc(c.term) + '</p>' +
        '<p class="tier__what">' + esc(c.what) + '</p>' +
        '<p class="tier__ex"><span>' + t('ui.tiers.ex') + '</span> ' + esc(lowerFirst(c.examples)) + '</p>' +
        (d.badge ? '<p class="tier__disc"><b class="sticker">' + d.badge + '</b> <span>' + keepHyphen(d.text) + '</span></p>' : '') +
        '<button class="btn tier__go" type="button" data-tier="' + c.id + '">' + t('ui.tiers.go') + '</button>' +
        '</li>';
    }).join('') +
      '<li class="tier tier--cash"><p class="tier__big"><b class="sticker sticker--big">\u2212' + D.discounts.cash + '%</b></p>' +
      '<p class="tier__cash">' + t('ui.tiers.cash') + '</p><p class="tier__sum">' + t('ui.tiers.sum') + '</p></li>');

    renderServices(cur);

    $all('[data-currency]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.currency === cur)); });
  }

  function renderEstimate() {
    if (!$('#calcTotal')) return; // калькулятор только на главной
    var e = estimate(state);
    var cur = e.currency;
    var level = e.complexity.level || t('js.level', { name: e.complexity.name });
    $('#calcTotal').textContent = from(money(e.total, cur));
    var line = $('#calcDiscLine'), may = maxDiscount(e.complexity.id);
    line.classList.toggle('is-may', !e.pct && !!may);
    if (e.pct) line.textContent = t('js.discLine', { pct: e.pct, list: discText(e), gross: from(money(e.gross, cur)).replace(/ /g, ' ') });
    else line.innerHTML = may ? t('js.discMay', { pct: may }) : '';
    renderDisc(e.complexity.id);
    $('#calcTerm').textContent = t('js.term', { t: e.complexity.term });
    $('#calcLines').textContent = t('js.lines', { base: money(e.base, cur), ku: fmtK(e.users.k), kd: fmtK(e.data.k) });
    $('#calcWhat').textContent = t('js.what', { level: level, what: lowerFirst(e.complexity.what), examples: lowerFirst(e.complexity.examples) });
    $('#calcHint').textContent = e.individual ? t('js.individual') : '';

    $('#briefEstimate').innerHTML = t('js.briefEst', {
      total: esc(from(money(e.total, cur))), term: esc(e.complexity.term),
      level: esc(level), users: esc(e.users.range), ops: esc(e.data.ops),
    });
  }
  // Сколько можно сэкономить на этом уровне, если выбрать все условия
  function maxDiscount(level) {
    var S = D.discounts, top = 0;
    if (level === 'task') top = S.loyalty[S.loyalty.length - 1].pct;
    else if (level === 'simple' || level === 'medium') top = S.prepay[S.prepay.length - 1].pct;
    else if (level === 'complex') top = S.full;
    else return 0;
    return top + S.cash;
  }
  function saveCalc() { setFresh('calc', state); }

  // Скидки под выбранную сложность: варианты кнопками, наличные отдельной галочкой.
  var BOX = '<span class="chip__box" aria-hidden="true">' + '<svg viewBox="0 0 16 16" focusable="false"><path d="M3.5 8.5 6.5 11.5 12.5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' + '</span>';
  function renderDisc(level) {
    var box = $('#calcDisc');
    if (!box) return;
    var S = D.discounts;
    function off(pct) { return pct ? ' <b>\u2212' + pct + '%</b>' : ''; }
    function row(key, q, opts) {
      return '<span class="disc__q" id="discQ-' + key + '">' + t(q) + '</span>' +
        '<span class="chips" role="radiogroup" aria-labelledby="discQ-' + key + '">' +
        opts.map(function (o) {
          return '<button type="button" class="chip" role="radio" data-disc="' + key + '" data-v="' + o.v + '" aria-checked="' + (state[key] === o.v) + '">' + o.text + off(o.pct) + '</button>';
        }).join('') + '</span>';
    }
    var html = '<div class="disc__row"><span class="disc__h">' + t('ui.disc.h') + '</span>';
    if (level === 'task') {
      var names = t('ui.disc.orders');
      html += row('order', 'ui.disc.order', S.loyalty.map(function (x, i) { return { v: x.id, text: names[i], pct: x.pct }; }));
    } else if (level === 'simple' || level === 'medium') {
      html += row('prepay', 'ui.disc.prepay', S.prepay.map(function (x) { return { v: x.id, text: x.share + '%', pct: x.pct }; }));
    } else if (level === 'complex') {
      html += row('full', 'ui.disc.pay', [{ v: 'stages', text: t('ui.disc.stages') }, { v: 'full', text: t('ui.disc.full'), pct: S.full }]);
    } else {
      html += '<span class="disc__note">' + t('ui.disc.ent') + '</span>';
    }
    html += '<button type="button" class="chip chip--check" role="checkbox" data-disc="cash" aria-checked="' + state.cash + '">' + BOX + t('ui.disc.cash') + off(S.cash) + '</button></div>';
    box.innerHTML = html;
  }

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
        var txt = sel.options[sel.selectedIndex].text.replace(/(\d) (?=\d)/g, '$1 ').replace(/(^|\s)(\S{1,3}) /g, '$1$2 ');
        if (txt.length <= 16) txt = txt.replace(/ /g, ' '); // короткое значение («от 51 до 1 000») целиком на одной строке
        txt = keepHyphen(txt);
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
    // под шторкой страница не прокручивается, иначе палец листает сайт вместо списка
    document.documentElement.classList.toggle('is-locked', sheetQuery.matches);
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
    document.documentElement.classList.remove('is-locked');
    if (refocus) p.box.focus({ preventScroll: true });
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
    var disc = $('#calcDisc');
    if (disc) disc.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-disc]');
      if (!b) return;
      var key = b.dataset.disc;
      if (key === 'cash') state.cash = !state.cash; else state[key] = b.dataset.v;
      renderEstimate();
      saveCalc();
      // кнопки нарисованы заново: возвращаем фокус на ту же
      var sel = '[data-disc="' + key + '"]' + (key === 'cash' ? '' : '[data-v="' + b.dataset.v + '"]');
      var again = $(sel, disc);
      if (again) again.focus();
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
    $all('.svc-area').forEach(wireCarouselIn);
  }
  function wireCarouselIn(area) {
    var track = $('.svc-track', area);
    if (!track || track._wired) return;
    track._wired = true;
    var slides = $all('.svc-slide', track);
    var tabs = $all('.svc-steps [role="tab"]', area);
    var fills = tabs.map(function (tab) { return $('.svc-steps__bar i', tab); });
    var arrows = $all('.svc-arrow', area);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DUR = 8000, HOLD = 12000;
    var auto = !reduce, cur = 0, elapsed = 0, last = 0, raf = 0, holdUntil = 0;
    var seen = !('IntersectionObserver' in window), hover = false, focused = false, scrollTimer;

    function paint() {
      fills.forEach(function (f, j) {
        var k = j < cur ? 1 : j > cur ? 0 : auto ? Math.min(1, elapsed / DUR) : 1;
        f.style.transform = 'scaleX(' + k.toFixed(4) + ')';
      });
    }
    // высота ленты по текущему слайду: короткий слайд не тянет за собой пустоту от самого длинного
    function fit() {
      var h = slides[cur] && slides[cur].offsetHeight;
      if (h) track.style.height = h + 'px';
    }
    // вкладка выбранного слайда видна, если полоска вкладок прокручивается вбок
    function reveal(tab) {
      var strip = tab && tab.parentNode;
      if (!strip || strip.scrollWidth <= strip.clientWidth + 1) return;
      var sr = strip.getBoundingClientRect(), tr = tab.getBoundingClientRect();
      if (tr.left < sr.left + 16 || tr.right > sr.right - 16) {
        strip.scrollTo({ left: strip.scrollLeft + tr.left - sr.left - 16, behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    function mark(i, later) {
      cur = i; elapsed = 0;
      tabs.forEach(function (tab, j) {
        tab.setAttribute('aria-selected', String(j === i));
        tab.tabIndex = j === i ? 0 : -1;
      });
      // во время плавной прокрутки высоту не трогаем: смена размера ленты обрывает прокрутку,
      // подгоняем, когда лента остановится (обработчик scroll ниже)
      if (!later) fit();
      reveal(tabs[i]);
      paint();
    }
    function go(i, instant) {
      i = (i + slides.length) % slides.length;
      var smooth = !instant && !reduce && i !== cur;
      track.scrollTo({ left: slides[i].offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
      mark(i, smooth);
      if (smooth) fitWhenStill(0);
    }
    // запасной путь, если события scroll не придут: ждём, пока лента доедет до слайда
    var stillTimer;
    function fitWhenStill(tries) {
      clearTimeout(stillTimer);
      stillTimer = setTimeout(function () {
        if (Math.abs(track.scrollLeft - slides[cur].offsetLeft) < 2 || tries >= 10) fit(); else fitWhenStill(tries + 1);
      }, 250);
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
        if (i !== cur && slides[i]) mark(i); else fit();
      }, 90);
    }, { passive: true });
    area.addEventListener('touchstart', hold, { passive: true });
    track.addEventListener('wheel', function (ev) { if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) hold(); }, { passive: true });
    // пауза, пока читают слайд или ходят по нему с клавиатуры; клик мышью по заголовку показ не останавливает
    track.addEventListener('mouseenter', function () { hover = true; });
    track.addEventListener('mouseleave', function () { hover = false; });
    area.addEventListener('focusin', function (ev) {
      try { focused = ev.target.matches(':focus-visible'); } catch (e) { focused = false; }
    });
    area.addEventListener('focusout', function (ev) { focused = area.contains(ev.relatedTarget); });
    if (!seen) {
      new IntersectionObserver(function (entries) {
        seen = entries[0].isIntersecting;
        run();
      }, { threshold: 0.35 }).observe(area);
    }
    window.addEventListener('resize', function () { track.scrollTo({ left: slides[cur].offsetLeft }); fit(); });
    // текст слайда меняет высоту: шрифты догрузились, сменили валюту или язык
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(fit);
      slides.forEach(function (s) { ro.observe(s); });
    }
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
    // На телефоне кнопка висит над контентом, поэтому показываем её, только когда листают вверх:
    // вверх больше чем на 40px подряд показывает, вниз больше чем на 12px прячет.
    var phone = window.matchMedia ? window.matchMedia('(max-width: 860px)') : { matches: false };
    var lastY = window.scrollY, upRun = 0, downRun = 0, wantUp = false;
    function check() {
      var y = window.scrollY, dy = y - lastY;
      lastY = y;
      if (dy < 0) { upRun -= dy; downRun = 0; if (upRun > 40) wantUp = true; }
      else if (dy > 0) { downRun += dy; upRun = 0; if (downRun > 12) wantUp = false; }
      var far = y > window.innerHeight * 1.2;
      var show = far && (!phone.matches || wantUp);
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

  // Таблицы коэффициентов на телефоне свёрнуты: калькулятор их уже применяет, а раздел цен и так длинный.
  // Без скрипта и на широком экране они открыты.
  function wireFolds() {
    if (!window.matchMedia || !window.matchMedia('(max-width: 640px)').matches) return;
    $all('details.fold').forEach(function (d) { d.open = false; });
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
      targets = links.filter(function (a) { return isHash(a) && !a.classList.contains('nav__cta'); }).map(function (a) { return { link: a, el: $(a.getAttribute('href')) }; }).filter(function (x) { return x.el; });
    }
    scan();
    var current = null, lockUntil = 0, moveTimer;
    // «Заказать» в нижнем меню: самолётик улетает и прилетает обратно
    var cta = $('.nav__cta', nav);
    if (cta) cta.addEventListener('click', function () { cta.classList.remove('is-fly'); void cta.offsetWidth; cta.classList.add('is-fly'); });

    function place(link, instant) {
      links.forEach(function (a) {
        a.classList.toggle('is-active', a === link);
        if (a === link) a.setAttribute('aria-current', a === here ? 'page' : 'location'); else a.removeAttribute('aria-current');
      });
      if (!link || link.classList.contains('nav__cta')) {
        drop.classList.remove('is-on');
        current = null;
        return;
      }
      var nr = nav.getBoundingClientRect(), r = link.getBoundingClientRect();
      // пункт скрыт (на телефоне в нижнем меню пять пунктов из семи): кружок не оставляем на старом месте
      if (!nr.width || !r.width) { drop.classList.remove('is-on'); current = link; return; }
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
      // на телефоне вокруг пункта заново рисуется чернильный кружок
      if (current !== link || instant) { drop.classList.remove('is-draw'); void drop.offsetWidth; drop.classList.add('is-draw'); }
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
      // скрытые пункты меню пропускаем: пока читают их раздел, подсвечен предыдущий видимый
      var live = targets.filter(function (x) { return getComputedStyle(x.el).position !== 'fixed' && x.link.getClientRects().length; })
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
      var to = $(a.getAttribute('href'));
      if (to && getComputedStyle(to).position === 'fixed') {
        ev.preventDefault();
        to.classList.remove('is-flash');
        void to.offsetWidth;
        to.classList.add('is-flash');
        var first = $('a, button', to);
        if (first) first.focus({ preventScroll: true });
        return;
      }
      lockUntil = Date.now() + 900;
      place(a);
      settleLater(1200);
    });
    window.addEventListener('resize', function () { if (current) place(current, true); spy(); });
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
      ' (' + fmtK(u.k, 'ru') + ') | данные: ' + d.ops + ' оп/сутки (' + fmtK(d.k, 'ru') + ') | срок: ' + c.term +
      (e.pct ? ' | скидка ' + e.pct + '%: ' + discText(e, 'ru') + ', без скидки ' + money(e.gross, cur, 'ru') : '');
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


  // Карточка уровня: «Посчитать» ставит этот уровень в калькулятор и ведёт к нему.
  function wireTiers() {
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-tier]');
      if (!b) return;
      var sel = $('#calcForm select[name="complexity"]');
      if (!sel) return;
      sel.value = b.dataset.tier;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      $('#order').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  }

  // QR-код открывается окошком там, где нажали.
  // подпись кода для чтения с экрана и подсказка под кодом
  var QR_TEXT = { telegram: ['qrTg', 'qrHint'], whatsapp: ['qrWa', 'qrHint'], phone: ['qrPhone', 'qrHintPhone'], email: ['qrMail', 'qrHintMail'], github: ['qrGh', 'qrHintGh'] };
  function wireQr() {
    var pop = null, opener = null;
    function close(back) {
      if (!pop || pop.hidden) return;
      pop.classList.remove('is-on');
      pop.hidden = true;
      if (back && opener) opener.focus();
    }
    function open(b, ev) {
      var name = b.dataset.qrOpen, svg = window.TTX_QR && window.TTX_QR[name];
      if (!svg) return;
      if (!pop) {
        pop = document.createElement('div');
        pop.className = 'qrpop';
        pop.setAttribute('role', 'dialog');
        pop.hidden = true;
        document.body.appendChild(pop);
      }
      opener = b;
      pop.setAttribute('aria-label', b.dataset.qrName);
      pop.innerHTML = '<span class="qrpop__code" role="img" aria-label="' + esc(t('ui.contacts.' + (QR_TEXT[name] || QR_TEXT.telegram)[0])) + '">' + svg + '</span>' +
        '<p class="qrpop__name">' + esc(b.dataset.qrName) + '</p><p class="qrpop__hint">' + t('ui.contacts.' + (QR_TEXT[name] || QR_TEXT.telegram)[1]) + '</p>' +
        '<button class="qrpop__x" type="button" aria-label="' + esc(t('ui.contacts.qrClose')) + '">×</button>';
      pop.classList.remove('is-on');
      pop.style.visibility = 'hidden';
      pop.hidden = false;
      var r = b.getBoundingClientRect();
      var x = ev && ev.detail ? ev.clientX : r.left + r.width / 2;
      var y = ev && ev.detail ? ev.clientY : r.top + r.height / 2;
      var w = pop.offsetWidth, h = pop.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var left = Math.max(12, Math.min(x - w / 2, vw - w - 12));
      var top = y + 14 + h <= vh - 12 ? y + 14 : Math.max(12, y - h - 14);
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
      pop.style.transformOrigin = (x - left) + 'px ' + (y - top) + 'px';
      pop.style.visibility = '';
      void pop.offsetWidth;
      pop.classList.add('is-on');
      $('.qrpop__x', pop).focus({ preventScroll: true });
    }
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-qr-open]');
      if (b) { if (pop && !pop.hidden && opener === b) close(); else open(b, ev); return; }
      if (!pop || pop.hidden) return;
      if (ev.target.closest('.qrpop__x')) { close(true); return; }
      if (!pop.contains(ev.target)) close();
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(true); });
    window.addEventListener('resize', function () { close(); });
    window.addEventListener('scroll', function () { close(); }, { passive: true });
  }

  // Вопросительный знак чернилами у заголовков: дописывается, когда заголовок появился на экране.
  function wireQuestionMarks() {
    var hs = $all('h2.q');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) { hs.forEach(function (h) { h.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.9, rootMargin: '0px 0px -12% 0px' });
    hs.forEach(function (h) { io.observe(h); });
  }

  /*
   * «Как мы работаем»: этапы стоят на извилистой тропинке, по ней идёт человечек.
   * Он держится на уровне 60% высоты экрана: в начале уставший и сутулый, к концу бодрый, на финише радуется.
   */
  function wireRoad() {
    var road = $('.road');
    var list = road && $('.road__steps', road);
    if (!list) return;
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'road__svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.innerHTML =
      '<path class="road__bed"/><path class="road__line"/><path class="road__ink"/>' +
      '<g class="road__flag"><path d="M0 0V-34"/><path class="road__cloth" d="M0-34c6 2 11-3 18 0v11c-7-3-12 2-18 0z"/></g>' +
      '<g class="walker"><g class="walker__flip"><path class="walker__body"/><circle class="walker__head" r="5.6"/>' +
      '<path class="walker__sweat" d="M0 0c-1.6 2.4-2.6 4-2.6 5.3a2.6 2.6 0 0 0 5.2 0C2.6 4 1.6 2.4 0 0z"/>' +
      '<path class="walker__joy" d=""/><circle class="walker__eye" r="1.1"/><path class="walker__mouth"/></g></g>';
    road.insertBefore(svg, road.firstChild);
    // человечек на своём слое поверх кружков этапов, тропинка под ними
    var top = document.createElementNS(NS, 'svg');
    top.setAttribute('class', 'road__svg road__svg--top');
    top.setAttribute('aria-hidden', 'true');
    top.setAttribute('focusable', 'false');
    top.appendChild($('.walker', svg));
    road.appendChild(top);
    var bed = $('.road__bed', svg), line = $('.road__line', svg), ink = $('.road__ink', svg);
    var flag = $('.road__flag', svg), walker = $('.walker', top), flip = $('.walker__flip', top);
    var body = $('.walker__body', top), head = $('.walker__head', top), sweat = $('.walker__sweat', top), joy = $('.walker__joy', top);
    var eye = $('.walker__eye', top), mouthEl = $('.walker__mouth', top);
    var items = $all('li', list);
    items.forEach(function (li, i) { var d = $('.road__dot', li); if (d) d.textContent = String(i + 1); });

    var L = 0, samples = [], dotLen = [], dir = 1, raf = 0, scale = 1;
    function rad(d) { return d * Math.PI / 180; }
    function mix(a, b, k) { return a + (b - a) * k; }
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
    function smooth(a, b, x) { var k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); }
    function f(n) { return n.toFixed(1); }

    function layout() {
      var rr = road.getBoundingClientRect();
      if (!rr.width) return;
      var cx = rr.width / 2, narrow = rr.width < 700;
      var pts = items.map(function (li) {
        var d = $('.road__dot', li).getBoundingClientRect();
        return { x: d.left + d.width / 2 - rr.left, y: d.top + d.height / 2 - rr.top };
      });
      if (!pts.length) return;
      var first = pts[0], last = pts[pts.length - 1];
      var start = { x: first.x, y: first.y - 46 }, end = { x: narrow ? last.x : cx, y: last.y + 76 };
      // на узком экране текст последнего этапа длиннее, флажок ставим под ним, а не поверх
      if (narrow) end.y = Math.max(end.y, items[items.length - 1].getBoundingClientRect().bottom - rr.top + 44);
      var all = [start].concat(pts, [end]);
      var dd = 'M' + f(start.x) + ' ' + f(start.y), prefixes = [];
      for (var i = 1; i < all.length; i++) {
        var a = all[i - 1], b = all[i], dy = b.y - a.y;
        // на широком экране тропинка выгибается наружу у каждого этапа, на узком петляет у левого края
        var wa = narrow ? (i % 2 ? 18 : -18) : (a.x - cx) * 1.05;
        var wb = narrow ? (i % 2 ? -18 : 18) : (b.x - cx) * 1.05;
        if (i === 1) wa = wb = 0; // к первому этапу тропинка подходит прямо сверху
        dd += ' C' + f(a.x + wa) + ' ' + f(a.y + dy * 0.5) + ' ' + f(b.x + wb) + ' ' + f(b.y - dy * 0.5) + ' ' + f(b.x) + ' ' + f(b.y);
        prefixes.push(dd);
      }
      [bed, line, ink].forEach(function (p) { p.setAttribute('d', dd); });
      L = ink.getTotalLength();
      // длина пути до каждого кружка: кружок «пройден», когда человечек до него дошёл
      var probe = document.createElementNS(NS, 'path');
      svg.appendChild(probe);
      dotLen = pts.map(function (p, j) { probe.setAttribute('d', prefixes[j]); return probe.getTotalLength(); });
      svg.removeChild(probe);
      samples = [];
      for (var k = 0; k <= 300; k++) { var q = ink.getPointAtLength(L * k / 300); samples.push({ s: L * k / 300, x: q.x, y: q.y }); }
      ink.style.strokeDasharray = f(L) + ' ' + f(L + 10);
      flag.setAttribute('transform', 'translate(' + f(end.x + 34) + ' ' + f(end.y + 2) + ')');
      scale = narrow ? 1.1 : 1.45;
      if (pos < 0) pos = target();
      pos = clamp(pos, 0, L);
      draw(0);
      wake();
    }

    // точка тропинки на нужном расстоянии от начала
    function atLen(len) {
      var u = clamp(len / (L || 1), 0, 1) * (samples.length - 1), i = Math.min(samples.length - 2, Math.floor(u)), k = u - i;
      var a = samples[i], b = samples[i + 1];
      return { x: mix(a.x, b.x, k), y: mix(a.y, b.y, k), tx: b.x - a.x };
    }
    // точка тропинки на нужной высоте: тропинка идёт только вниз, поэтому ищем по y
    function at(targetY) {
      if (!samples.length) return null;
      if (targetY <= samples[0].y) return { s: 0, x: samples[0].x, y: samples[0].y, i: 1 };
      for (var i = 1; i < samples.length; i++) {
        if (samples[i].y >= targetY) {
          var a = samples[i - 1], b = samples[i], k = (targetY - a.y) / Math.max(0.001, b.y - a.y);
          return { s: mix(a.s, b.s, k), x: mix(a.x, b.x, k), y: targetY, i: i };
        }
      }
      var z = samples[samples.length - 1];
      return { s: z.s, x: z.x, y: z.y, i: samples.length - 1 };
    }

    /*
     * Человечек не приклеен к прокрутке: он догоняет свою точку на тропинке шагом или бегом,
     * а стоя дышит и чем-нибудь занят. Чем дальше по тропинке, тем он бодрее.
     */
    var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
    var pos = -1, vel = 0, ph = 0, face = 1, faceSm = 1, clock = 0, lastT = 0, live = false, still = 0;
    var act = '', actT = 0, actLen = 0, nextAct = 2.5, gaitSm = 0, blink = 0, nextBlink = 2;
    var cur = null;
    var ACTS_TIRED = ['pant', 'wipe', 'pant'], ACTS_MID = ['look', 'stretch', 'wave', 'wipe'], ACTS_FRESH = ['tap', 'wave', 'stretch', 'look'];

    function target() {
      var rr = road.getBoundingClientRect(), q = at(window.innerHeight * 0.6 - rr.top);
      return q ? q.s : 0;
    }
    function P(x, y) { return { x: x, y: y }; }
    function lerpP(a, b, k) { return P(mix(a.x, b.x, k), mix(a.y, b.y, k)); }
    function seg(a, b) { return 'M' + f(a.x) + ' ' + f(a.y) + 'L' + f(b.x) + ' ' + f(b.y); }
    // рука в два сустава до точки: локоть отводим назад и вниз, как у человека
    function reach(sh, hand, l1, l2) {
      var dx = hand.x - sh.x, dy = hand.y - sh.y, d = Math.hypot(dx, dy);
      var max = l1 + l2 - 0.05;
      if (d > max) { hand = P(sh.x + dx / d * max, sh.y + dy / d * max); d = max; }
      d = Math.max(d, 0.01);
      var cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), A = Math.acos(cosA), base = Math.atan2(dy, dx);
      var e1 = P(sh.x + Math.cos(base + A) * l1, sh.y + Math.sin(base + A) * l1);
      var e2 = P(sh.x + Math.cos(base - A) * l1, sh.y + Math.sin(base - A) * l1);
      var el = (e1.x - e2.x) * 2 + (e2.y - e1.y) < 0 ? e1 : e2; // локоть сзади и ниже
      return seg(sh, el) + 'L' + f(hand.x) + ' ' + f(hand.y);
    }
    function legPts(hip, a, bend) {
      var kn = P(hip.x + Math.sin(a) * 13, hip.y + Math.cos(a) * 13);
      return { kn: kn, ft: P(kn.x + Math.sin(a - bend) * 13, kn.y + Math.cos(a - bend) * 13) };
    }

    // поза: e от 0 (устал) до 1 (бодр); gait 0 стоит, 1 идёт; run 0..1 бежит; w вес занятия на месте
    function pose(e, gait, run, w) {
      var t = clock, cheer = smooth(0.982, 0.992, e), tired = 1 - smooth(0.2, 0.6, e);
      var breathe = Math.sin(t * mix(2.2, 5.5, tired)) * mix(0.5, 1.3, tired) * (1 - gait);
      var lean = rad(mix(mix(14, 0, e), mix(26, -3, e) + run * 14, gait));
      var legA = [0, 0], bend = [0, 0];
      for (var k = 0; k < 2; k++) {
        var p = ph + k * Math.PI;
        var walkA = Math.sin(p) * rad(mix(15, 30, e) + run * 14);
        var walkB = Math.max(0, Math.sin(p + Math.PI / 2)) * rad(mix(18, 50, e) + run * 40);
        legA[k] = mix(rad(k ? 5 : -4), walkA, gait);
        bend[k] = mix(rad(3), walkB, gait);
      }
      var arms = null, hop = 0, mouth = cheer > 0.5 ? 'smile' : '';
      // занятия на месте
      if (w > 0.01) {
        var u = actT, wv = w;
        if (act === 'pant') {
          lean = mix(lean, rad(48), wv);
          legA[0] = mix(legA[0], rad(22), wv); bend[0] = mix(bend[0], rad(44), wv);
          legA[1] = mix(legA[1], rad(14), wv); bend[1] = mix(bend[1], rad(36), wv);
          breathe = Math.sin(t * 7) * 1.6 * wv + breathe * (1 - wv);
          arms = 'knees'; mouth = 'o';
        } else if (act === 'wipe') {
          lean = mix(lean, rad(6), wv); arms = 'wipe';
        } else if (act === 'look') {
          lean = mix(lean, rad(-2), wv); arms = 'hips';
        } else if (act === 'stretch') {
          var st = Math.sin(clamp(u / actLen, 0, 1) * Math.PI);
          lean = mix(lean, rad(-10) * st, wv); arms = 'up'; hop = -1.5 * st * wv;
        } else if (act === 'tap') {
          legA[0] = mix(legA[0], rad(18), wv);
          bend[0] = mix(bend[0], rad(18 + 14 * Math.max(0, Math.sin(t * 13))), wv);
          arms = 'hips';
        } else if (act === 'wave') {
          arms = 'wave'; mouth = 'smile';
        }
      }
      // на финише подпрыгивает с поднятыми руками
      if (cheer > 0.05 && gait < 0.5) {
        var c = t % 2.2;
        hop = c < 0.9 ? -10 * Math.abs(Math.sin(c / 0.45 * Math.PI)) * cheer : 0;
        if (hop < -1) { legA[0] = rad(-10); legA[1] = rad(12); bend[0] = bend[1] = rad(30); }
      }
      // бедро на такой высоте, чтобы нижняя ступня стояла на тропинке
      var reachY = 0;
      for (k = 0; k < 2; k++) reachY = Math.max(reachY, 13 * Math.cos(legA[k]) + 13 * Math.cos(legA[k] - bend[k]));
      var stepBob = gait * Math.abs(Math.sin(ph)) * mix(0.6, 3.2, e);
      var hip = P(0, -reachY - stepBob + hop);
      var spine = 18 + breathe * 0.35;
      var sh = P(hip.x + Math.sin(lean) * spine, hip.y - Math.cos(lean) * spine);
      var headLean = lean + rad(mix(34, -4, e)) * gait + (act === 'pant' ? rad(-20) * w : 0);
      var hd = P(sh.x + Math.sin(headLean) * 8.4, sh.y - Math.cos(headLean) * 8.4 + breathe * 0.2);
      var d = seg(hip, sh);
      var legs = [legPts(hip, legA[0], bend[0]), legPts(hip, legA[1], bend[1])];
      legs.forEach(function (lg) { d += seg(hip, lg.kn) + 'L' + f(lg.ft.x) + ' ' + f(lg.ft.y); });
      // руки: при ходьбе машут, стоя висят, в занятии тянутся к нужной точке
      for (k = 0; k < 2; k++) {
        var p2 = ph + k * Math.PI;
        var A = (-Math.sin(p2) * rad(mix(6, 42, e) + run * 20)) * gait + lean * 0.4 + rad(mix(22, 0, e)) * gait + rad(k ? 6 : -4) * (1 - gait);
        var el = P(sh.x + Math.sin(A) * 11, sh.y + Math.cos(A) * 11);
        var F = A + (rad(mix(4, 62, e) + run * 50) * gait + rad(8) * (1 - gait));
        var hand = P(el.x + Math.sin(F) * 10, el.y + Math.cos(F) * 10);
        var goal = null;
        if (cheer > 0.05) goal = P(sh.x + (k ? 11 : -8), sh.y - 24);
        if (arms === 'knees') goal = P(legs[k].kn.x + 2, legs[k].kn.y - 1);
        else if (arms === 'hips') goal = P(hip.x + (k ? 3.5 : 2), hip.y - 2);
        else if (arms === 'up') goal = P(sh.x + (k ? 3 : -2), sh.y - 20);
        else if (arms === 'wipe' && k === 0) goal = P(hd.x + 1 + 4 * Math.sin(clock * 5), hd.y - 3);
        else if (arms === 'wave' && k === 0) goal = P(sh.x + 8 + 4 * Math.sin(clock * 11), sh.y - 16 + 2 * Math.cos(clock * 11));
        var gw = cheer > 0.05 && !arms ? cheer * (1 - gait) : w;
        d += goal ? reach(sh, lerpP(hand, goal, gw), 11, 10) : seg(sh, el) + 'L' + f(hand.x) + ' ' + f(hand.y);
      }
      return { d: d, head: hd, cheer: cheer, mouth: mouth, lean: headLean };
    }

    function pickAct(e) {
      var list = e < 0.35 ? ACTS_TIRED : e < 0.75 ? ACTS_MID : ACTS_FRESH;
      var a = list[Math.floor(Math.random() * list.length)];
      if (a === act) a = list[(list.indexOf(a) + 1) % list.length];
      return a;
    }

    function draw(dt) {
      if (!samples.length) return;
      var e = clamp(pos / L, 0, 1);
      var speed = Math.abs(vel);
      var gait = smooth(4, 45, speed), run = smooth(260, 650, speed);
      gaitSm += (gait - gaitSm) * Math.min(1, dt * 8);
      ph += speed * dt / (7.5 * (1 + run * 0.4));
      // стоит: через пару секунд чем-нибудь займётся
      if (gaitSm < 0.15) still += dt; else { still = 0; act = ''; }
      if (!act && still > nextAct && e < 0.98) { act = pickAct(e); actT = 0; actLen = act === 'pant' ? 3.2 : act === 'tap' ? 2.6 : 2.2; }
      var w = 0;
      if (act) {
        actT += dt;
        w = smooth(0, 0.35, actT) * (1 - smooth(actLen - 0.35, actLen, actT)) * (1 - gaitSm);
        if (actT >= actLen) { act = ''; still = 0; nextAct = 2 + Math.random() * 3.5; }
      }
      var q = atLen(pos);
      // смотрит туда, куда идёт; оглядываясь, поворачивается назад
      if (speed > 6 && Math.abs(q.tx) > 0.2) face = (q.tx > 0) === (vel > 0) ? 1 : -1;
      var want = face * (act === 'look' && actT > 0.4 && actT < actLen - 0.5 ? -1 : 1);
      faceSm += (want - faceSm) * Math.min(1, dt * 9);
      var fx = Math.abs(faceSm) < 0.2 ? (faceSm < 0 ? -0.2 : 0.2) : faceSm;
      var ps = pose(e, gaitSm, run, w);
      cur = ps;
      walker.setAttribute('transform', 'translate(' + f(q.x) + ' ' + f(q.y) + ') scale(' + scale + ')');
      flip.setAttribute('transform', 'scale(' + fx.toFixed(2) + ' 1)');
      body.setAttribute('d', ps.d);
      var hx = ps.head.x, hy = ps.head.y;
      head.setAttribute('cx', f(hx)); head.setAttribute('cy', f(hy));
      // глаз и рот смотрят вперёд, глаз иногда моргает
      if (clock > nextBlink) { blink = 0.12; nextBlink = clock + 2 + Math.random() * 3; }
      blink = Math.max(0, blink - dt);
      var ex = hx + 2.4 * Math.cos(ps.lean - 0.25), ey = hy - 0.9 + 2.4 * Math.sin(ps.lean - 0.25);
      eye.setAttribute('cx', f(ex)); eye.setAttribute('cy', f(ey));
      eye.setAttribute('r', blink > 0 ? '0.25' : '1.1');
      mouthEl.setAttribute('d', ps.mouth === 'smile' ? 'M' + f(hx + 0.6) + ' ' + f(hy + 2) + 'q1.6 1.4 3.2 -.2'
        : ps.mouth === 'o' ? 'M' + f(hx + 2.6) + ' ' + f(hy + 2.6) + 'a.9 .9 0 1 0 .01 0' : '');
      // капля пота, пока устал; лучики радости на финише
      sweat.setAttribute('transform', 'translate(' + f(hx - 9) + ' ' + f(hy - 3) + ')');
      sweat.style.opacity = ((1 - smooth(0.15, 0.45, e)) * (act === 'pant' ? 1 : 0.85)).toFixed(2);
      var jc = ps.cheer * (1 - gaitSm);
      joy.setAttribute('d', jc > 0.05 ? 'M' + f(hx - 12) + ' ' + f(hy - 12) + 'l-5-5M' + f(hx) + ' ' + f(hy - 15) + 'v-7M' + f(hx + 12) + ' ' + f(hy - 12) + 'l5-5' : 'M0 0');
      joy.style.opacity = jc.toFixed(2);
      ink.style.strokeDashoffset = f(L - pos);
      items.forEach(function (li, i) { li.classList.toggle('is-passed', dotLen[i] <= pos + 2); });
      road.classList.toggle('is-done', e > 0.985);
    }

    function frame(now) {
      raf = 0;
      if (!samples.length) return;
      var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
      lastT = now; clock += dt;
      var goal = target();
      if (calm && calm.matches) { pos = goal; vel = 0; draw(dt); return; }
      // догоняет свою точку: пружина с трением, без рывков и проскоков
      vel += (26 * (goal - pos) - 10 * vel) * dt;
      vel = clamp(vel, -900, 900);
      pos = clamp(pos + vel * dt, 0, L);
      draw(dt);
      if (live) raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf) { lastT = 0; raf = requestAnimationFrame(frame); } }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { live = en[0].isIntersecting; if (live) wake(); }, { rootMargin: '120px 0px' }).observe(road);
    } else live = true;
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', layout);
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(list);
    onFontsChange(layout);
    layout();
  }




  /*
   * Контакты: два человечка сидят на линии над первой строкой. Левый показывает на кнопку
   * «скопировать», правый на QR-код. Рисунок ставится по месту кнопок и пересчитывается при ресайзе.
   */
  var BUDDY_W = 176, BUDDY_LINE = 64, BUDDY_AIM = 6, BUDDY_K = 1.2;
  // у каждого свой вид: левый в кепке и очках, правый с пучком и телефоном в руке
  function buddySvg(text, flip) {
    var look = flip
      ? '<circle class="buddy__solid" cx="74" cy="18.5" r="3.4"/>' +
        '<path d="M60.5 21.5C63 18.5 67 17.8 70.5 19.6"/>' +
        '<path d="M68.5 40C72 44 75.5 46 79 46.5"/>' +
        '<g class="buddy__phone"><rect x="78" y="38.5" width="6" height="10" rx="1.4"/><path d="M80 46.3h2"/></g>'
      : '<path class="buddy__solid" d="M59.6 23.5a7.5 7.5 0 0 1 14.8 0z"/><path d="M60.5 23.4 52.5 24.6"/>' +
        '<circle cx="62.6" cy="26.6" r="2.3"/><circle cx="68.6" cy="26.6" r="2.3"/><path d="M64.9 26.6h1.4"/>' +
        '<path d="M68.5 40 80.5 62.5"/>';
    var body =
      '<circle cx="67" cy="25" r="7.5"/>' + look +
      '<path d="M67.5 32.5C68 43 69 53 70.5 63"/>' +
      (flip
        ? '<path d="M70.5 63C64 57 57 56.5 50 60.5"/><path d="M70.5 63C63 61.5 58 63 52 61"/>'
        : '<path d="M70.5 63 56 48 49 63.5"/><path d="M70.5 63 61.5 53.5 56 63.5"/>') +
      '<g class="buddy__arm"><path d="M68.5 40 35 54"/>' +
      '<path class="buddy__arrow" d="M31 58C26 64 20 70 14 77"/><path class="buddy__tip" d="M15.1 71.1 14 77l5.7-2"/></g>';
    var g = flip ? '<g transform="translate(' + BUDDY_W + ' 0) scale(-1 1)">' + body + '</g>' : '<g>' + body + '</g>';
    var tx = flip ? BUDDY_W - 80 : 80;
    return '<svg class="buddy" viewBox="0 0 ' + BUDDY_W + ' ' + BUDDY_LINE + '" width="' + BUDDY_W * BUDDY_K + '" height="' + BUDDY_LINE * BUDDY_K + '" aria-hidden="true" focusable="false">' +
      g + '<text class="buddy__say" x="' + tx + '" y="14"text-anchor="' + (flip ? 'end' : 'start') + '">' + esc(text) + '</text></svg>';
  }
  function wireBuddies() {
    var list = $('#contacts .contacts');
    if (!list) return;
    var box = list.parentNode;
    var copy = $('.copy', list), qrs = $all('.qrbtn', list), qr = qrs[Math.min(1, qrs.length - 1)];
    var items = [];
    if (copy) items.push({ btn: copy, flip: false, text: t('ui.contacts.buddyCopy') });
    if (qr) items.push({ btn: qr, flip: true, text: t('ui.contacts.buddyScan') });
    items.forEach(function (it) {
      box.insertAdjacentHTML('beforeend', buddySvg(it.text, it.flip));
      it.el = box.lastElementChild;
    });
    function place() {
      var r = box.getBoundingClientRect();
      items.forEach(function (it) {
        if (getComputedStyle(it.el).display === 'none') return;
        var b = it.btn.getBoundingClientRect(), li = it.btn.closest('li').getBoundingClientRect();
        var cx = b.left + b.width / 2 - r.left;
        it.el.style.left = (it.flip ? cx - (BUDDY_W - BUDDY_AIM) * BUDDY_K : cx - BUDDY_AIM * BUDDY_K) + 'px';
        it.el.style.top = (li.top - r.top - BUDDY_LINE * BUDDY_K + 1) + 'px';
      });
    }
    window.addEventListener('resize', place);
    onFontsChange(place);
    place();
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
  wireFolds();
  wireCopy();
  wireNavDrop();
  wirePdf();
  wireTiers();
  wireQr();
  wireBuddies();
  wireQuestionMarks();
  wireRoad();

  // Таблицы и карусели дорисованы скриптом, поэтому к разделу из адреса (#pricing) прокручиваем сами.
  if (location.hash.length > 1) {
    var landing = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (landing) setTimeout(function () { window.scrollTo({ top: landing.getBoundingClientRect().top + window.scrollY, behavior: 'instant' }); }, 0);
  }
})();
