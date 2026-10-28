// Builds the deployable site into dist/:
//  - the page script is obfuscated, locked to the domains in config.json,
//    and gets the song/lyric/photo timing embedded (sync-source.js is not shipped)
//  - HTML and CSS are minified
//  - photos get a faint watermark + copyright metadata (build/watermark.py)
//  - robots.txt, headers and license notice are added
// Run: npm run dist
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { minify } from 'html-minifier-terser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(root, 'build/config.json'), 'utf8'));
const out = path.join(root, 'dist');
const assets = path.join(root, 'about-u');
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'about-u'), { recursive: true });

/* ---- 1. timing data, parsed the same way the page does ---- */
const syncSrc = await readFile(path.join(assets, 'sync-source.js'), 'utf8');
const block = syncSrc.match(/syncData\s*=\s*\[([\s\S]*?)\];/);
if (!block) throw new Error('syncData not found in about-u/sync-source.js');
const re = /\{\s*time:\s*([\d.]+)\s*,\s*text:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*,\s*img:\s*["']([^"']+)["']\s*\}/g;
const lines = [];
for (const m of block[1].matchAll(re)) {
  const raw = m[2];
  const text = raw[0] === '"' ? JSON.parse(raw) : raw.slice(1, -1).replace(/\\'/g, "'");
  lines.push({ t: +m[1], text, img: m[3] });
}
lines.sort((a, b) => a.t - b.t);
const imgs = [...new Set(lines.map((l) => l.img))];
for (const l of lines) l.photo = imgs.indexOf(l.img);
console.log(`timing: ${lines.length} lines, ${imgs.length} photos`);

/* ---- 2. page ---- */
let html = await readFile(path.join(root, 'src/index.html'), 'utf8');
html = html.replaceAll('../about-u/', 'about-u/');
const mod = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!mod) throw new Error('module script not found in src/index.html');
const js = `const __SYNC_DATA__ = ${JSON.stringify({ lines, imgs })};\n${mod[1]}`;
const obf = JavaScriptObfuscator.obfuscate(js, {
  target: 'browser',
  sourceType: 'module',
  compact: true,
  selfDefending: true,                  // breaks if someone pretty-prints and edits it
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: true,                  // safe: it's an ES module, nothing outside reads these names
  stringArray: true,                    // shaders, text and data become an encoded table
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.9,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersType: 'function',
  transformObjectKeys: true,
  disableConsoleOutput: true,
  domainLock: cfg.domains,              // stops working when copied to another domain
  domainLockRedirectUrl: cfg.redirect,
  // kept off on purpose: these slow down the 60 fps render loop on phones
  controlFlowFlattening: false,
  deadCodeInjection: false,
  numbersToExpressions: false,
  splitStrings: false,
  debugProtection: false,
}).getObfuscatedCode();
html = html.replace(mod[0], () => `<script type="module">${obf}</script>`);
html = await minify(html, {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  minifyJS: false,
  removeRedundantAttributes: true,
});
html = html.replace(/^<!doctype html>/i, `<!doctype html><!-- ${cfg.copyright} Copying, reuse or redistribution of this code, design, photos or text is not permitted. -->`);
await writeFile(path.join(out, 'index.html'), html);
console.log(`index.html: ${(html.length / 1024).toFixed(0)} KB`);

/* ---- 3. assets ---- */
await copyFile(path.join(assets, 'lagu.mp3'), path.join(out, 'about-u/lagu.mp3'));
execFileSync('python', ['-I', path.join(root, 'build/watermark.py'), assets, path.join(out, 'about-u'),
  cfg.watermark, cfg.copyright, 'album.jpg', ...imgs], { stdio: 'inherit' });

/* ---- 4. crawler rules, headers, notice ---- */
const aiBots = ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'Google-Extended', 'CCBot', 'PerplexityBot', 'Perplexity-User', 'Bytespider', 'Applebot-Extended', 'meta-externalagent',
  'FacebookBot', 'Amazonbot', 'cohere-ai', 'Diffbot', 'ImagesiftBot', 'Omgilibot', 'YouBot', 'Timpibot', 'img2dataset'];
await writeFile(path.join(out, 'robots.txt'),
  aiBots.map((b) => `User-agent: ${b}\nDisallow: /\n`).join('\n') + '\nUser-agent: *\nDisallow: /about-u/\nAllow: /\n');
// Netlify reads this file; Vercel uses vercel.json (same rules)
await writeFile(path.join(out, '_headers'),
  '/*\n  X-Robots-Tag: noai, noimageai\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n' +
  '/about-u/*\n  Cross-Origin-Resource-Policy: same-origin\n');
await writeFile(path.join(out, 'LICENSE.txt'), await readFile(path.join(root, 'LICENSE'), 'utf8'));
console.log('dist ready');
