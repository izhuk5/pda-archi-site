#!/usr/bin/env node
/* Линтер правил CLAUDE.md. Только Node, без npm. Запуск из корня: npm run check (то же, что node scripts/check.mjs)
   Проверяет index.html, concepts/*.html (их <style> тоже), styles/*.css, js/*.js и сверяет документацию с кодом.
   Сырые значения допустимы только внутри :root { } – это tokens.css и токены концепта. Выход 1, если есть замечания.
   Категории:
     raw     сырые значения вне токенов: цвет, размер, длительность, easing, вес, интерлиньяж, z-index, !important
     token   var(--x), которого нет ни в токенах, ни в файле
     type    размер текста или гарнитура в правиле секции, капс, моноширинный шрифт
     spacer  пустые элементы-распорки, двойной <br>
     hidden  атрибут hidden, display: none в разметке, закомментированная разметка
     text    длинное тире, точка-разделитель, lorem ipsum, капс в тексте
     media   <img> без alt / width+height / loading, <video> с src вместо data-src
     motion  data-reveal вне реестра; реестр в js/motion.js и docs/motion.md расходится
     docs    токены в tokens.css и docs/design-system.md расходятся
     map     id секций не по карте
     scene   на странице есть сцена, а в scene.js остался SMOKE_TEST */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = p => path.relative(ROOT, p);
