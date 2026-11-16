(function () {
  'use strict';

  var CFG = window.TTX_CONFIG;
  var D = window.TTX_DATA;

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

  function fmtNum(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function money(n, cur) {
    return cur === 'usd' ? '$' + fmtNum(n) : fmtNum(n) + ' ₸';
  }
  // В шрифте PDF (Roboto) нет глифа ₸, поэтому в PDF пишем «тг».
  function moneyPdf(n, cur) {
    return cur === 'usd' ? '$' + fmtNum(n) : fmtNum(n) + ' тг';
  }
  function fmtK(k) { return '×' + String(k).replace('.', ','); }

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

  window.TTX = { money: money, moneyPdf: moneyPdf, fmtK: fmtK, fmtNum: fmtNum, estimate: estimate, byId: byId };

  /* ---------- state ---------- */
  var saved = store.get('calc') || {};
  var state = {
    complexity: saved.complexity || 'medium',
    users: saved.users || 'u1k',
    data: saved.data || 'dMid',
    currency: saved.currency === 'usd' ? 'usd' : 'kzt',
  };

  /* ---------- icons ---------- */
  var ICONS = {
    web: '<path d="M3 5h18v14H3zM3 9h18M7 7h.01M10 7h.01" />',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    bot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
    ai: '<path d="M12 3l1.8 4.9L19 9.5l-4.1 3.1L16.2 18 12 15l-4.2 3 1.3-5.4L5 9.5l5.2-1.6z"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8M14.7 6.3L11 3 3 11l3 3"/>',
    github: '<path fill="currentColor" stroke="none" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.82 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"/>',
    telegram: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4z M9 13l9-7"/>',
    tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1-1.2 1.8.8c-.2 1-1 1.6-2 1.6A6 6 0 0 1 8.4 9.2c0-1 .6-1.8 1.6-2l.8 1.8z"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7h.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
    form: '<path d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5"/>',
  };
  function icon(name, size) {
    size = size || 22;
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  /* ---------- static renders ---------- */
  function render(name, html) {
    $all('[data-render="' + name + '"]').forEach(function (el) { el.innerHTML = html; });
  }

  function renderStatic() {
    render('pains', D.pains.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join(''));

    render('services', D.services.map(function (s) {
      return '<article class="card"><div class="card__icon">' + icon(s.icon) + '</div><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></article>';
    }).join(''));

    render('projects', D.projects.map(function (p) {
      var links = '<a href="' + esc(p.repo) + '" target="_blank" rel="noopener">Код на GitHub →</a>';
      if (p.site) links += '<a href="' + esc(p.site) + '" target="_blank" rel="noopener">Сайт →</a>';
      return '<article class="card"><span class="project__kind">' + esc(p.kind) + '</span><h3 class="project__name">' + esc(p.name) + '</h3><p>' + esc(p.text) + '</p><ul class="tags">' +
        p.stack.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul><div class="project__links">' + links + '</div></article>';
    }).join(''));

    render('process', D.process.map(function (s) {
      return '<li><h3>' + esc(s.title) + '</h3><p>' + esc(s.text) + '</p></li>';
    }).join(''));

    render('why', D.why.map(function (w) {
      return '<article class="card card--why"><h3>' + esc(w.title) + '</h3><p>' + esc(w.text) + '</p></article>';
    }).join(''));

    render('payment', D.payment.map(function (p) {
      return '<li><strong>' + esc(p.title) + '</strong><span>' + esc(p.text) + '</span></li>';
    }).join(''));

    render('operation-note', esc(D.operationNote));

    render('price-users', '<thead><tr><th>Активных пользователей</th><th>Коэффициент</th><th>Что добавляется в работу</th></tr></thead><tbody>' +
      D.users.map(function (u) {
        return '<tr><td><strong>' + esc(u.range) + '</strong></td><td class="k">' + fmtK(u.k) + (u.plus ? ' и выше' : '') + '</td><td class="muted">' + esc(u.adds) + '</td></tr>';
      }).join('') + '</tbody>');

    render('price-data', '<thead><tr><th>Нагрузка</th><th>Операций в сутки</th><th>Пик, запросов/с</th><th>Коэффициент</th><th>Что добавляется в работу</th></tr></thead><tbody>' +
      D.data.map(function (d) {
        return '<tr><td><strong>' + esc(d.name) + '</strong></td><td class="price">' + esc(d.ops) + '</td><td class="price">' + esc(d.rps) + '</td><td class="k">' + fmtK(d.k) + (d.plus ? ' и выше' : '') + '</td><td class="muted">' + esc(d.adds) + '</td></tr>';
      }).join('') + '</tbody>');

    render('contacts', contactItems().map(function (c) {
      return '<li><a href="' + esc(c.href) + '"' + (c.external ? ' target="_blank" rel="noopener"' : '') + '><span class="contacts__icon">' + icon(c.icon) + '</span><span><small>' + esc(c.label) + '</small><strong>' + esc(c.value) + '</strong></span></a></li>';
    }).join(''));

    $all('[data-owner]').forEach(function (el) { el.textContent = CFG.owner; });
    $all('[data-max-mb]').forEach(function (el) { el.textContent = CFG.maxUploadMb; });
    $('#year').textContent = new Date().getFullYear();
  }

  function contactItems() {
    var c = CFG.contacts, out = [];
    if (c.telegram) out.push({ icon: 'telegram', label: 'Telegram', value: '@' + c.telegram.replace(/^@/, ''), href: 'https://t.me/' + c.telegram.replace(/^@/, ''), external: true });
    if (c.whatsapp) out.push({ icon: 'whatsapp', label: 'WhatsApp', value: '+' + c.whatsapp.replace(/\D/g, ''), href: 'https://wa.me/' + c.whatsapp.replace(/\D/g, ''), external: true });
    if (c.phone) out.push({ icon: 'tel', label: 'Телефон', value: c.phone, href: 'tel:' + c.phone.replace(/[^\d+]/g, '') });
    if (c.github) out.push({ icon: 'github', label: 'GitHub', value: c.github.replace(/^https?:\/\//, ''), href: c.github, external: true });
    if (c.linkedin) out.push({ icon: 'linkedin', label: 'LinkedIn', value: c.linkedin.replace(/^https?:\/\/(www\.)?/, ''), href: c.linkedin, external: true });
    out.push({ icon: 'form', label: 'Заявка с ТЗ', value: 'Форма на этой странице', href: '#brief' });
    return out;
  }
  window.TTX.contactItems = contactItems;

  /* ---------- currency-dependent renders ---------- */
  function renderPrices() {
    var cur = state.currency;
    render('price-complexity', '<thead><tr><th>Уровень</th><th>Что входит</th><th>Примеры</th><th>База</th><th>Срок</th></tr></thead><tbody>' +
      D.complexity.map(function (c) {
        return '<tr><td><strong>' + esc(c.name) + '</strong></td><td class="muted">' + esc(c.what) + '</td><td class="muted">' + esc(c.examples) + '</td><td class="price">от ' + money(c[cur], cur) + '</td><td class="price">' + esc(c.term) + '</td></tr>';
      }).join('') + '</tbody>');

    render('price-extras', '<thead><tr><th>Услуга</th><th>Стоимость</th></tr></thead><tbody>' +
      D.extras.map(function (x) {
        return '<tr><td><strong>' + esc(x.name) + '</strong></td><td class="muted">' + esc(x[cur]) + '</td></tr>';
      }).join('') + '</tbody>');

    render('calc-complexity', D.complexity.map(function (c) {
      return option('complexity', c.id, c.name, 'от ' + money(c[cur], cur), c.what, null);
    }).join(''));
    render('calc-users', D.users.map(function (u) {
      return option('users', u.id, u.range, null, null, fmtK(u.k) + (u.plus ? '+' : ''));
    }).join(''));
    render('calc-data', D.data.map(function (d) {
      return option('data', d.id, d.name, null, d.ops + ' оп/сутки · пик ' + d.rps + ' запр/с', fmtK(d.k) + (d.plus ? '+' : ''));
    }).join(''));

    $all('[data-currency]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.currency === cur)); });
  }

  function option(group, id, title, price, desc, k) {
    var checked = state[group] === id ? ' checked' : '';
    return '<label class="opt"><input type="radio" name="' + group + '" value="' + id + '"' + checked + '>' +
      '<span class="opt__box"><span class="opt__title">' + esc(title) + (k ? '<span class="opt__k">' + esc(k) + '</span>' : '') + '</span>' +
      (desc ? '<span class="opt__desc">' + esc(desc) + '</span>' : '') +
      (price ? '<span class="opt__price">' + esc(price) + '</span>' : '') + '</span></label>';
  }

  function renderEstimate() {
    var e = estimate(state);
    var cur = e.currency;
    $('#calcTotal').textContent = 'от ' + money(e.total, cur);
    $('#calcTerm').textContent = 'Срок: ' + e.complexity.term;
    $('#calcLines').innerHTML =
      '<dt>База · ' + esc(e.complexity.name.toLowerCase()) + ' уровень</dt><dd>' + money(e.base, cur) + '</dd>' +
      '<dt>Пользователи · ' + esc(e.users.range) + '</dt><dd>' + fmtK(e.users.k) + '</dd>' +
      '<dt>Данные · ' + esc(e.data.ops) + ' оп/сутки</dt><dd>' + fmtK(e.data.k) + '</dd>';
    $('#calcHint').textContent = e.individual ? 'Для такого масштаба окончательная оценка — индивидуально, после консультации.' : '';

    $('#briefEstimate').innerHTML = 'Ваш расчёт из калькулятора: <strong>от ' + money(e.total, cur) + '</strong>, ' + esc(e.complexity.term) +
      '<br><span style="color:var(--text-2)">' + esc(e.complexity.name) + ' уровень · ' + esc(e.users.range) + ' пользователей · ' + esc(e.data.ops) + ' операций в сутки</span>';

    var heroBase = $('[data-hero="base"]'), heroTotal = $('[data-hero="total"]');
    if (heroBase) {
      var m = byId(D.complexity, 'medium');
      var t = estimate({ complexity: 'medium', users: 'u1k', data: 'dMid', currency: cur });
      heroBase.textContent = money(m[cur], cur).padEnd(11, ' ');
      heroTotal.textContent = money(t.total, cur);
    }
    store.set('calc', state);
  }

  /* ---------- UI wiring ---------- */
  function wireCalc() {
    $('#calcForm').addEventListener('change', function (ev) {
      var t = ev.target;
      if (t && t.name && state.hasOwnProperty(t.name)) {
        state[t.name] = t.value;
        renderEstimate();
      }
    });
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-currency]');
      if (b) {
        state.currency = b.dataset.currency;
        renderPrices();
        renderEstimate();
      }
    });
  }

  function wireTheme() {
    var root = document.documentElement;
    var savedTheme = store.get('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') root.setAttribute('data-theme', savedTheme);
    $('#themeToggle').addEventListener('click', function () {
      var current = root.getAttribute('data-theme') ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store.set('theme', next);
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

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 3500);
  }
  window.TTX.toast = toast;

  function wirePdf() {
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-action]');
      if (!b) return;
      var action = b.dataset.action;
      if (action !== 'download-kp' && action !== 'download-estimate') return;
      b.disabled = true;
      toast('Готовим PDF…');
      var job = action === 'download-kp'
        ? window.TTXPdf.downloadKp(state.currency)
        : window.TTXPdf.downloadEstimate(estimate(state), {});
      job.then(function () { toast('PDF скачан'); })
        .catch(function (err) { console.error(err); toast('Не удалось собрать PDF. Обновите страницу и попробуйте ещё раз.'); })
        .then(function () { b.disabled = false; });
    });
  }

  /* ---------- brief form ---------- */
  function wireBrief() {
    var form = $('#briefForm');
    var fileInput = $('#tzFile');
    var drop = $('#drop');
    var dropText = $('#dropText');
    var clearBtn = $('#dropClear');
    var status = $('#briefStatus');
    var submitBtn = $('#briefSubmit');
    var frame = $('#briefFrame');
    var maxBytes = CFG.maxUploadMb * 1024 * 1024;
    var defaultDropText = dropText.innerHTML;
    var waiting = false;

    function showFile() {
      var f = fileInput.files && fileInput.files[0];
      if (f) {
        dropText.innerHTML = '<strong>' + esc(f.name) + '</strong> · ' + (f.size / 1024 / 1024).toFixed(1).replace('.', ',') + ' МБ';
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
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove('is-over'); }); });

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
      submitBtn.disabled = false;
      submitBtn.textContent = 'Отправить заявку';
      setStatus('Заявка отправлена. Мы ответим в течение рабочего дня.', 'ok');
      toast('Заявка отправлена');
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
      if (!name.value.trim()) { setError(name, 'Укажите имя'); bad = bad || name; }
      if (!email.value.trim() || !email.checkValidity()) { setError(email, 'Укажите корректный email'); bad = bad || email; }
      if (!message.value.trim()) { setError(message, 'Опишите задачу хотя бы парой предложений'); bad = bad || message; }
      var f = fileInput.files && fileInput.files[0];
      if (f && f.size > maxBytes) { setStatus('Файл больше ' + CFG.maxUploadMb + ' МБ. Сожмите его в ZIP или пришлите ссылку в описании.', 'error'); bad = bad || fileInput; }
      if (bad) { bad.focus(); return; }
      if (form.elements._honey.value) return; // бот

      var withEstimate = $('#attachEstimate').checked;
      var e = estimate(state);
      var cur = e.currency;
      var estimateText = withEstimate
        ? 'от ' + money(e.total, cur) + ' | ' + e.complexity.name + ' уровень (база ' + money(e.base, cur) + ') | пользователей: ' + e.users.range + ' (' + fmtK(e.users.k) + ') | данные: ' + e.data.ops + ' оп/сутки (' + fmtK(e.data.k) + ') | срок: ' + e.complexity.term
        : 'не приложен';
      form.elements.estimate.value = estimateText;
      form.elements._subject.value = 'Заявка с сайта TTX.dev: ' + name.value.trim() + (form.elements.company.value.trim() ? ' (' + form.elements.company.value.trim() + ')' : '');
      form.elements._autoresponse.value =
        'Здравствуйте, ' + name.value.trim() + '! Спасибо за заявку — мы получили её и ответим в течение рабочего дня.' +
        (withEstimate ? ' Предварительная оценка по калькулятору: от ' + money(e.total, cur) + ', срок ' + e.complexity.term + '. Точную стоимость назовём после бесплатной консультации.' : '') +
        ' — TTX.dev, ' + CFG.siteUrl;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправляем…';
      setStatus('');

      var kpInput = $('#kpFile');
      var attachPdf = withEstimate
        ? window.TTXPdf.estimateBlob(e, { name: name.value.trim(), company: form.elements.company.value.trim() })
            .then(function (blob) {
              try {
                var dt = new DataTransfer();
                dt.items.add(new File([blob], 'Предварительное КП TTX.dev.pdf', { type: 'application/pdf' }));
                kpInput.files = dt.files;
                kpInput.name = 'kp_attachment';
              } catch (err) { kpInput.removeAttribute('name'); }
            })
            .catch(function () { kpInput.removeAttribute('name'); })
        : Promise.resolve().then(function () { kpInput.removeAttribute('name'); });

      attachPdf.then(function () {
        form.action = CFG.formEndpoint();
        waiting = true;
        form.submit();
        setTimeout(function () {
          if (!waiting) return;
          waiting = false;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Отправить заявку';
          setStatus('Сервер долго не отвечает. Проверьте интернет и попробуйте ещё раз.', 'error');
        }, 45000);
      });
    });
  }

  /* ---------- init ---------- */
  renderStatic();
  renderPrices();
  renderEstimate();
  wireCalc();
  wireTheme();
  wireNav();
  wirePdf();
  wireBrief();
})();
