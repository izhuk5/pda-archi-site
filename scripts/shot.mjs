#!/usr/bin/env node
/* Скриншоты 1440 и 390 и замеры, которые видны только в браузере. Только встроенные модули Node и Google Chrome.
   Запуск из корня (аргументы npm передаются после --):
     npm run shot                                  главная (src/pages/index.astro)
     npm run shot -- hero                          только секция #hero
     npm run shot -- --page concepts/hero-a        концепт (src/pages/concepts/hero-a.astro)
   Как устроено: свой astro dev на свободном порту (уже запущенный npm run dev не мешает, панель разработчика скрыта),
   Chrome headless управляется через DevTools Protocol по pipe.
   Мобильная ширина – эмуляция устройства 390 (как в DevTools), а не iframe: окно Chrome уже ~500 px режет кадр, эмуляция – нет.
   Страница открывается с ?static (анимации выключены, всё видно). Длинная страница режется на куски по два экрана:
   desktop-1440.png, desktop-1440-2.png… – целиком такую картинку не прочитать глазами.
   Замеры: горизонтальный скролл на 390 и виновники, висячие строки (одно слово в последней строке), ошибки консоли и сети.
   Выход 1, если есть горизонтальный скролл или ошибки. Файлы – scripts/out/. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const OUT = path.join(ROOT, 'scripts', 'out');
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900, mobile: false },
  { name: 'mobile-390', width: 390, height: 844, mobile: true },
];
const TILE_SCREENS = 2;

/* --- аргументы ------------------------------------------------------------ */
const args = process.argv.slice(2);
let pagePath = '/';
let sectionId = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--page') pagePath = '/' + args[++i].replace(/^\/+|\.astro$/g, '').replace(/(^|\/)index$/, '');
  else sectionId = args[i];
}
const prefix = pagePath === '/' ? '' : `${path.basename(pagePath)}-`;

/* Остановить astro dev со всеми его дочерними процессами (группа процессов = pid со знаком минус) */
const stopAstro = proc => { try { process.kill(-proc.pid, 'SIGTERM'); } catch { /* уже остановлен */ } };

/* astro dev на свободном порту; готов, когда отвечает по HTTP */
const freePort = () => new Promise(resolve => {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
});
const startAstro = async () => {
  const port = await freePort();
  /* --ignore-lock: свой экземпляр рядом с уже запущенным npm run dev. detached: своя группа процессов – astro перезапускает себя
     дочерним процессом, и гасить нужно всю группу, иначе сервер остаётся висеть сиротой */
  const proc = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs'), 'dev', '--port', String(port), '--host', '127.0.0.1', '--ignore-lock'],
    { cwd: ROOT, env: { ...process.env, SHOT: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  proc.stdout.on('data', d => { log += d; });
  proc.stderr.on('data', d => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let t = 0; t < 150; t++) {
    if (proc.exitCode !== null) throw new Error(`astro dev не запустился (npm install сделан?):\n${log}`);
    try { await fetch(base + '/'); return { proc, base }; } catch { /* ещё не слушает */ }
    await new Promise(r => setTimeout(r, 200));
  }
  stopAstro(proc);
  throw new Error(`astro dev не ответил за 30 s:\n${log}`);
};

const findChrome = () => {
  if (process.env.CHROME) return process.env.CHROME;
  const candidates = {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
    win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
  }[process.platform] || [];
  return candidates.find(p => fs.existsSync(p));
};

/* --- DevTools Protocol по pipe: сообщения JSON, разделённые \0 ------------- */
const connect = (proc) => {
  let seq = 0, buf = '';
  const pending = new Map();
  const listeners = new Set();
  proc.stdio[4].setEncoding('utf8');
  proc.stdio[4].on('data', chunk => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\0')) >= 0) {
      const msg = JSON.parse(buf.slice(0, i));
      buf = buf.slice(i + 1);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject, method } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result);
      } else listeners.forEach(fn => fn(msg));
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, method });
    proc.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }) + '\0');
  });
  const once = (method, sessionId, ms = 15000) => new Promise(resolve => {
    const fn = msg => { if (msg.method === method && msg.sessionId === sessionId) { listeners.delete(fn); resolve(msg.params); } };
    listeners.add(fn);
    setTimeout(() => { listeners.delete(fn); resolve(null); }, ms);
  });
  return { send, once, listeners };
};

