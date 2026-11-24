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
   * Куда уходят заявки с ТЗ: адрес Cloudflare Worker из папки worker/
   * (вида https://ttx-brief.<имя>.workers.dev). Воркер пересылает заявку и файлы
   * в Telegram, токен бота хранится только у него.
   * Пока адрес пустой, форма предлагает написать в Telegram напрямую.
   */
  formEndpoint: 'https://ttx-brief.kham-b-13-09.workers.dev',

  maxUploadMb: 10,
};
