/*
 * Настройки сайта. Всё, что может поменяться без правки вёрстки, лежит здесь.
 * Пустой контакт ('') на сайте и в PDF не показывается.
 */
window.TTX_CONFIG = {
  brand: 'ttx.dev',
  owner: 'Бейбарыс',        // имя на русском и казахском
  ownerLatin: 'Beibarys',   // имя на английской версии
  siteUrl: 'https://totktoxam.github.io/ttx.dev/',

  contacts: {
    github: 'https://github.com/totKtoXam',
    telegram: 'totktoxamdev',   // без @
    phone: '+7 778 252 84 76',
    email: 'a2hhbS5iLjEzLjA5QGdtYWlsLmNvbQ==', // base64: на странице адрес обычный, но в исходниках его не найдут простые сборщики почты
    whatsapp: '77782528476',   // номер только цифрами
    linkedin: '',   // полная ссылка
  },

  /*
   * Куда уходят заявки с ТЗ. FormSubmit.co пересылает форму на почту.
   * После первой заявки FormSubmit пришлёт письмо для подтверждения и даст
   * «секретный» адрес вида https://formsubmit.co/abc123... — его нужно вставить
   * в formAlias, тогда почта перестанет фигурировать в коде сайта.
   */
  formAlias: '',
  formRecipient: 'a2hhbS5iLjEzLjA5QGdtYWlsLmNvbQ==', // base64, чтобы адрес не собирали боты

  maxUploadMb: 10,
};

window.TTX_CONFIG.formEndpoint = function () {
  var c = window.TTX_CONFIG;
  var target = c.formAlias || atob(c.formRecipient);
  return 'https://formsubmit.co/' + target;
};
