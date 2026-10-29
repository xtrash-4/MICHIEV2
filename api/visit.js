// Sends a Telegram message when someone opens the site, and a short summary
// when they leave. Runs on Vercel as /api/visit.
//
// Needs two Environment Variables in Vercel (Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN  the token BotFather gives you
//   TELEGRAM_CHAT_ID    your own chat id (ask @userinfobot on Telegram)
//
// What it reports: the name in the link (?to=...), time, device, browser or app,
// approximate city/country (from Vercel's network data), and watch time.
// It does not store or send the visitor's IP address.

const MAX_BODY = 2000;

const clean = (s, n = 40) => String(s ?? '').replace(/[\u0000-\u001f<>&"]/g, '').trim().slice(0, n);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function device(ua) {
  let os = 'Unknown device';
  const android = ua.match(/Android\s([\d.]+)(?:;\s*([^;)]+))?/);
  if (android) {
    const model = (android[2] || '').replace(/Build\/.*$/, '').trim();
    os = `Android ${android[1]}${model && model !== 'K' ? ` · ${model}` : ''}`;
  } else if (/iPhone/.test(ua)) os = `iPhone · iOS ${(ua.match(/OS (\d+[_\d]*)/) || [, '?'])[1].replace(/_/g, '.')}`;
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Windows/.test(ua)) os = 'Windows PC';
  else if (/Macintosh/.test(ua)) os = 'Mac';
  else if (/Linux/.test(ua)) os = 'Linux PC';

  let app = 'Browser';
  if (/musical_ly|BytedanceWebview|TikTok|trill/i.test(ua)) app = 'TikTok app';
  else if (/Instagram/i.test(ua)) app = 'Instagram app';
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) app = 'Facebook app';
  else if (/Line\//i.test(ua)) app = 'LINE app';
  else if (/Twitter/i.test(ua)) app = 'X app';
  else if (/EdgA?\//.test(ua)) app = 'Edge';
  else if (/SamsungBrowser/.test(ua)) app = 'Samsung Internet';
  else if (/OPR\/|Opera/.test(ua)) app = 'Opera';
  else if (/Firefox|FxiOS/.test(ua)) app = 'Firefox';
  else if (/CriOS|Chrome\//.test(ua)) app = 'Chrome';
  else if (/Safari/.test(ua)) app = 'Safari';
  return { os, app };
}

function source(ref) {
  if (!ref) return '';
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '');
    if (/tiktok/.test(h)) return 'TikTok';
    if (/instagram/.test(h)) return 'Instagram';
    if (/facebook|fb\./.test(h)) return 'Facebook';
    if (/whatsapp|wa\.me/.test(h)) return 'WhatsApp';
    if (/t\.co$|twitter|x\.com/.test(h)) return 'X';
    if (/google/.test(h)) return 'Google';
    return h;
  } catch { return ''; }
}

const mmss = (s) => {
  s = Math.max(0, Math.round(+s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();

  // only accept calls from this site's own pages, so others can't spam your Telegram
  const host = req.headers.host || '';
  let originHost = '';
  try { originHost = new URL(req.headers.origin || req.headers.referer || '').host; } catch { /* missing */ }
  if (!host || originHost !== host) return res.status(403).end();

  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return res.status(204).end();   // not set up yet: do nothing

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY) return res.status(413).end();
    try { body = JSON.parse(body); } catch { return res.status(400).end(); }
  }
  if (!body || typeof body !== 'object') return res.status(400).end();

  const ev = body.ev === 'leave' ? 'leave' : 'open';
  const to = clean(body.to, 30), known = clean(body.known, 30);
  // no name in the link, but this phone opened a named link before
  const who = to ? `<b>${esc(to)}</b>`
    : known ? `<b>${esc(known)}</b> <i>(dikenali dari HP yang sama)</i>`
    : '<i>link umum (tanpa nama)</i>';
  const ua = clean(req.headers['user-agent'], 400);
  const { os, app } = device(ua);
  const dec = (v) => { try { return decodeURIComponent(v || ''); } catch { return v || ''; } };
  const city = dec(req.headers['x-vercel-ip-city']);
  const country = req.headers['x-vercel-ip-country'] || '';
  const place = [city, country].filter(Boolean).join(', ') || 'tidak diketahui';
  const time = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
  const from = source(clean(body.ref, 300));

  let text;
  if (ev === 'open') {
    text = [
      `👀 ${who} membuka web kamu`,
      `🕒 ${esc(time)} WIB`,
      `📱 ${esc(os)} · ${esc(app)}`,
      `📍 ${esc(place)} <i>(perkiraan)</i>`,
      from ? `🔗 dari ${esc(from)}` : '',
      body.visits > 1 ? `🔁 kunjungan ke-${Math.min(+body.visits | 0, 9999)} dari HP ini` : '',
    ];
  } else {
    const played = Math.max(0, Math.min(+body.played || 0, 36000));
    const dur = Math.max(0, Math.min(+body.dur || 0, 36000));
    text = [
      `👋 ${who} keluar`,
      played > 0
        ? `🎵 nonton ${mmss(played)}${dur ? ` dari ${mmss(dur)}` : ''}${body.done ? ' · sampai habis ✅' : ''}`
        : '🎵 belum sempat memutar lagu',
      `⏱ di halaman ${mmss(body.stay)}`,
    ];
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: text.filter(Boolean).join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    return res.status(r.ok ? 204 : 502).end();
  } catch {
    return res.status(502).end();
  }
}