/* --- то, что выполняется в странице ---------------------------------------- */
const SETTLE = `(async () => {
  document.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
  await document.fonts.ready;
  const wait = img => new Promise(r => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); setTimeout(r, 5000); });
  await Promise.all([...document.images].filter(img => !img.complete).map(wait));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
})()`;

const MEASURE = (id) => `(() => {
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].slice(0, 2).map(c => '.' + c).join('');
  const where = el => { const s = el.closest('section[id]'); return s ? ' в #' + s.id : ''; };
  const doc = document.documentElement;
  const cw = doc.clientWidth;

  /* Горизонтальный скролл: элементы, вылезающие за ширину окна (overflow-x: clip у body прячет симптом, а не причину) */
  const offenders = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right > cw + 0.5 || r.left < -0.5) {
      if (offenders.some(o => o.el.contains(el))) continue;
      offenders.push({ el, text: name(el) + where(el) + ': ' + Math.round(r.left) + '…' + Math.round(r.right) + ' px при ширине ' + cw });
    }
  }

  /* Висячие строки: в последней строке блока одно слово */
  const widows = [];
  const blocks = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, figcaption, blockquote, dt, dd');
  for (const el of blocks) {
    if (el.closest('.visually-hidden, [aria-hidden="true"]')) continue;
    if (el.querySelector('p, li, h1, h2, h3, h4, h5, h6, ul, ol, div')) continue;
    const words = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      for (const m of node.data.matchAll(/\\S+/g)) {
        const range = document.createRange();
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const rect = range.getClientRects()[0];
        if (rect) words.push({ word: m[0], top: rect.top });
      }
    }
    if (words.length < 2) continue;
    const lines = [];
    for (const w of words) {
      const line = lines.find(l => Math.abs(l.top - w.top) < 4);
      line ? line.words.push(w.word) : lines.push({ top: w.top, words: [w.word] });
    }
    const last = lines.sort((a, b) => a.top - b.top).at(-1);
    if (lines.length > 1 && last.words.length === 1) widows.push(name(el) + where(el) + ': «…' + lines.at(-2).words.slice(-2).join(' ') + ' / ' + last.words[0] + '»');
  }

  const section = ${JSON.stringify(id)} ? document.getElementById(${JSON.stringify(id)}) : null;
  const sr = section && section.getBoundingClientRect();
  return {
    scrollWidth: doc.scrollWidth, clientWidth: cw, height: doc.scrollHeight,
    offenders: offenders.map(o => o.text), widows,
    section: ${JSON.stringify(id)} ? (sr ? { top: sr.top + scrollY, height: sr.height } : 'missing') : null,
  };
})()`;

