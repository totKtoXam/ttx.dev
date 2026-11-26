/*
 * Данные коммерческого предложения: цены, коэффициенты, проекты.
 * Тексты лежат в словарях assets/js/i18n/*.js и подставляются по порядку элементов.
 * Формула: база × K пользователей × K данных, минус скидки. Цены указаны «от», в тенге и долларах США.
 */
(function () {
  'use strict';

  var BASE = {
    complexity: [
      { id: 'task', kzt: 30000, usd: 60 },
      { id: 'simple', kzt: 300000, usd: 600 },
      { id: 'medium', kzt: 1200000, usd: 2400 },
      { id: 'complex', kzt: 3500000, usd: 7000 },
      { id: 'enterprise', kzt: 10000000, usd: 20000 },
    ],
    users: [
      { id: 'u50', k: 1.0 },
      { id: 'u1k', k: 1.2 },
      { id: 'u20k', k: 1.5 },
      { id: 'uMax', k: 2.0, plus: true },
    ],
    data: [
      { id: 'dLow', k: 1.0 },
      { id: 'dMid', k: 1.15 },
      { id: 'dHigh', k: 1.4 },
      { id: 'dMax', k: 1.8, plus: true },
    ],
    /*
     * Скидки в процентах, складываются между собой.
     * loyalty: скрипты и мини-приложения, номер заказа у нас (n: с какого заказа).
     * prepay: простые системы и системы средней сложности, доля предоплаты.
     * full: сложные системы при 100% оплате до начала работ.
     */
    discounts: {
      cash: 5,
      loyalty: [
        { id: 'n1', n: 1, pct: 0 },
        { id: 'n2', n: 2, pct: 3 },
        { id: 'n5', n: 5, pct: 6 },
        { id: 'n8', n: 8, pct: 10 },
        { id: 'n10', n: 10, pct: 13 },
      ],
      prepay: [
        { id: 'p20', share: 20, pct: 0 },
        { id: 'p30', share: 30, pct: 3 },
        { id: 'p50', share: 50, pct: 6 },
      ],
      full: 10,
      enterpriseMax: 15,
      /*
       * Скидка по визитке: QR на визитке ведёт на сайт со ссылкой ?v=код.
       * Код свой у каждого тиража; новый тираж = новый код в codes, старые можно оставить.
       * С другими скидками не складывается: калькулятор берёт большую.
       */
      card: { pct: 3, codes: ['k7q'] },
    },
    projects: [
      { name: 'onwin', stack: ['Swift', 'Wine', 'macOS'], repo: 'https://github.com/totKtoXam/onwin', site: 'https://totktoxam.github.io/onwin/' },
      { name: 'Recruiting ATS', stack: ['Node.js', 'Express', 'PostgreSQL', 'Google OAuth'], repo: 'https://github.com/totKtoXam/recruting_ats' },
      { name: 'Cue', stack: ['TypeScript', 'Telegram Bot API'], repo: 'https://github.com/totKtoXam/cue-tbot' },
      { name: 'MarkItDown Converter', stack: ['Python', 'Windows'], repo: 'https://github.com/totKtoXam/md-converter' },
      { name: 'sshgui', stack: ['PowerShell', 'WPF', 'SSH'], repo: 'https://github.com/totKtoXam/sshgui' },
    ],
  };

  function merge(base, texts) {
    return base.map(function (b, i) {
      var o = {}, k;
      for (k in b) o[k] = b[k];
      for (k in (texts && texts[i]) || {}) o[k] = texts[i][k];
      return o;
    });
  }

  function build(lang) {
    var L = window.TTX_I18N.dict(lang).data;
    return {
      pains: L.pains,
      services: L.services,
      process: L.process,
      why: L.why,
      payment: L.payment,
      consult: L.consult,
      extras: L.extras,
      operationNote: L.operationNote,
      complexity: merge(BASE.complexity, L.complexity),
      users: merge(BASE.users, L.users),
      data: merge(BASE.data, L.data),
      projects: merge(BASE.projects, L.projects),
      discounts: BASE.discounts,
      discountRows: L.discountRows,
      tierDisc: L.tierDisc,
    };
  }

  window.TTX_DATA = build(window.TTX_LANG);
  // Уведомление о заявке приходит владельцу сайта, его пишем по-русски.
  window.TTX_DATA_RU = build('ru');
})();
