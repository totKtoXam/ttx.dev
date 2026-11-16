/*
 * Настройки сайта. Всё, что может поменяться без правки вёрстки, лежит здесь.
 * Пустой контакт ('') на сайте и в PDF не показывается.
 */
window.TTX_CONFIG = {
  brand: 'TTX.dev',
  owner: 'Beibarys Khamitov',
  siteUrl: 'https://totktoxam.github.io/ttx.dev/',

  contacts: {
    github: 'https://github.com/totKtoXam',
    telegram: '',   // например 'nickname' без @
    phone: '',      // например '+7 700 000 00 00'
    whatsapp: '',   // номер только цифрами, например '77000000000'
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
