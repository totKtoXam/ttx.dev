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
  };

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
  var saved = store.get('calc') || {};
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
    render('pains', D.pains.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join(''));
    render('services', defs(D.services));
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
      return '<li><span>' + esc(c.label) + '</span><a href="' + esc(c.href) + '"' + (c.external ? ' target="_blank" rel="noopener"' : '') + '>' + esc(c.value) + '</a></li>';
    }).join(''));

    $all('[data-owner]').forEach(function (el) { el.textContent = CFG.owner; });
    var tg = (CFG.contacts.telegram || '').replace(/^@/, '');
    $all('[data-tg]').forEach(function (el) {
      if (!tg) return;
      var a = el.querySelector('a');
      a.href = 'https://t.me/' + tg; a.textContent = '@' + tg;
      el.hidden = false;
    });
    $all('[data-max-mb]').forEach(function (el) { el.textContent = CFG.maxUploadMb; });
    $('#year').textContent = new Date().getFullYear();
  }

  function selOption(group, id, text) {
    return '<option value="' + id + '"' + (state[group] === id ? ' selected' : '') + '>' + esc(text) + '</option>';
  }

  function contactItems() {
    var c = CFG.contacts, out = [];
    if (c.telegram) out.push({ label: 'Telegram', value: '@' + c.telegram.replace(/^@/, ''), href: 'https://t.me/' + c.telegram.replace(/^@/, ''), external: true });
    if (c.whatsapp) out.push({ label: 'WhatsApp', value: '+' + c.whatsapp.replace(/\D/g, ''), href: 'https://wa.me/' + c.whatsapp.replace(/\D/g, ''), external: true });
    if (c.phone) out.push({ label: t('js.phone'), value: c.phone, href: 'tel:' + c.phone.replace(/[^\d+]/g, '') });
    if (c.github) out.push({ label: 'GitHub', value: c.github.replace(/^https?:\/\//, ''), href: c.github, external: true });
    if (c.linkedin) out.push({ label: 'LinkedIn', value: c.linkedin.replace(/^https?:\/\/(www\.)?/, ''), href: c.linkedin, external: true });
    out.push({ label: t('js.briefLabel'), value: t('js.briefValue'), href: '#brief' });
    return out;
  }
  window.TTX.contactItems = contactItems;

  /* ---------- currency-dependent renders ---------- */
  function renderPrices() {
    var cur = state.currency;
    render('price-complexity', thead(t('js.headComplexity')) + '<tbody>' +
      D.complexity.map(function (c) {
        return '<tr><td class="strong">' + esc(c.name) + '</td><td class="muted">' + esc(c.what) + '</td><td class="muted">' + esc(c.examples) + '</td><td class="num">' + esc(from(money(c[cur], cur))) + '</td><td class="num">' + esc(c.term) + '</td></tr>';
      }).join('') + '</tbody>');

    render('price-consult', thead(t('js.headConsult')) + '<tbody>' +
      D.consult.map(function (x) {
        return '<tr><td class="strong">' + esc(x.name) + '</td><td class="muted">' + esc(x.what) + '</td><td class="price">' + esc(x[cur]) + '</td></tr>';
      }).join('') + '</tbody>');

    render('price-extras', thead(t('js.headExtras')) + '<tbody>' +
      D.extras.map(function (x) {
        return '<tr><td class="strong">' + esc(x.name) + '</td><td class="muted">' + esc(x[cur]) + '</td></tr>';
      }).join('') + '</tbody>');

    $all('[data-currency]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.currency === cur)); });
  }

  function renderEstimate() {
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

    store.set('calc', state);
  }

  // Ширина выпадающего списка по выбранному тексту, чтобы фраза читалась как предложение.
  var measurer;
  function fitSelects() {
    if (!measurer) {
      measurer = document.createElement('span');
      measurer.setAttribute('aria-hidden', 'true');
      measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0';
      document.body.appendChild(measurer);
    }
    $all('.pick select').forEach(function (sel) {
      var cs = getComputedStyle(sel);
      measurer.style.fontFamily = cs.fontFamily;
      measurer.style.fontSize = cs.fontSize;
      measurer.style.fontWeight = cs.fontWeight;
      measurer.style.letterSpacing = cs.letterSpacing;
      measurer.textContent = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
      var pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      sel.style.width = Math.ceil(measurer.getBoundingClientRect().width + pad + 4) + 'px';
    });
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

  /* ---------- UI wiring ---------- */
  function wireCalc() {
    $('#calcForm').addEventListener('change', function (ev) {
      var el = ev.target;
      if (el && el.name && state.hasOwnProperty(el.name)) {
        state[el.name] = el.value;
        renderEstimate();
        fitSelects();
      }
    });
    onFontsChange(fitSelects);
    window.addEventListener('resize', fitSelects);
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-currency]');
      if (b) {
        state.currency = b.dataset.currency;
        renderPrices();
        renderEstimate();
      }
    });
  }

  function wireNav() {
    var nav = $('#nav'), btn = $('#navToggle');
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (ev) {
      if (ev.target.closest('a')) { nav.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
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
    var links = $all('a[href^="#"]', nav);
    var targets = links.map(function (a) { return { link: a, el: $(a.getAttribute('href')) }; }).filter(function (x) { return x.el; });
    var current = null, lockUntil = 0, moveTimer;

    function place(link, instant) {
      links.forEach(function (a) {
        a.classList.toggle('is-active', a === link);
        if (a === link) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
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
      if (Date.now() < lockUntil) return;
      var line = Math.min(window.innerHeight * 0.4, 360);
      var active = null;
      targets.forEach(function (x) { if (x.el.getBoundingClientRect().top <= line) active = x.link; });
      // в самом низу страницы активен последний пункт
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = targets[targets.length - 1].link;
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
    spy();
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
    var waiting = false;

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

    function setStatus(msg, kind) {
      status.textContent = msg;
      status.className = 'form__status' + (kind ? ' is-' + kind : '');
    }

    frame.addEventListener('load', function () {
      if (!waiting) return;
      waiting = false;
      busy(false);
      setStatus(t('js.sentStatus'), 'ok');
      toast(t('js.sentToast'));
      form.reset();
      showFile();
      $('#attachEstimate').checked = true;
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
        setTimeout(function () {
          if (!waiting) return;
          waiting = false;
          busy(false);
          setStatus(t('js.timeout'), 'error');
        }, 45000);
      });
    });
  }

  /* ---------- init ---------- */
  renderStatic();
  renderPrices();
  renderEstimate();
  fitSelects();
  wireCalc();
  wireNav();
  wireNavDrop();
  wirePdf();
  wireBrief();
})();
