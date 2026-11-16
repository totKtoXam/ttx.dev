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
  var ACCENT = '#0a9e7b';
  var INK = '#0f1419';
  var MUTED = '#5b6573';
  var LINE = '#dde2e8';
  var TINT = '#f2f4f7';

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

  function today() {
    var d = new Date();
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function plusDays(n) {
    var d = new Date(Date.now() + n * 864e5);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
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
      return { text: [{ text: c.label + ': ', color: MUTED }, { text: c.value, link: c.href, color: INK }], style: 'p', margin: [0, 0, 0, 2] };
    });
    lines.push({ text: [{ text: 'Сайт и заявка с ТЗ: ', color: MUTED }, { text: C().siteUrl.replace(/^https?:\/\//, ''), link: C().siteUrl + '#brief', color: ACCENT }], style: 'p' });
    return lines;
  }

  function header(title, subtitle) {
    return [
      {
        columns: [
          { text: [{ text: '>_ ', color: ACCENT }, { text: 'ttx', color: INK }, { text: '.', color: ACCENT }, { text: 'dev', color: INK }], fontSize: 16, bold: true },
          { text: today(), alignment: 'right', color: MUTED, fontSize: 9, margin: [0, 5, 0, 0] },
        ],
        margin: [0, 0, 0, 18],
      },
      { text: title, style: 'h1' },
      subtitle ? { text: subtitle, style: 'lead' } : null,
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: ACCENT }], margin: [0, 10, 0, 16] },
    ].filter(Boolean);
  }

  function pricingBlock(cur) {
    var t = T(), d = D();
    var out = [];
    out.push(p('Стоимость считается по трём параметрам: сложность бизнес-процессов задаёт базовую цену, а количество пользователей и объём данных умножают её на коэффициенты. Цены — «от»; точная сумма фиксируется после консультации и не меняется без изменения объёма работ.'));
    out.push({
      table: { widths: ['*'], body: [[{ text: 'Стоимость = База (сложность) × K пользователи × K данные', bold: true, alignment: 'center', color: ACCENT, fontSize: 11 }]] },
      layout: { hLineColor: function () { return ACCENT; }, vLineColor: function () { return ACCENT; }, paddingTop: function () { return 8; }, paddingBottom: function () { return 8; } },
      margin: [0, 4, 0, 14],
    });

    out.push(h3('1. Сложность бизнес-процессов — базовая цена'));
    out.push(table(['Уровень', 'Что входит', 'Примеры', 'База', 'Срок'],
      d.complexity.map(function (c) {
        return [cell(c.name, 'tdb'), cell(c.what), cell(c.examples, 'tdm'), cell('от ' + t.moneyPdf(c[cur], cur), 'tdn'), cell(c.term, 'tdn')];
      }), [78, '*', '*', 72, 58]));

    out.push(h3('2. Количество пользователей — коэффициент'));
    out.push(table(['Активных пользователей', 'Коэффициент', 'Что добавляется в работу'],
      d.users.map(function (u) {
        return [cell(u.range, 'tdb'), cell(t.fmtK(u.k) + (u.plus ? ' и выше' : ''), 'tdk'), cell(u.adds, 'tdm')];
      }), [110, 80, '*']));

    out.push(h3('3. Объём и пропускная способность данных — коэффициент'));
    out.push(table(['Нагрузка', 'Операций в сутки', 'Пик, запр./с', 'Коэфф.', 'Что добавляется в работу'],
      d.data.map(function (x) {
        return [cell(x.name, 'tdb'), cell(x.ops, 'tdn'), cell(x.rps, 'tdn'), cell(t.fmtK(x.k) + (x.plus ? '+' : ''), 'tdk'), cell(x.adds, 'tdm')];
      }), [70, 70, 58, 44, '*']));
    out.push(p(d.operationNote, { color: MUTED, fontSize: 8.5, margin: [0, -6, 0, 10] }));

    var ex = t.estimate({ complexity: 'medium', users: 'u1k', data: 'dMid', currency: cur });
    out.push(p([
      { text: 'Пример расчёта. ', bold: true },
      'CRM для отдела продаж (средний уровень), 120 пользователей, около 30 000 операций в сутки: ' +
      t.moneyPdf(ex.base, cur) + ' × 1,2 × 1,15 = ',
      { text: t.moneyPdf(ex.total, cur), bold: true, color: ACCENT },
    ], { margin: [0, 0, 0, 14] }));

    out.push(h3('Дополнительно'));
    out.push(table(['Услуга', 'Стоимость'], d.extras.map(function (x) { return [cell(x.name, 'tdb'), cell(x[cur].replace("₸", "тг"))]; }), [170, '*']));

    out.push(h3('Форматы оплаты'));
    out.push({ ul: d.payment.map(function (x) { return { text: [{ text: x.title + ' — ', bold: true }, x.text], style: 'p' }; }), margin: [0, 0, 0, 6] });
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
      info: { title: title, author: C().brand, subject: 'Разработка ПО на заказ' },
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
            { text: C().brand + ' · ' + C().siteUrl.replace(/^https?:\/\//, ''), color: MUTED, fontSize: 8 },
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
    var content = header('Коммерческое предложение', 'Разработка программного обеспечения на заказ');

    content.push(h2('Кто мы'));
    content.push(p(C().brand + ' разрабатывает программное обеспечение под задачи конкретного бизнеса: от автоматизации рутины до полноценных веб-сервисов и мобильных приложений. Мы не продаём готовые коробки — мы делаем инструмент, который работает так, как устроен ваш бизнес.'));
    content.push(p('Наша цель простая: вы тратите меньше времени на ручную работу, меньше теряете на ошибках и получаете данные для решений в одном месте.'));

    content.push(h2('Какие задачи решаем'));
    content.push({ ul: d.pains.map(function (x) { return { text: x, style: 'p' }; }) });

    content.push(h2('Что разрабатываем'));
    content.push(table(['Направление', 'Примеры'], d.services.map(function (s) { return [cell(s.title, 'tdb'), cell(s.text)]; }), [170, '*']));

    content.push(h2('Как работаем'));
    content.push(p('Первая рабочая версия — обычно через 2–4 недели; дальше дорабатываем короткими итерациями, и вы видите прогресс каждую неделю.'));
    content.push({ ol: d.process.map(function (s) { return { text: [{ text: s.title + '. ', bold: true }, s.text], style: 'p' }; }) });

    content.push(h2('Стоимость и сроки' + (cur === 'usd' ? ' (USD)' : ' (KZT)')));
    content = content.concat(pricingBlock(cur));

    content.push(h2('Почему мы'));
    content.push({ ul: d.why.map(function (w) { return { text: [{ text: w.title + '. ', bold: true }, w.text], style: 'p' }; }) });

    content.push(h2('Портфолио'));
    content.push({ ul: d.projects.map(function (x) { return { text: [{ text: x.name, bold: true, link: x.site || x.repo }, ' — ' + x.text], style: 'p' }; }) });

    content.push(h2('Как начать'));
    content.push(p('Чтобы назвать цену и срок, нам достаточно ответов на четыре вопроса:'));
    content.push({ ol: [
      'Какую задачу должен решить софт и кто им будет пользоваться?',
      'Как это сейчас делается и с какими системами нужно связать (1С, CRM, сайт)?',
      'Сколько человек будет пользоваться системой и сколько заявок, заказов или записей проходит в день?',
      'Есть ли срок, к которому нужен результат, и ориентир по бюджету?',
    ].map(function (x) { return { text: x, style: 'p' }; }) });
    content.push(p('Готовое ТЗ не нужно — составим его вместе на бесплатной консультации.'));
    content.push(h3('Контакты'));
    content = content.concat(contactsBlock());
    return baseDoc(content, 'Коммерческое предложение ' + C().brand);
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
    var content = header('Предварительное коммерческое предложение', 'Оценка по калькулятору на сайте ' + C().siteUrl.replace(/^https?:\/\//, ''));

    var meta = [['Номер', estimateNumber()], ['Дата', today()], ['Действует до', plusDays(14)]];
    if (client.name) meta.unshift(['Для', client.name + (client.company ? ', ' + client.company : '')]);
    else if (client.company) meta.unshift(['Для', client.company]);
    content.push({
      table: { widths: [90, '*'], body: meta.map(function (r) { return [{ text: r[0], color: MUTED }, { text: r[1], bold: true }]; }) },
      layout: 'noBorders', margin: [0, 0, 0, 10],
    });

    content.push(h2('Параметры проекта'));
    content.push(table(['Параметр', 'Выбрано', 'Что это значит'], [
      [cell('Сложность процессов', 'tdb'), cell(e.complexity.name + ' уровень', 'tdn'), cell(e.complexity.what + '. Примеры: ' + e.complexity.examples + '.', 'tdm')],
      [cell('Пользователи', 'tdb'), cell(e.users.range, 'tdn'), cell(e.users.adds, 'tdm')],
      [cell('Нагрузка на данные', 'tdb'), cell(e.data.name + ': ' + e.data.ops + ' оп/сутки, пик ' + e.data.rps + ' запр./с', 'tdn'), cell(e.data.adds, 'tdm')],
    ], [100, 150, '*']));

    content.push(h2('Расчёт'));
    content.push(table(['Статья', 'Значение'], [
      [cell('Базовая цена (' + e.complexity.name.toLowerCase() + ' уровень)'), cell(t.moneyPdf(e.base, cur), 'tdn')],
      [cell('Коэффициент пользователей (' + e.users.range + ')'), cell(t.fmtK(e.users.k), 'tdk')],
      [cell('Коэффициент данных (' + e.data.name.toLowerCase() + ' нагрузка)'), cell(t.fmtK(e.data.k), 'tdk')],
      [{ text: 'Предварительная стоимость', bold: true, fontSize: 10.5 }, { text: 'от ' + t.moneyPdf(e.total, cur), bold: true, fontSize: 12, color: ACCENT }],
      [cell('Ориентировочный срок'), cell(e.complexity.term, 'tdn')],
    ], ['*', 150]));
    if (e.individual) content.push(p('Для такого масштаба окончательная оценка делается индивидуально, после консультации.', { color: '#c2410c' }));
    content.push(p('Это предварительная оценка. Точная стоимость и состав этапов фиксируются в ТЗ после бесплатной консультации и дальше не меняются без изменения объёма работ.', { color: MUTED }));

    content.push(h2('Что входит в работу'));
    content.push({ ol: D().process.map(function (s) { return { text: [{ text: s.title + '. ', bold: true }, s.text], style: 'p' }; }) });

    content.push(h2('Условия'));
    content.push({ ul: D().payment.map(function (x) { return { text: [{ text: x.title + ' — ', bold: true }, x.text], style: 'p' }; })
      .concat([{ text: [{ text: 'Гарантия 3 месяца', bold: true }, ' — ошибки в сданном функционале исправляем бесплатно.'], style: 'p' },
               { text: [{ text: 'Код и права — ваши', bold: true }, ' — передаём исходники, доступы и документацию.'], style: 'p' }]) });

    content.push(h2('Следующий шаг'));
    content.push(p('Ответьте на это письмо или напишите нам — назначим консультацию на 30–60 минут, уточним задачу и пришлём точную оценку.'));
    content = content.concat(contactsBlock());
    return baseDoc(content, 'Предварительное КП ' + C().brand);
  }

  /* ---------- public API ---------- */
  function download(doc, filename) {
    return new Promise(function (resolve, reject) {
      try { window.pdfMake.createPdf(doc).download(filename, resolve); } catch (err) { reject(err); }
    });
  }

  window.TTXPdf = {
    downloadKp: function (cur) {
      return ensureLib().then(function () { return download(kpDoc(cur), 'КП TTX.dev — разработка ПО.pdf'); });
    },
    downloadEstimate: function (e, client) {
      return ensureLib().then(function () { return download(estimateDoc(e, client), 'Предварительное КП TTX.dev.pdf'); });
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