/* --- съёмка ---------------------------------------------------------------- */
const main = async () => {
  const chrome = findChrome();
  if (!chrome) { console.error('Chrome не найден: укажи путь в переменной CHROME'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });

  const { proc: astro, base } = await startAstro();
  const probe = await fetch(base + pagePath);
  if (probe.status === 404) { stopAstro(astro); console.error(`нет страницы ${pagePath} (файл в src/pages/)`); process.exit(1); }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-chrome-'));
  const proc = spawn(chrome, [
    '--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });

  /* Chrome ещё дописывает профиль после kill – удаление с повторами, иначе ENOTEMPTY */
  const cleanup = () => { proc.kill(); stopAstro(astro); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); };
  const killer = setTimeout(() => { console.error('таймаут 120 s'); cleanup(); process.exit(1); }, 120000);

  let problems = 0;
  try {
    const { send, once, listeners } = connect(proc);
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const s = (method, params) => send(method, params, sessionId);

    /* Ошибки консоли и сети собираются за всё время открытия страницы */
    let errors = [];
    listeners.add(msg => {
      if (msg.sessionId !== sessionId) return;
      const p = msg.params;
      if (msg.method === 'Runtime.exceptionThrown') errors.push('исключение: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0]);
      if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(p.type)) errors.push(`console.${p.type}: ` + p.args.map(a => a.value ?? a.description ?? '').join(' '));
      /* favicon.ico Chrome запрашивает сам, даже если иконки нет – не ошибка страницы */
      if (msg.method === 'Network.responseReceived' && p.response.status >= 400 && !p.response.url.endsWith('/favicon.ico')) errors.push(`${p.response.status}: ${p.response.url}`);
      if (msg.method === 'Network.loadingFailed' && !p.canceled) errors.push(`не загрузилось (${p.errorText}): ${p.requestId}`);
    });
    await Promise.all(['Page.enable', 'Runtime.enable', 'Network.enable'].map(m => s(m)));

    const url = `${base}${pagePath}?static`;
    console.log(`страница: ${pagePath}${sectionId ? ' #' + sectionId : ''}`);

    for (const vp of VIEWPORTS) {
      errors = [];
      await s('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
      const loaded = once('Page.loadEventFired', sessionId);
      await s('Page.navigate', { url });
      await loaded;
      await s('Runtime.evaluate', { expression: SETTLE, awaitPromise: true });
      const { result } = await s('Runtime.evaluate', { expression: MEASURE(sectionId), returnByValue: true });
      const m = result.value;

      if (m.section === 'missing') { console.error(`  нет секции id="${sectionId}"`); problems++; break; }
      const top = m.section ? m.section.top : 0;
      const total = Math.ceil(m.section ? m.section.height : m.height);
      const tileH = vp.height * TILE_SCREENS;

      /* Старые куски этого вида удаляются, чтобы не смотреть на устаревший кадр */
      const base = `${prefix}${vp.name}`;
      fs.readdirSync(OUT).filter(f => f === `${base}.png` || new RegExp(`^${base}-\\d+\\.png$`).test(f)).forEach(f => fs.rmSync(path.join(OUT, f)));

      const files = [];
      for (let y = 0, n = 1; y < total; y += tileH, n++) {
        const clip = { x: 0, y: top + y, width: vp.width, height: Math.min(tileH, total - y), scale: 1 };
        const { data } = await s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
        const file = `${base}${n > 1 ? '-' + n : ''}.png`;
        fs.writeFileSync(path.join(OUT, file), Buffer.from(data, 'base64'));
        files.push(file);
      }

      console.log(`\n${vp.name}: ${files.length} файл(ов) – ${files.join(', ')} (высота ${total} px)`);
      const overflow = m.scrollWidth > m.clientWidth || m.offenders.length;
      console.log(`  горизонтальный скролл: ${overflow ? `ЕСТЬ (scrollWidth ${m.scrollWidth} > ${m.clientWidth})` : 'нет'}`);
      m.offenders.slice(0, 10).forEach(t => console.log(`    ${t}`));
      if (overflow) problems++;
      console.log(`  висячие строки: ${m.widows.length}`);
      m.widows.forEach(t => console.log(`    ${t}`));
      console.log(`  ошибки консоли и сети: ${errors.length}`);
      errors.forEach(t => console.log(`    ${t}`));
      problems += errors.length;
    }
  } finally {
    clearTimeout(killer);
    cleanup();
  }
  console.log(`\nпапка: scripts/out/  замечаний, ломающих проверку: ${problems}`);
  process.exit(problems ? 1 : 0);
};

main().catch(err => { console.error(err.message); process.exit(1); });
