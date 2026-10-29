// Sends a Telegram message when someone opens the site, and a summary when
// they leave. Runs on Vercel as /api/visit.
//
// Needs two Environment Variables in Vercel (Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN  the token BotFather gives you
//   TELEGRAM_CHAT_ID    your own chat id (ask @userinfobot on Telegram)
//
// Reports: the name in the link (?to=...), time, phone/browser details the
// browser shares openly, approximate city (from Vercel's network data) and
// how the visitor watched. It does not store or send the visitor's IP address.

const MAX_BODY = 3000;
const TZ = 'Asia/Jakarta';

const clean = (s, n = 40) => String(s ?? '').replace(/[\u0000-\u001f<>&"]/g, '').trim().slice(0, n);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (v, max = 1e6) => { const n = Math.round(+v); return Number.isFinite(n) ? Math.max(0, Math.min(n, max)) : 0; };
const mmss = (s) => { s = num(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const human = (s) => { s = num(s); return s < 60 ? `${s} detik` : s < 3600 ? `${Math.floor(s / 60)} menit ${s % 60} detik` : `${Math.floor(s / 3600)} jam ${Math.floor(s / 60) % 60} menit`; };
const when = (d) => d.toLocaleString('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// tree-style block: header line, then "├ label : value" rows (empty rows skipped)
function block(title, rows) {
  rows = rows.filter((r) => r && r[1] !== '' && r[1] != null);
  if (!rows.length) return '';
  return [title, ...rows.map(([k, v], i) => `${i === rows.length - 1 ? '└' : '├'} ${k}: ${v}`)].join('\n');
}

const PROV_ID = {
  AC: 'Aceh', SU: 'Sumatera Utara', SB: 'Sumatera Barat', RI: 'Riau', KR: 'Kepulauan Riau', JA: 'Jambi',
  SS: 'Sumatera Selatan', BB: 'Bangka Belitung', BE: 'Bengkulu', LA: 'Lampung', JK: 'DKI Jakarta', JB: 'Jawa Barat',
  BT: 'Banten', JT: 'Jawa Tengah', YO: 'DI Yogyakarta', JI: 'Jawa Timur', BA: 'Bali', NB: 'Nusa Tenggara Barat',
  NT: 'Nusa Tenggara Timur', KB: 'Kalimantan Barat', KT: 'Kalimantan Tengah', KS: 'Kalimantan Selatan',
  KI: 'Kalimantan Timur', KU: 'Kalimantan Utara', SA: 'Sulawesi Utara', ST: 'Sulawesi Tengah', SN: 'Sulawesi Selatan',
  SG: 'Sulawesi Tenggara', GO: 'Gorontalo', SR: 'Sulawesi Barat', MA: 'Maluku', MU: 'Maluku Utara', PA: 'Papua',
  PB: 'Papua Barat', PS: 'Papua Selatan', PT: 'Papua Tengah', PE: 'Papua Pegunungan', PD: 'Papua Barat Daya',
};
const regionName = (cc) => { try { return new Intl.DisplayNames(['id'], { type: 'region' }).of(cc) || cc; } catch { return cc; } };
const langName = (l) => { try { return new Intl.DisplayNames(['id'], { type: 'language' }).of(l) || l; } catch { return l; } };
const flag = (cc) => /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '';

function brandOf(model) {
  const m = model.toUpperCase();
  if (/^SM-|GALAXY/.test(m)) return 'Samsung';
  if (/^RMX/.test(m)) return 'realme';
  if (/^CPH|^OPPO/.test(m)) return 'OPPO';
  if (/^V\d{4}|^VIVO/.test(m)) return 'vivo';
  if (/^(M\d{4}|2\d{3}[A-Z0-9]|REDMI|POCO|MI )/.test(m)) return 'Xiaomi';
  if (/^INFINIX|^X6\d\d/.test(m)) return 'Infinix';
  if (/^TECNO/.test(m)) return 'Tecno';
  if (/^ITEL/.test(m)) return 'itel';
  if (/^PIXEL/.test(m)) return 'Google';
  if (/^ASUS|^ASUS_/.test(m)) return 'Asus';
  if (/^(NE|IN|LE|KB|CPH)2\d{3}|ONEPLUS/.test(m)) return 'OnePlus';
  if (/^(ANE|ELE|VOG|NOH|JNY|HUAWEI)/.test(m)) return 'Huawei';
  if (/^MOTO|^XT\d/.test(m)) return 'Motorola';
  if (/^NOKIA|^TA-/.test(m)) return 'Nokia';
  return '';
}

function device(ua, hint = {}) {
  let phone = '', os = '';
  const android = ua.match(/Android\s([\d.]+)(?:;\s*([^;)]+))?/);
  if (android) {
    let model = clean(hint.model, 40) || (android[2] || '').replace(/Build\/.*$/, '').trim();
    if (model === 'K') model = '';                 // Chrome hides the model as "K"
    const brand = model ? brandOf(model) : '';
    phone = model ? `${brand ? `${brand} ` : ''}${model}` : 'HP Android (model disembunyikan browser)';
    const v = clean(hint.osv, 12).split('.')[0] || android[1];
    os = `Android ${v}`;
  } else if (/iPhone/.test(ua)) {
    phone = 'iPhone (Apple tidak memberi tahu tipenya)';
    os = `iOS ${(ua.match(/OS (\d+[_\d]*)/) || [, '?'])[1].replace(/_/g, '.')}`;
  } else if (/iPad/.test(ua)) { phone = 'iPad'; os = 'iPadOS'; }
  else if (/Windows/.test(ua)) { phone = 'Laptop/PC'; os = 'Windows'; }
  else if (/Macintosh/.test(ua)) { phone = 'Mac'; os = 'macOS'; }
  else if (/CrOS/.test(ua)) { phone = 'Chromebook'; os = 'ChromeOS'; }
  else if (/Linux/.test(ua)) { phone = 'Laptop/PC'; os = 'Linux'; }
  else { phone = 'Tidak diketahui'; }

  const ver = (re) => ((ua.match(re) || [])[1] || '').split('.')[0];
  let app;
  if (/musical_ly|BytedanceWebview|TikTok|trill/i.test(ua)) app = 'TikTok (browser di dalam aplikasi)';
  else if (/Instagram/i.test(ua)) app = 'Instagram (browser di dalam aplikasi)';
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) app = 'Facebook (browser di dalam aplikasi)';
  else if (/Line\//i.test(ua)) app = 'LINE (browser di dalam aplikasi)';
  else if (/Twitter/i.test(ua)) app = 'X (browser di dalam aplikasi)';
  else if (/EdgA?\//.test(ua)) app = `Edge ${ver(/EdgA?\/([\d.]+)/)}`;
  else if (/SamsungBrowser/.test(ua)) app = `Samsung Internet ${ver(/SamsungBrowser\/([\d.]+)/)}`;
  else if (/OPR\//.test(ua)) app = `Opera ${ver(/OPR\/([\d.]+)/)}`;
  else if (/MiuiBrowser/.test(ua)) app = 'Mi Browser';
  else if (/Firefox|FxiOS/.test(ua)) app = `Firefox ${ver(/(?:Firefox|FxiOS)\/([\d.]+)/)}`;
  else if (/CriOS/.test(ua)) app = `Chrome ${ver(/CriOS\/([\d.]+)/)}`;
  else if (/Chrome\//.test(ua)) app = `Chrome ${ver(/Chrome\/([\d.]+)/)}`;
  else if (/Safari/.test(ua)) app = `Safari ${ver(/Version\/([\d.]+)/)}`;
  else app = 'Browser lain';
  return { phone, os, app: app.trim() };
}

function source(ref, ua) {
  let h = '';
  try { h = ref ? new URL(ref).hostname.replace(/^www\./, '') : ''; } catch { /* bad url */ }
  if (/tiktok/.test(h) || /musical_ly|BytedanceWebview|TikTok/i.test(ua)) return 'TikTok';
  if (/instagram/.test(h) || /Instagram/i.test(ua)) return 'Instagram';
  if (/facebook|fb\./.test(h) || /FBAN|FBAV/i.test(ua)) return 'Facebook';
  if (/whatsapp|wa\.me/.test(h)) return 'WhatsApp';
  if (/t\.co$|twitter|x\.com/.test(h)) return 'X / Twitter';
  if (/google/.test(h)) return 'Google';
  if (/telegram|t\.me/.test(h)) return 'Telegram';
  return h || 'langsung / tidak diketahui (mis. dari WhatsApp atau link disalin)';
}

const bar = (p) => { const n = Math.round(p * 10); return '▰'.repeat(n) + '▱'.repeat(10 - n); };

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

  let b = req.body;
  if (typeof b === 'string') {
    if (b.length > MAX_BODY) return res.status(413).end();
    try { b = JSON.parse(b); } catch { return res.status(400).end(); }
  }
  if (!b || typeof b !== 'object') return res.status(400).end();

  const id = clean(b.id, 6).replace(/[^A-Z0-9]/gi, '').toUpperCase() || '----';
  const to = clean(b.to, 30), known = clean(b.known, 30);
  const name = to ? `<b>${esc(to)}</b>`
    : known ? `<b>${esc(known)}</b> <i>(dikenali: HP ini pernah buka link "${esc(known)}")</i>`
    : '<i>tanpa nama (link umum)</i>';
  const ua = clean(req.headers['user-agent'], 400);
  const dev = device(ua, { model: b.model, osv: b.osv });
  const now = new Date();

  let text;
  if (b.ev !== 'leave') {
    const dec = (v) => { try { return decodeURIComponent(v || ''); } catch { return v || ''; } };
    const city = dec(req.headers['x-vercel-ip-city']);
    const cc = clean(req.headers['x-vercel-ip-country'], 2).toUpperCase();
    const rc = clean(req.headers['x-vercel-ip-country-region'], 4).toUpperCase();
    const prov = cc === 'ID' ? (PROV_ID[rc] || rc) : rc;
    const place = [city, prov, cc && regionName(cc)].filter(Boolean).join(', ');
    const visits = num(b.visits, 99999) || 1;
    const first = b.first && !Number.isNaN(Date.parse(b.first)) ? new Date(b.first) : null;
    const mem = num(b.mem, 64), cores = num(b.cores, 256);
    const net = clean(b.net, 8);
    const lang = clean(b.lang, 20);

    text = [
      '🔔 <b>ADA YANG MEMBUKA WEB KAMU</b>',
      `🆔 <code>#${id}</code>`,
      '',
      block('👤 <b>SIAPA</b>', [
        ['Nama link', name],
        ['Kunjungan', visits > 1 ? `ke-${visits} dari HP/browser ini` : 'pertama kali dari HP/browser ini'],
        visits > 1 && first ? ['Pertama datang', esc(when(first))] : null,
      ]),
      '',
      block('🕒 <b>WAKTU</b>', [['Dibuka', `${esc(when(now))} WIB`]]),
      '',
      block('📱 <b>PERANGKAT</b>', [
        ['Perangkat', esc(dev.phone)],
        ['Sistem', esc(dev.os)],
        ['Dibuka lewat', esc(dev.app)],
        b.scr ? ['Layar', `${esc(clean(b.scr, 12))} · tema ${b.dark ? 'gelap 🌙' : 'terang ☀️'}`] : null,
        mem || cores ? ['Spesifikasi', [mem ? `RAM ${mem >= 8 ? '8 GB atau lebih' : `±${mem} GB`}` : '', cores ? `${cores} inti CPU` : ''].filter(Boolean).join(' · ')] : null,
        net ? ['Internet', `kecepatan setara ${esc(net.toUpperCase())}${b.save ? ' · mode hemat data' : ''}`] : null,
      ]),
      '',
      block('📍 <b>LOKASI</b> <i>(perkiraan dari jaringan, bisa meleset)</i>', [
        ['Daerah', place ? `${esc(place)} ${flag(cc)}` : 'tidak diketahui'],
      ]),
      '',
      block('🌐 <b>LAINNYA</b>', [
        ['Datang dari', esc(source(clean(b.ref, 300), ua))],
        lang ? ['Bahasa HP', esc(langName(lang))] : null,
        b.tz ? ['Zona waktu HP', esc(clean(b.tz, 40))] : null,
      ]),
    ];
  } else {
    const played = num(b.played, 36000), dur = num(b.dur, 36000), stay = num(b.stay, 86400);
    const lines = num(b.lines, 999), line = Math.min(num(b.line, 999), lines || 999);
    const p = dur ? Math.min(played / dur, 1) : 0;
    const tiktok = num(b.tiktok, 99);
    const status = !played ? '⏸ belum sempat memutar lagu'
      : b.done ? '✅ ditonton sampai habis'
      : `⏹ berhenti di ${mmss(b.at)}`;

    text = [
      '👋 <b>PENGUNJUNG SELESAI</b>',
      `🆔 <code>#${id}</code> · ${name}`,
      '',
      block('🎵 <b>CARA MENONTON</b>', [
        ['Status', status],
        played ? ['Total didengar', `${mmss(played)}${dur ? ` (lagu ${mmss(dur)})` : ''}`] : null,
        played && dur ? ['Progres', `<code>${bar(p)}</code> ${Math.round(p * 100)}%`] : null,
        lines && line ? ['Sampai foto & lirik', `ke-${line} dari ${lines}`] : null,
        played ? ['Di-pause', `${num(b.pauses, 999)}×`] : null,
        num(b.replays, 99) ? ['Diulang', `${num(b.replays, 99)}× 🔁`] : null,
        ['Lama di halaman', human(stay)],
      ]),
      '',
      block('🎯 <b>INTERAKSI</b>', [
        ['Tombol TikTok kamu', tiktok ? `✅ diklik${tiktok > 1 ? ` ${tiktok}×` : ''}` : '❌ tidak diklik'],
      ]),
      '',
      `📱 ${esc(dev.phone)} · ${esc(dev.app)}`,
      `🕒 ${esc(when(now))} WIB`,
    ];
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: text.join('\n').replace(/\n{3,}/g, '\n\n').trim(), parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    return res.status(r.ok ? 204 : 502).end();
  } catch {
    return res.status(502).end();
  }
}
