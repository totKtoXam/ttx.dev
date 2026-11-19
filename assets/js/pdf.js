/*
 * PDF: полное КП и предварительное КП по калькулятору.
 * pdfmake (шрифт Roboto с кириллицей) подгружается только при первом скачивании.
 */
(function () {
  'use strict';

  var LIBS = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js',
  ];
  var ACCENT = '#2B3FB8';
  var INK = '#1E2126';
  var MUTED = '#62666E';
  var LINE = '#E2E3E6';
  var TINT = '#F3F4F6';

  var loading = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Не загрузился ' + src)); };
      document.head.appendChild(s);
    });
  }
  function ensureLib() {
    if (window.pdfMake && window.pdfMake.vfs) return Promise.resolve();
    if (!loading) {
      loading = LIBS.reduce(function (p, src) { return p.then(function () { return loadScript(src); }); }, Promise.resolve())
        .catch(function (e) { loading = null; throw e; });
    }
    return loading;
  }

  function D() { return window.TTX_DATA; }
  function C() { return window.TTX_CONFIG; }
  function T() { return window.TTX; }
  function I() { return window.TTX_I18N; }
  function P(key, vars) { return I().t('pdf.' + key, vars); }

  function today() {
    var d = new Date();
    return d.toLocaleDateString(I().locale, { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function plusDays(n) {
    var d = new Date(Date.now() + n * 864e5);
    return d.toLocaleDateString(I().locale, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ---------- building blocks ---------- */
  function h2(text) { return { text: text, style: 'h2', headlineLevel: 1 }; }
  function h3(text) { return { text: text, style: 'h3', headlineLevel: 1 }; }
  function p(text, extra) { var o = { text: text, style: 'p' }; for (var k in extra || {}) o[k] = extra[k]; return o; }

  function table(headers, rows, widths) {
    return {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: widths,
        body: [headers.map(function (h) { return { text: h, style: 'th' }; })].concat(rows),
      },
      layout: {
        hLineWidth: function (i, node) { return i === 0 || i === node.table.body.length ? 0.8 : 0.5; },
        vLineWidth: function () { return 0; },
        hLineColor: function () { return LINE; },
        fillColor: function (i) { return i === 0 ? TINT : null; },
        paddingLeft: function () { return 7; },
        paddingRight: function () { return 7; },
        paddingTop: function () { return 6; },
        paddingBottom: function () { return 6; },
      },
      margin: [0, 2, 0, 12],
    };
  }
  function cell(text, style) { return { text: text, style: style || 'td' }; }

  function contactsBlock() {
    var items = T().contactItems().filter(function (c) { return c.href.charAt(0) !== '#'; });
    var lines = items.map(function (c) {
      return { text: [{ text: c.label + ': ', color: MUTED }, { text: c.plain || c.value, link: c.href, color: INK }], style: 'p', margin: [0, 0, 0, 2] };
    });
    lines.push({ text: [{ text: P('siteLabel'), color: MUTED }, { text: C().siteUrl.replace(/^https?:\/\//, ''), link: C().siteUrl + '#brief', color: ACCENT }], style: 'p' });
    // QR-коды мессенджеров: из распечатки чат открывается камерой телефона
    var chats = items.filter(function (c) { return c.label === 'Telegram' || c.label === 'WhatsApp'; });
    if (chats.length) {
      lines.push({
        columns: chats.map(function (c) {
          return { width: 'auto', stack: [
            (window.TTX_QR && window.TTX_QR[c.label.toLowerCase()])
              ? { svg: window.TTX_QR[c.label.toLowerCase()], width: 96 }
              : { qr: c.href, fit: 92, eccLevel: 'M', foreground: INK },
            { text: c.label, alignment: 'center', bold: true, fontSize: 9, margin: [0, 4, 0, 0] },
          ] };
        }),
        columnGap: 28, margin: [0, 10, 0, 0], unbreakable: true,
      });
    }
    return lines;
  }

  /* логотип берём из контуров в шапке сайта, цвета светлой темы */
  function logoNode() {
    var mark = document.querySelector('.logo__mark');
    var ttx = mark && mark.querySelector('.logo__ttx');
    var dev = mark && mark.querySelector('.logo__dev');
    if (!ttx || !dev) return { text: [{ text: 'ttx', color: INK }, { text: '.dev', color: ACCENT }], fontSize: 16, bold: true };
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + mark.getAttribute('viewBox') + '">' +
      '<path fill="' + INK + '" d="' + ttx.getAttribute('d') + '"/>' +
      '<path fill="' + ACCENT + '" d="' + dev.getAttribute('d') + '"/></svg>';
    return { width: 'auto', stack: [{ svg: svg, width: 64 }] };
  }

  function header(title, subtitle) {
    return [
      {
        columns: [
          logoNode(),
          { text: today(), alignment: 'right', color: MUTED, fontSize: 9, margin: [0, 5, 0, 0] },
        ],
        margin: [0, 0, 0, 18],
      },
      { text: title, style: 'h1' },
      subtitle ? { text: subtitle, style: 'lead' } : null,
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: INK }], margin: [0, 10, 0, 16] },
    ].filter(Boolean);
  }

  function pricingBlock(cur) {
    var t = T(), d = D();
    var out = [];
    out.push(p(P('pricingIntro')));
    out.push({
      table: { widths: ['*'], body: [[{ text: P('formula'), bold: true, alignment: 'center', color: ACCENT, fontSize: 11 }]] },
      layout: { hLineColor: function () { return ACCENT; }, vLineColor: function () { return ACCENT; }, paddingTop: function () { return 8; }, paddingBottom: function () { return 8; } },
      margin: [0, 4, 0, 10],
    });
    out.push(p(P('own') + ' ' + P('vat'), { color: MUTED, margin: [0, 0, 0, 12] }));

    out.push(h3(P('t1')));
    out.push(table(I().t('js.headComplexity'),
      d.complexity.map(function (c) {
        return [cell(c.name, 'tdb'), cell(c.what), cell(c.examples, 'tdm'), cell(t.from(t.moneyPdf(c[cur], cur)), 'tdn'), cell(c.term, 'tdn')];
      }), [78, '*', '*', 72, 58]));
    out.push(p(P('termNote'), { color: MUTED }));

    if (d.discountRows) {
      out.push(h3(P('t6')));
      out.push(table(I().t('js.headDiscounts'), d.discountRows.map(function (r) {
        return [cell(r.name, 'tdb'), cell(r.text, 'tdm'), cell(r.size, 'tdn')];
      }), [110, '*', 90]));
      out.push(p(P('discNote'), { color: MUTED }));
    }

    out.push(h3(P('t2')));
    out.push(table(I().t('js.headUsers'),
      d.users.map(function (u) {
        return [cell(u.range, 'tdb'), cell(t.fmtK(u.k) + (u.plus ? I().t('js.andUp') : ''), 'tdk'), cell(u.adds, 'tdm')];
      }), [110, 80, '*']));

    out.push(h3(P('t3')));
    out.push(table(P('t3Head'),
      d.data.map(function (x) {
        return [cell(x.name, 'tdb'), cell(x.ops, 'tdn'), cell(x.rps, 'tdn'), cell(t.fmtK(x.k) + (x.plus ? '+' : ''), 'tdk'), cell(x.adds, 'tdm')];
      }), [70, 70, 58, 44, '*']));
    out.push(p(d.operationNote, { color: MUTED, fontSize: 8.5, margin: [0, -6, 0, 10] }));

    var ex = t.estimate({ complexity: 'medium', users: 'u1k', data: 'dMid', currency: cur });
    out.push(p([
      { text: P('exampleLabel'), bold: true },
      P('exampleText') +
      t.moneyPdf(ex.base, cur) + ' ' + t.fmtK(ex.users.k) + ' ' + t.fmtK(ex.data.k) + ' = ',
      { text: t.moneyPdf(ex.total, cur), bold: true, color: ACCENT },
    ], { margin: [0, 0, 0, 14] }));

    out.push(h3(P('t5')));
    out.push(p(P('t5sub'), { color: MUTED }));
    out.push(table(I().t('js.headConsult'), d.consult.map(function (x) { return [cell(x.name, 'tdb'), cell(x.what, 'tdm'), cell(x[cur].replace('₸', P('tg')), 'tdn')]; }), [120, '*', 110]));

    out.push(h3(P('t4')));
    out.push(table(I().t('js.headExtras'), d.extras.map(function (x) { return [cell(x.name, 'tdb'), cell(x[cur].replace('₸', P('tg')))]; }), [170, '*']));

    out.push(h3(P('payH')));
    out.push({ ul: d.payment.map(function (x) { return { text: [{ text: x.title + '. ', bold: true }, x.text], style: 'p' }; }), margin: [0, 0, 0, 6] });
    return out;
  }

  // Заголовок, за которым идёт таблица, держим вместе с ней на одной странице.
  function keepHeadingsWithTables(content) {
    var out = [];
    for (var i = 0; i < content.length; i++) {
      var node = content[i], next = content[i + 1];
      if (node && node.headlineLevel && next && next.table) {
        out.push({ stack: [node, next], unbreakable: true });
        i++;
      } else {
        out.push(node);
      }
    }
    return out;
  }

  function baseDoc(content, title) {
    return {
      info: { title: title, author: C().brand, subject: P('subject') },
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 50],
      content: keepHeadingsWithTables(content),
      defaultStyle: { font: 'Roboto', fontSize: 9.5, lineHeight: 1.25, color: INK },
      // заголовок не остаётся последней строкой страницы
      pageBreakBefore: function (node, following) {
        return node.headlineLevel === 1 && following.length < 2;
      },
      footer: function (page, pages) {
        return {
          columns: [
            { text: C().owner + ', ' + C().siteUrl.replace(/^https?:\/\//, ''), color: MUTED, fontSize: 8 },
            { text: page + ' / ' + pages, alignment: 'right', color: MUTED, fontSize: 8 },
          ],
          margin: [40, 16, 40, 0],
        };
      },
      styles: {
        h1: { fontSize: 20, bold: true, margin: [0, 0, 0, 4] },
        lead: { fontSize: 10.5, color: MUTED },
        h2: { fontSize: 13.5, bold: true, margin: [0, 14, 0, 6], color: INK },
        h3: { fontSize: 10.5, bold: true, margin: [0, 6, 0, 4] },
        p: { fontSize: 9.5, margin: [0, 0, 0, 6] },
        th: { fontSize: 7.5, bold: true, color: MUTED },
        td: { fontSize: 8.5 },
        tdb: { fontSize: 8.5, bold: true },
        tdm: { fontSize: 8.5, color: MUTED },
        tdn: { fontSize: 8.5, bold: true },
        tdk: { fontSize: 8.5, bold: true, color: ACCENT },
      },
    };
  }

  /* ---------- full KP ---------- */
  function kpDoc(cur) {
    var d = D();
    var content = header(P('kpTitle'), P('kpSubtitle'));

    content.push(h2(P('aboutH')));
    content.push(p([P('aboutA', { owner: C().owner }), { text: P('aboutExp'), bold: true, background: '#FFF3A8' }, P('aboutB')]));
    content.push(p(P('about2')));

    content.push(h2(P('painsH')));
    content.push({ ul: d.pains.map(function (x) { return { text: x, style: 'p' }; }) });

    content.push(h2(P('servicesH')));
    content.push(table(P('servicesHead'), d.services.map(function (s) { return [cell(s.title, 'tdb'), cell(s.text)]; }), [170, '*']));

    content.push(h2(P('processH')));
    content.push({ ol: d.process.map(function (s) { return { text: [{ text: s.title + '. ', bold: true }, s.text], style: 'p' }; }) });

    content.push(h2(P('pricingH', { cur: cur === 'usd' ? 'USD' : 'KZT' })));
    content = content.concat(pricingBlock(cur));

    content.push(h2(P('termsH')));
    content.push({ ul: d.why.map(function (w) { return { text: [{ text: w.title + '. ', bold: true }, w.text], style: 'p' }; }) });

    content.push(h2(P('projectsH')));
    content.push({ ul: d.projects.map(function (x) { return { text: [{ text: x.name, bold: true, link: x.site || x.repo }, '. ' + x.text], style: 'p' }; }) });

    content.push(h2(P('startH')));
    content.push(p(P('startIntro')));
    content.push({ ol: P('startQs').map(function (x) { return { text: x, style: 'p' }; }) });
    content.push(p(P('startOutro')));
    content.push(h3(P('contactsH')));
    content = content.concat(contactsBlock());
    return baseDoc(content, P('kpTitle') + ' ' + C().brand);
  }

  /* ---------- estimate KP ---------- */
  function estimateNumber() {
    var d = new Date();
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return 'TTX-' + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + Math.floor(1000 + Math.random() * 9000);
  }

  function estimateDoc(e, client) {
    var t = T(), cur = e.currency;
    client = client || {};
    var content = header(P('estTitle'), P('estSubtitle', { site: C().siteUrl.replace(/^https?:\/\//, '') }));

    var meta = [[P('metaNo'), estimateNumber()], [P('metaDate'), today()], [P('metaValid'), plusDays(14)]];
    if (client.name) meta.unshift([P('metaFor'), client.name + (client.company ? ', ' + client.company : '')]);
    else if (client.company) meta.unshift([P('metaFor'), client.company]);
    content.push({
      table: { widths: [90, '*'], body: meta.map(function (r) { return [{ text: r[0], color: MUTED }, { text: r[1], bold: true }]; }) },
      layout: 'noBorders', margin: [0, 0, 0, 10],
    });

    var level = e.complexity.level || I().t('js.level', { name: e.complexity.name });
    content.push(h2(P('paramsH')));
    content.push(table(P('paramsHead'), [
      [cell(P('rowComplexity'), 'tdb'), cell(level, 'tdn'), cell(P('whatEx', { what: e.complexity.what, ex: e.complexity.examples }), 'tdm')],
      [cell(P('rowUsers'), 'tdb'), cell(e.users.range, 'tdn'), cell(e.users.adds, 'tdm')],
      [cell(P('rowData'), 'tdb'), cell(P('dataCell', { name: e.data.name, ops: e.data.ops, rps: e.data.rps }), 'tdn'), cell(e.data.adds, 'tdm')],
    ], [100, 150, '*']));

    content.push(h2(P('calcH')));
    content.push(table(P('calcHead'), [
      [cell(P('baseRow', { level: level.toLowerCase() })), cell(t.moneyPdf(e.base, cur), 'tdn')],
      [cell(P('usersRow', { range: e.users.range })), cell(t.fmtK(e.users.k), 'tdk')],
      [cell(P('dataRow', { load: P('load', { name: e.data.name }).toLowerCase() })), cell(t.fmtK(e.data.k), 'tdk')],
    ].concat(e.pct ? [
      [cell(P('grossRow')), cell(t.from(t.moneyPdf(e.gross, cur)), 'tdn')],
      [cell(P('discRow', { list: t.discText(e) })), cell('-' + e.pct + '%', 'tdk')],
    ] : [], [
      [{ text: P('totalRow'), bold: true, fontSize: 10.5 }, { text: t.from(t.moneyPdf(e.total, cur)), bold: true, fontSize: 12, color: ACCENT }],
      [cell(P('termRow')), cell(e.complexity.term, 'tdn')],
    ]), ['*', 150]));
    if (e.individual) content.push(p(I().t('js.individual'), { color: '#B42318' }));
    content.push(p(P('disclaimer') + ' ' + P('termNote') + ' ' + P('vat'), { color: MUTED }));

    content.push(h2(P('includedH')));
    content.push({ ol: D().process.map(function (s) { return { text: [{ text: s.title + '. ', bold: true }, s.text], style: 'p' }; }) });

    content.push(h2(P('termsH')));
    content.push({ ul: D().payment.map(function (x) { return { text: [{ text: x.title + '. ', bold: true }, x.text], style: 'p' }; })
      .concat([{ text: [{ text: P('guarantee')[0], bold: true }, P('guarantee')[1]], style: 'p' },
               { text: [{ text: P('codeOwn')[0], bold: true }, P('codeOwn')[1]], style: 'p' }]) });

    content.push(h2(P('nextH')));
    content.push(p(P('nextText')));
    content = content.concat(contactsBlock());
    return baseDoc(content, P('estDocTitle') + ' ' + C().brand);
  }

  /* ---------- public API ---------- */
  function download(doc, filename) {
    return new Promise(function (resolve, reject) {
      try { window.pdfMake.createPdf(doc).download(filename, resolve); } catch (err) { reject(err); }
    });
  }

  window.TTXPdf = {
    preload: function () { ensureLib().catch(function () { /* повторим при отправке */ }); },
    downloadKp: function (cur) {
      return ensureLib().then(function () { return download(kpDoc(cur), I().t('js.kpFile')); });
    },
    downloadEstimate: function (e, client) {
      return ensureLib().then(function () { return download(estimateDoc(e, client), I().t('js.estFile')); });
    },
    estimateBlob: function (e, client) {
      return ensureLib().then(function () {
        return new Promise(function (resolve, reject) {
          try { window.pdfMake.createPdf(estimateDoc(e, client)).getBlob(resolve); } catch (err) { reject(err); }
        });
      });
    },
    _docs: { kp: kpDoc, estimate: estimateDoc },
  };
})();
