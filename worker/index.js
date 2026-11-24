/*
 * Приём заявок с сайта ttx.dev и пересылка в Telegram.
 *
 * Сайт статический, поэтому токен бота хранить на нём нельзя. Форма отправляется
 * сюда, в Cloudflare Worker, а токен лежит в секретах воркера.
 *
 * Настройки (wrangler.toml и секреты):
 *   BOT_TOKEN        секрет, токен бота от @BotFather
 *   CHAT_ID          секрет, куда слать заявки (ваш id или id группы)
 *   ALLOWED_ORIGINS  адреса сайта через запятую, с которых принимаем заявки
 *   MAX_FILE_MB      лимит одного файла, по умолчанию 10
 *   LIMITER          необязательная привязка Rate Limiting: не больше 5 заявок в минуту с одного IP
 */

const LIMITS = { name: 120, company: 160, email: 160, phone: 80, message: 5000, estimate: 1000, language: 40 };
const FILE_FIELDS = { attachment: 'ТЗ от клиента', kp_attachment: 'Расчёт из калькулятора' };
const TG_TEXT_MAX = 4096;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = allowedOrigin(origin, env);
    const cors = allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: allowed ? 204 : 403,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Max-Age': '86400' },
      });
    }
    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, cors);
    if (!allowed) return json({ ok: false, error: 'origin' }, 403, cors);

    if (env.LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json({ ok: false, error: 'rate' }, 429, cors);
    }

    if (!env.BOT_TOKEN || !env.CHAT_ID) return json({ ok: false, error: 'config' }, 500, cors);

    let form;
    try {
      form = await request.formData();
    } catch (e) {
      return json({ ok: false, error: 'form' }, 400, cors);
    }

    // Ловушка для ботов: живой человек это поле не видит и не заполняет.
    // Отвечаем «ок», чтобы бот не понял, что его отсеяли.
    if (str(form.get('_honey'))) return json({ ok: true }, 200, cors);

    const f = {};
    for (const key of Object.keys(LIMITS)) f[key] = str(form.get(key)).slice(0, LIMITS[key]);
    if (!f.name || !f.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
      return json({ ok: false, error: 'fields' }, 400, cors);
    }

    const maxBytes = (Number(env.MAX_FILE_MB) || 10) * 1024 * 1024;
    const files = [];
    for (const field of Object.keys(FILE_FIELDS)) {
      const file = form.get(field);
      if (!file || typeof file === 'string' || !file.size) continue;
      if (file.size > maxBytes) return json({ ok: false, error: 'file' }, 413, cors);
      files.push({ file, caption: FILE_FIELDS[field] });
    }

    const tg = telegram(env);
    const text = buildText(f, request);
    let first;
    try {
      first = await tg('sendMessage', {
        chat_id: env.CHAT_ID,
        text: text.length > TG_TEXT_MAX ? text.slice(0, TG_TEXT_MAX - 60) + '…\n\n(полный текст в файле ниже)' : text,
        link_preview_options: { is_disabled: true },
      });
      if (text.length > TG_TEXT_MAX) {
        files.unshift({ file: new File([text], 'zayavka.txt', { type: 'text/plain' }), caption: 'Полный текст заявки' });
      }
    } catch (e) {
      console.error('sendMessage', e.message);
      return json({ ok: false, error: 'telegram' }, 502, cors);
    }

    // Заявка уже дошла. Если файл не перешлётся, пишем об этом отдельным сообщением, но клиенту отвечаем «ок».
    for (const { file, caption } of files) {
      const body = new FormData();
      body.append('chat_id', env.CHAT_ID);
      body.append('document', file, file.name || 'file');
      body.append('caption', caption);
      body.append('reply_parameters', JSON.stringify({ message_id: first.message_id, allow_sending_without_reply: true }));
      try {
        await tg('sendDocument', body);
      } catch (e) {
        console.error('sendDocument', e.message);
        await tg('sendMessage', {
          chat_id: env.CHAT_ID,
          text: '⚠️ Не удалось переслать файл «' + (file.name || caption) + '»: ' + e.message + '. Попросите клиента прислать его ещё раз.',
          reply_parameters: { message_id: first.message_id, allow_sending_without_reply: true },
        }).catch(() => {});
      }
    }

    return json({ ok: true }, 200, cors);
  },
};

function buildText(f, request) {
  const lines = ['📩 Заявка с сайта ttx.dev', ''];
  lines.push('Имя: ' + f.name);
  if (f.company) lines.push('Компания: ' + f.company);
  lines.push('Email: ' + f.email);
  if (f.phone) lines.push('Телефон / Telegram: ' + f.phone);
  if (f.language) lines.push('Язык сайта: ' + f.language);
  if (f.estimate) lines.push('Расчёт: ' + f.estimate);
  const country = request.cf && request.cf.country;
  if (country) lines.push('Страна по IP: ' + country);
  lines.push('', 'Задача:', f.message);
  return lines.join('\n');
}

function telegram(env) {
  const base = (env.TG_API || 'https://api.telegram.org') + '/bot' + env.BOT_TOKEN + '/';
  return async function call(method, payload) {
    const isForm = payload instanceof FormData;
    const res = await fetch(base + method, {
      method: 'POST',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? payload : JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.description || 'HTTP ' + res.status);
    return data.result;
  };
}

function allowedOrigin(origin, env) {
  if (!origin) return false;
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .includes(origin);
}

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