const read = p => fs.readFileSync(p, 'utf8');
const exists = p => fs.existsSync(p);
const list = (dir, ext) => (exists(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort().map(f => path.join(dir, f)) : []);

const issues = [];
const add = (cat, file, line, msg) => issues.push({ cat, file: rel(file), line, msg });

/* Номер строки по позиции в исходном тексте. Комментарии не вырезаются, а забиваются пробелами с сохранением переносов –
   поэтому позиции совпадают с файлом и номер строки всегда верный */
const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const blank = (text, re) => text.replace(re, m => m.replace(/[^\n]/g, ' '));
const short = s => s.replace(/\s+/g, ' ').trim().slice(0, 90);

/* --- CSS ------------------------------------------------------------------ */
const UNITS = 'px|rem|em|vw|vh|dvh|svh|lvh|vmin|vmax|ch|ex|cap|lh|rlh|cm|mm|in|pt|pc|q';
const SIZE = new RegExp(`(?<![\\w.])-?(\\d*\\.?\\d+)(${UNITS})\\b`, 'gi');
const VIEWPORT = /^(vw|vh|dvh|svh|lvh)$/i;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|oklch|oklab|lch|lab|color)\(/i;
const NAMED = /\b(?:white|black|red|green|blue|gray|grey|silver|yellow|orange|purple|pink|brown|navy|teal|cyan|magenta)\b/i;
const COLOR_PROP = /color|background|border|outline|fill|stroke|shadow|caret|accent|text-decoration/i;
const MONO = /monospace|\bmono\b|courier|consolas|menlo/i;

/* Зоны :root { … } – там живут токены. Возвращает [начало, конец] позиций */
const rootZones = (css) => {
  const zones = [];
  for (const m of css.matchAll(/:root\b[^{]*\{/g)) {
    let depth = 1, i = m.index + m[0].length;
    for (; i < css.length && depth; i++) { if (css[i] === '{') depth++; if (css[i] === '}') depth--; }
    zones.push([m.index, i]);
  }
  return zones;
};
const declaredProps = css => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));

const TOKENS_FILE = path.join(ROOT, 'styles', 'tokens.css');
const globalTokens = exists(TOKENS_FILE) ? declaredProps(blank(read(TOKENS_FILE), /\/\*[\s\S]*?\*\//g)) : new Set();

/* css – текст стилей, fileText – весь файл (для номера строки), offset – где css начинается в файле */
const lintCss = (file, css, { fileText = css, offset = 0, sectionRules = false, known = globalTokens } = {}) => {
  const clean = blank(blank(blank(css, /\/\*[\s\S]*?\*\//g), /url\([^)]*\)/g), /"[^"\n]*"|'[^'\n]*'/g);
  const zones = rootZones(clean);
  const inRoot = i => zones.some(([a, b]) => i >= a && i < b);
  const tokens = new Set([...known, ...declaredProps(clean)]);
  const at = i => lineAt(fileText, offset + i);

  /* Декларация: свойство: значение, заканчивается на ; или }. Селекторы вида a:hover { сюда не попадают */
  for (const m of clean.matchAll(/([\w-]+)\s*:\s*([^;{}]+?)\s*(?=;|\})/g)) {
    const [, prop, value] = m;
    const i = m.index;
    const line = at(i);
    const decl = short(`${prop}: ${value}`);
    const p = prop.toLowerCase();

    /* Капс, моно и smooth запрещены везде, включая токены */
    if (p === 'text-transform' && /uppercase/i.test(value)) add('type', file, line, `капс запрещён: ${decl}`);
    if (p === 'font-variant' || p === 'font-variant-caps') { if (/caps/i.test(value)) add('type', file, line, `капс запрещён: ${decl}`); }
    if ((p === 'font-family' || p.startsWith('--font')) && MONO.test(value)) add('type', file, line, `моноширинный шрифт запрещён: ${decl}`);
    if (p === 'scroll-behavior' && /smooth/i.test(value)) add('raw', file, line, 'scroll-behavior: smooth ломает съёмку и Lenis');

    /* Использование токенов: var(--x) должен существовать */
    for (const v of value.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
      if (!tokens.has(v[1]) && !v[2]) add('token', file, line, `${v[1]} не объявлен – опечатка? Если его ставит JS – var(${v[1]}, 0)`);
    }

    if (inRoot(i)) continue;

    if (/!important/.test(value)) add('raw', file, line, `!important – признак конфликта, разобраться: ${decl}`);
    if (HEX.test(value) || COLOR_FN.test(value)) add('raw', file, line, `цвет числом, нужен токен: ${decl}`);
    else if (COLOR_PROP.test(p) && NAMED.test(value)) add('raw', file, line, `цвет словом, нужен токен: ${decl}`);
    if (/cubic-bezier\(|steps\(|linear\(/i.test(value)) add('raw', file, line, `easing числом, нужен --ease-*: ${decl}`);
    if (/^(transition|animation)/.test(p) && /(?<![\w.-])(?!0m?s\b)\d*\.?\d+m?s\b/.test(value)) add('raw', file, line, `длительность числом, нужен --dur-*: ${decl}`);
    if (p === 'font-weight' && !/var\(/.test(value)) add('raw', file, line, `вес шрифта числом, нужен --fw-*: ${decl}`);
    if (p === 'line-height' && /^\d*\.?\d+$/.test(value)) add('raw', file, line, `интерлиньяж числом, нужен --lh-*: ${decl}`);
    if (p === 'z-index' && /^-?\d+$/.test(value) && !/^-?[01]$/.test(value)) add('raw', file, line, `z-index числом, нужен --z-*: ${decl}`);
    if (p !== 'clip') {
      for (const s of value.matchAll(SIZE)) {
        const [whole, num, unit] = s;
        const n = Math.abs(parseFloat(num));
        if (n === 0 || (n === 1 && unit === 'px') || (n === 100 && VIEWPORT.test(unit))) continue;
        add('raw', file, line, `размер числом (${whole}), нужен токен: ${decl}`);
      }
    }
    if (sectionRules && p === 'font-size') add('type', file, line, `размер текста в правиле, нужен класс шкалы: ${decl}`);
    if (sectionRules && p === 'font-family') add('type', file, line, `гарнитура в правиле, только через класс шкалы: ${decl}`);
  }
};

for (const file of list(path.join(ROOT, 'styles'), '.css')) {
  const name = path.basename(file);
  lintCss(file, read(file), { sectionRules: name === 'sections.css' || name === 'components.css' });
}

/* --- JS ------------------------------------------------------------------- */
for (const file of list(path.join(ROOT, 'js'), '.js')) {
  const text = read(file);
  const clean = blank(blank(text, /\/\*[\s\S]*?\*\//g), /(^|[^:'"`\\])\/\/[^\n]*/g);
  for (const m of clean.matchAll(/['"`]\s*(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|oklch)\([^'"`]*\))\s*['"`]/g)) {
    add('raw', file, lineAt(text, m.index), `цвет в JS (${m[1]}) – читать токен: css('--color-…')`);
  }
  for (const m of clean.matchAll(/cubic-bezier\(\s*[\d.]/g)) add('raw', file, lineAt(text, m.index), 'easing числом в JS – токен --ease-* через CustomEase (js/motion.js)');
}

/* --- HTML ----------------------------------------------------------------- */
const motionJs = path.join(ROOT, 'js', 'motion.js');
const presetsBlock = exists(motionJs) ? (read(motionJs).split('export const PRESETS')[1] || '') : '';
const presets = new Set([...presetsBlock.matchAll(/^\s+'([a-z-]+)':/gm)].map(m => m[1]));

const lintHtml = (file) => {
  const text = read(file);
  /* Для поиска по разметке: комментарии, скрипты и стили забиты пробелами, позиции сохранены */
  const noComments = blank(text, /<!--[\s\S]*?-->/g);
  const markup = blank(noComments, /(<(script|style)\b[^>]*>)[\s\S]*?(?=<\/\2>)/gi);
  const at = i => lineAt(text, i);

  /* Стили внутри <style>: свои :root-токены концепта плюс общие токены, если файл их подключает */
  const linksTokens = /tokens\.css/.test(text);
  for (const m of noComments.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    lintCss(file, m[1], { fileText: text, offset: m.index + m[0].indexOf('>') + 1, known: linksTokens ? globalTokens : new Set() });
  }

  for (const m of markup.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const [, tag, attrs] = m;
    const t = tag.toLowerCase();
    const line = at(m.index);
    if (/(^|\s)hidden(?=[\s=/]|$)/.test(attrs)) add('hidden', file, line, `атрибут hidden – блок «на потом»?: <${tag} ${short(attrs)}>`);
    const style = /\sstyle\s*=\s*"([^"]*)"/i.exec(attrs);
    if (style) {
      if (/display\s*:\s*none/i.test(style[1])) add('hidden', file, line, `display: none в разметке – блок «на потом»?: ${short(style[1])}`);
      lintCss(file, `x{${style[1]}}`, { fileText: text, offset: m.index });
    }
    if (t === 'img') {
      if (!/\salt\s*=/.test(attrs)) add('media', file, line, '<img> без alt (декор – alt="")');
      if (!/\swidth\s*=/.test(attrs) || !/\sheight\s*=/.test(attrs)) add('media', file, line, '<img> без width и height – страница прыгает при загрузке');
      if (!/\sloading\s*=/.test(attrs)) add('media', file, line, '<img> без loading: lazy ниже первого экрана, eager в первом');
    }
    if (t === 'video' && /\ssrc\s*=/.test(attrs)) add('media', file, line, '<video src> – только data-src + preload="none", src ставит main.js');
    for (const r of attrs.matchAll(/data-reveal\s*=\s*"([^"]+)"/g)) {
      if (!presets.has(r[1])) add('motion', file, line, `data-reveal="${r[1]}" нет в реестре js/motion.js / docs/motion.md`);
    }
  }

  /* Распорки: div/span/p, внутри которых ничего нет. Декор помечается data-decor="…" и записывается в базе */
  for (const m of markup.matchAll(/<(div|span|p)\b([^>]*)>(?:\s|&nbsp;|&#160;)*<\/\1\s*>/gi)) {
    if (/\s(role|aria-label|aria-labelledby|data-[\w-]+)\s*=/.test(m[2])) continue;
    add('spacer', file, at(m.index), `пустой элемент: ${short(m[0])} (декор – data-decor="что это" и строка в базе)`);
  }
  for (const m of markup.matchAll(/(?:<br\s*\/?>\s*){2,}/gi)) add('spacer', file, at(m.index), 'двойной <br> – отступ через margin/gap');

  /* Закомментированная разметка (кроме заглавного комментария в <main> заготовки) */
  for (const m of text.matchAll(/<!--([\s\S]*?)-->/g)) {
    if (/<(section|div|ul|ol|li|p|h[1-6]|img|video|span|a|button|svg|figure)\b/.test(m[1]) && !m[1].includes('Секции появляются здесь')) {
      add('hidden', file, at(m.index), 'закомментированная разметка – удалить');
    }
  }

  /* Текст: только видимый текст между тегами */
  for (const m of markup.matchAll(/>([^<]+)</g)) {
    const s = m[1];
    const i = m.index + 1;
    if (s.includes('—')) add('text', file, at(i + s.indexOf('—')), 'длинное тире «—», только короткое «–»');
    if (/\s·\s/.test(s) || /&middot;/.test(s)) add('text', file, at(i), `точка-разделитель «·» запрещена: ${short(s)}`);
    if (/lorem\s+ipsum/i.test(s)) add('text', file, at(i), 'lorem ipsum');
    /* Два и больше слов капсом подряд; \b в JS не понимает кириллицу, поэтому границы через \p{L} */
    const caps = /(?<!\p{L})\p{Lu}{2,}(?:[\s,]+\p{Lu}{2,})+(?!\p{L})/u.exec(s);
    if (caps) add('text', file, at(i + caps.index), `капс в тексте: «${caps[0]}» – обычный регистр`);
  }
  return { text, markup };
};

const indexFile = path.join(ROOT, 'index.html');
const { text: indexText, markup: indexMarkup } = lintHtml(indexFile);
for (const file of list(path.join(ROOT, 'concepts'), '.html')) lintHtml(file);

/* --- Документация против кода ---------------------------------------------- */
const motionMd = path.join(ROOT, 'docs', 'motion.md');
if (exists(motionMd)) {
  const registry = read(motionMd).split('## Реестр `data-reveal`')[1] || '';
  const documented = new Set([...registry.split('\n## ')[0].matchAll(/^\|\s*`([a-z-]+)`\s*\|/gm)].map(m => m[1]));
  for (const p of presets) if (!documented.has(p)) add('motion', motionJs, 0, `приём «${p}» есть в коде, но не описан в docs/motion.md`);
  for (const d of documented) if (!presets.has(d)) add('motion', motionMd, 0, `приём «${d}» описан, но нет в js/motion.js`);
}

const ds = path.join(ROOT, 'docs', 'design-system.md');
const dsText = exists(ds) ? read(ds) : '';
if (dsText) {
  /* Токен считается описанным, если в базе есть его имя или группа вида `--space-*` */
  const named = new Set([...dsText.matchAll(/`(--[\w-]+)`/g)].map(m => m[1]));
  const groups = [...dsText.matchAll(/`(--[\w-]+-)\*`/g)].map(m => m[1]);
  for (const t of globalTokens) {
    if (!named.has(t) && !groups.some(g => t.startsWith(g))) add('docs', TOKENS_FILE, 0, `${t} есть в tokens.css, но не описан в docs/design-system.md → Токены`);
  }
  for (const t of named) if (!globalTokens.has(t)) add('docs', ds, 0, `${t} описан в базе, но его нет в tokens.css`);
}

/* --- Карта секций ------------------------------------------------------------ */
const idsHtml = [...indexMarkup.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
const mapIds = [];
const mapPart = (dsText.split('## Карта секций')[1] || '').split('\n## ')[0];
for (const row of mapPart.split('\n')) {
  const cells = row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim().replace(/`/g, ''));
  if (cells.length >= 2 && /^\d+$/.test(cells[0])) mapIds.push(cells[1]);
}
for (const id of idsHtml) if (!mapIds.includes(id)) add('map', indexFile, 0, `секция id="${id}" не записана в карте секций docs/design-system.md`);
if (idsHtml.length) for (const id of mapIds) if (id && !idsHtml.includes(id)) add('map', ds, 0, `секция «${id}» есть в карте, но не в index.html (статус в карте – концепт?)`);

/* --- Сцена -------------------------------------------------------------------- */
const sceneJs = path.join(ROOT, 'js', 'scene.js');
if (/<[^>]*\sdata-scene\b/.test(indexMarkup) && exists(sceneJs) && read(sceneJs).includes('SMOKE_TEST')) {
  add('scene', sceneJs, 0, 'на странице есть [data-scene], а в scene.js остался тестовый объект SMOKE_TEST');
}

/* --- Отчёт ------------------------------------------------------------------- */
if (!issues.length) { console.log('check: 0 замечаний'); process.exit(0); }
const byCat = Map.groupBy(issues, i => i.cat);
for (const [cat, items] of byCat) {
  console.log(`\n[${cat}] ${items.length}`);
  for (const { file, line, msg } of items) console.log(`  ${file}${line ? ':' + line : ''}  ${msg}`);
}
console.log(`\nвсего: ${issues.length}`);
process.exit(1);
