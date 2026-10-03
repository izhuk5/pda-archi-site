#!/usr/bin/env node
/* Линтер правил CLAUDE.md. Только встроенные модули Node. Запуск из корня: npm run check
   Проверяет все .astro в src/ (разметку, <script>, frontmatter), CSS (src/styles/, Name.css секций и компонентов),
   JS (src/lib/, Name.js секций и компонентов) и сверяет документацию с кодом.
   Сырые значения допустимы только внутри :root { } – это tokens.css и токены концепта (src/pages/concepts/). Выход 1, если есть замечания.
   Категории:
     raw     сырые значения вне токенов: цвет, размер, длительность, easing, вес, интерлиньяж, z-index, !important
     token   var(--x), которого нет ни в токенах, ни в файле
     type    размер текста или гарнитура в правиле секции, капс, моноширинный шрифт
     spacer  пустые элементы-распорки, двойной <br>
     hidden  атрибут hidden, display: none в разметке, закомментированная разметка
     text    длинное тире, точка-разделитель, lorem ipsum, капс в тексте
     media   <img> вместо <Image> из astro:assets, <Image> без alt, <video> с src вместо data-src
     motion  data-reveal вне реестра; реестр в src/js/motion.js и docs/motion.md расходится
     docs    токены в tokens.css и docs/design-system.md расходятся
     map     id секций не по карте, секция не подключена на главной
     scene   на странице есть сцена, а в scene.js остался SMOKE_TEST
     structure  секция и компонент – папка Name/ с Name.astro + Name.css + Name.js: файлы подключены, классы с префиксом блока,
                GSAP только из @lib/gsap.js, своё движение – через onMotion(), импорты между папками – через алиасы (@lib/…)
     naming  имена классов – только kebab-case: hero-title, is-dark; без __, --, _ и заглавных
     responsive  desktop-first: база – десктоп, уже – только @media (max-width: 1023px | 767px | 478px) по убыванию, min-width не используется
     docs    также: docs/libraries.md против src/lib/gsap.js (плагины ✅) и package.json (пакеты) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = p => path.relative(ROOT, p);
const read = p => fs.readFileSync(p, 'utf8');
const exists = p => fs.existsSync(p);

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

/* Брейкпоинты desktop-first, как в Webflow, но планшет до 1024: база – desktop (от 1024), 1023 – tablet, 767 – mobile landscape,
   478 – mobile portrait. CSS-переменная в @media не работает, поэтому шкала – здесь; те же значения – CLAUDE.md и design-system.md */
const BREAKPOINTS = ['1023px', '767px', '478px'];

const TOKENS_FILE = path.join(ROOT, 'src', 'styles', 'tokens.css');
const globalTokens = exists(TOKENS_FILE) ? declaredProps(blank(read(TOKENS_FILE), /\/\*[\s\S]*?\*\//g)) : new Set();

/* css – текст стилей, fileText – весь файл (для номера строки), offset – где css начинается в файле */
const lintCss = (file, css, { fileText = css, offset = 0, sectionRules = false, known = globalTokens } = {}) => {
  const clean = blank(blank(blank(css, /\/\*[\s\S]*?\*\//g), /url\([^)]*\)/g), /"[^"\n]*"|'[^'\n]*'/g);
  const zones = rootZones(clean);
  const inRoot = i => zones.some(([a, b]) => i >= a && i < b);
  const tokens = new Set([...known, ...declaredProps(clean)]);
  const at = i => lineAt(fileText, offset + i);

  /* Desktop-first: база – десктоп, уже – только max-width из BREAKPOINTS, по убыванию (1023 → 767 → 478):
     при одинаковой специфичности побеждает правило ниже по файлу, и узкий брейкпоинт выше широкого перебивается */
  let lastBp = Infinity;
  for (const m of clean.matchAll(/@media\s*([^{]+)\{/g)) {
    const q = m[1];
    if (/min-width|width\s*>|<\s*width/.test(q)) add('responsive', file, at(m.index), `desktop-first: только max-width, база – десктоп: @media ${short(q)}`);
    for (const w of q.matchAll(/(?:max-width\s*:|width\s*<=?)\s*([\d.]+[a-z]+)/g)) {
      if (!BREAKPOINTS.includes(w[1])) { add('responsive', file, at(m.index), `брейкпоинт ${w[1]} не из шкалы (${BREAKPOINTS.join(', ')})`); continue; }
      const v = parseFloat(w[1]);
      if (v > lastBp) add('responsive', file, at(m.index), `@media (max-width: ${w[1]}) ниже более узкого – порядок по убыванию: ${BREAKPOINTS.join(' → ')}`);
      lastBp = v;
    }
  }

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

const SRC = path.join(ROOT, 'src');
const walk = (dir, ext) => (exists(dir) ? fs.readdirSync(dir, { recursive: true }).map(String).filter(f => f.endsWith(ext)).sort().map(f => path.join(dir, f)) : []);

/* --- CSS --------------------------------------------------------------------- */
for (const file of walk(path.join(SRC, 'styles'), '.css')) lintCss(file, read(file));

/* Секции и компоненты: папка Name/ с Name.astro, Name.css, Name.js. Их CSS глобальный (Astro его не скоупит),
   поэтому каждое правило обязано содержать класс блока или его продолжение: .hero, .hero-title, .hero.is-dark – иначе стили протекают в чужие секции */
const UNITS_DIRS = ['sections', 'components'].map(d => path.join(SRC, d));
const kebab = name => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const blockCss = (file) => {
  const text = read(file);
  const block = kebab(path.basename(file, '.css'));
  const blockRe = new RegExp(`\\.${block}(?:-[a-z0-9]+)*(?![\\w-])`);
  const clean = blank(blank(text, /\/\*[\s\S]*?\*\//g), /"[^"\n]*"|'[^'\n]*'/g);
  for (const m of clean.matchAll(/([^{};]+)\{/g)) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith('@') || /^(from|to|\d+(\.\d+)?%)(\s*,\s*(from|to|\d+(\.\d+)?%))*$/.test(sel)) continue;
    const at = lineAt(text, m.index + m[0].length - m[1].trimStart().length - 1);
    if (/:root\b/.test(sel)) { add('structure', file, at, 'токены только в src/styles/tokens.css, не в стилях секции'); continue; }
    for (const one of sel.split(',')) {
      if (!blockRe.test(one)) add('structure', file, at, `селектор без класса блока .${block} или .${block}-…: ${short(one)}`);
    }
  }
  lintCss(file, text, { sectionRules: true });
};
for (const dir of UNITS_DIRS) for (const file of walk(dir, '.css')) blockCss(file);

/* --- JS ----------------------------------------------------------------------- */
const lintJs = (file, js, { fileText = js, offset = 0 } = {}) => {
  const clean = blank(blank(js, /\/\*[\s\S]*?\*\//g), /(^|[^:'"`\\])\/\/[^\n]*/g);
  const at = i => lineAt(fileText, offset + i);
  for (const m of clean.matchAll(/['"`]\s*(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|oklch)\([^'"`]*\))\s*['"`]/g)) {
    add('raw', file, at(m.index), `цвет в JS (${m[1]}) – читать токен: css('--color-…')`);
  }
  for (const m of clean.matchAll(/cubic-bezier\(\s*[\d.]/g)) add('raw', file, at(m.index), 'easing числом в JS – токен --ease-* через CustomEase (src/lib/motion.js)');
};
for (const file of walk(path.join(SRC, 'lib'), '.js')) {
  const text = read(file);
  lintJs(file, text);
  if (path.basename(file) !== 'gsap.js') for (const m of text.matchAll(/from\s+['"]gsap(\/[\w]+)?['"]/g)) add('structure', file, lineAt(text, m.index), 'GSAP – только из ./gsap.js: там плагины регистрируются один раз');
}
for (const dir of UNITS_DIRS) for (const file of walk(dir, '.js')) {
  const text = read(file);
  lintJs(file, text);
  for (const m of text.matchAll(/from\s+['"]gsap(\/[\w]+)?['"]/g)) add('structure', file, lineAt(text, m.index), "GSAP – только из @lib/gsap.js: import { gsap } from '@lib/gsap.js'");
  if (/\b(gsap|ScrollTrigger|SplitText)\./.test(text) && !/\bonMotion\(/.test(text)) add('structure', file, 0, 'своё движение – внутри onMotion() из src/lib/env.js: так оно уважает ?static и prefers-reduced-motion');
}

/* --- .astro: разметка, <style>, <script>, frontmatter ---------------------------- */
const motionJs = path.join(SRC, 'lib', 'motion.js');
const presetsBlock = exists(motionJs) ? (read(motionJs).split('export const PRESETS')[1] || '') : '';
const presets = new Set([...presetsBlock.matchAll(/^\s+'([a-z-]+)':/gm)].map(m => m[1]));
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---/;

const lintAstro = (file) => {
  const text = read(file);
  const where = rel(file).split(path.sep).join('/');
  /* Концепты задают свою шкалу, служебные страницы – стенд; правило «размер текста только классом» – для секций и компонентов */
  const sectionRules = !where.startsWith('src/pages/concepts/') && !where.startsWith('src/pages/dev/');
  const at = i => lineAt(text, i);

  const fm = FRONTMATTER.exec(text);
  if (fm) lintJs(file, fm[0], { fileText: text });
  /* Разметка без frontmatter и комментариев (HTML-комментарии и JSX-комментарии в фигурных скобках); позиции сохранены */
  const noComments = blank(blank(blank(text, FRONTMATTER), /<!--[\s\S]*?-->/g), /\{\/\*[\s\S]*?\*\/\}/g);

  for (const m of noComments.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (sectionRules) add('structure', file, at(m.index), `стили – в ${path.basename(file, '.astro')}.css рядом, <style> в секциях и компонентах не используется`);
    lintCss(file, m[1], { fileText: text, offset: m.index + m[0].indexOf('>') + 1, sectionRules });
  }
  for (const m of noComments.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    lintJs(file, m[1], { fileText: text, offset: m.index + m[0].indexOf('>') + 1 });
  }
  const markup = blank(noComments, /(<(script|style)\b[^>]*>)[\s\S]*?(?=<\/\2>)/gi);

  for (const m of markup.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const [, tag, attrs] = m;
    const line = at(m.index);
    if (/(^|\s)hidden(?=[\s=/]|$)/.test(attrs)) add('hidden', file, line, `атрибут hidden – блок «на потом»?: <${tag} ${short(attrs)}>`);
    const style = /\sstyle\s*=\s*"([^"]*)"/i.exec(attrs);
    if (style) {
      if (/display\s*:\s*none/i.test(style[1])) add('hidden', file, line, `display: none в разметке – блок «на потом»?: ${short(style[1])}`);
      lintCss(file, `x{${style[1]}}`, { fileText: text, offset: m.index });
    }
    if (tag === 'img') add('media', file, line, '<img> – только <Image> / <Picture> из astro:assets: WebP/AVIF, размеры, srcset и loading Astro ставит сам');
    if ((tag === 'Image' || tag === 'Picture') && !/\salt\s*=/.test(attrs)) add('media', file, line, `<${tag}> без alt (декор – alt="")`);
    if (tag === 'video' && /\ssrc\s*=/.test(attrs)) add('media', file, line, '<video src> – только data-src + preload="none", src ставит src/lib/main.js');
    for (const r of attrs.matchAll(/data-reveal\s*=\s*"([^"]+)"/g)) {
      if (!presets.has(r[1])) add('motion', file, line, `data-reveal="${r[1]}" нет в реестре src/lib/motion.js / docs/motion.md`);
    }
  }

  /* Распорки: div/span/p, внутри которых ничего нет. Декор помечается data-decor="…" и записывается в базе */
  for (const m of markup.matchAll(/<(div|span|p)\b([^>]*)>(?:\s|&nbsp;|&#160;)*<\/\1\s*>/gi)) {
    if (/\s(role|aria-label|aria-labelledby|data-[\w-]+)\s*=/.test(m[2])) continue;
    add('spacer', file, at(m.index), `пустой элемент: ${short(m[0])} (декор – data-decor="что это" и строка в базе)`);
  }
  for (const m of markup.matchAll(/<div\b([^>]*)\/>/gi)) {
    if (!/\s(role|aria-label|data-[\w-]+)\s*=/.test(m[1])) add('spacer', file, at(m.index), `пустой элемент: ${short(m[0])}`);
  }
  for (const m of markup.matchAll(/(?:<br\s*\/?>\s*){2,}/gi)) add('spacer', file, at(m.index), 'двойной <br> – отступ через margin/gap');

  /* Закомментированная разметка – в обоих видах комментариев */
  for (const m of text.replace(FRONTMATTER, s => s.replace(/[^\n]/g, ' ')).matchAll(/<!--([\s\S]*?)-->|\{\/\*([\s\S]*?)\*\/\}/g)) {
    if (/<(section|div|ul|ol|li|p|h[1-6]|img|Image|video|span|a|button|svg|figure)\b/.test(m[1] || m[2])) add('hidden', file, at(m.index), 'закомментированная разметка – удалить');
  }

  /* Текст: только видимый текст между тегами, без выражений {…} */
  for (const m of markup.matchAll(/>([^<]+)</g)) {
    const s = blank(m[1], /\{[^{}]*\}/g);
    const i = m.index + 1;
    if (s.includes('—')) add('text', file, at(i + s.indexOf('—')), 'длинное тире «—», только короткое «–»');
    if (/\s·\s/.test(s) || /&middot;/.test(s)) add('text', file, at(i), `точка-разделитель «·» запрещена: ${short(s)}`);
    if (/lorem\s+ipsum/i.test(s)) add('text', file, at(i), 'lorem ipsum');
    /* Два и больше слов капсом подряд; \b в JS не понимает кириллицу, поэтому границы через \p{L} */
    const caps = /(?<!\p{L})\p{Lu}{2,}(?:[\s,]+\p{Lu}{2,})+(?!\p{L})/u.exec(s);
    if (caps) add('text', file, at(i + caps.index), `капс в тексте: «${caps[0]}» – обычный регистр`);
  }
  return markup;
};

const markupOf = new Map();
for (const file of walk(SRC, '.astro')) markupOf.set(file, lintAstro(file));

/* --- Имена классов: kebab-case ------------------------------------------------- */
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const badClass = (cls) => (KEBAB.test(cls) ? null : cls.includes('__') || cls.includes('--') ? 'BEM не используем' : 'только строчные буквы, цифры и дефис');
for (const file of [...walk(path.join(SRC, 'styles'), '.css'), ...UNITS_DIRS.flatMap(d => walk(d, '.css'))]) {
  const text = read(file);
  const clean = blank(blank(text, /\/\*[\s\S]*?\*\//g), /"[^"\n]*"|'[^'\n]*'/g);
  for (const m of clean.matchAll(/([^{};]+)\{/g)) {
    if (m[1].trim().startsWith('@')) continue;
    for (const c of m[1].matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) {
      const why = badClass(c[1]);
      if (why) add('naming', file, lineAt(text, m.index + c.index), `класс .${c[1]} – kebab-case: ${why}`);
    }
  }
}
for (const file of walk(SRC, '.astro')) {
  const text = read(file);
  for (const m of text.matchAll(/\sclass\s*=\s*"([^"]*)"/g)) {
    for (const cls of m[1].split(/\s+/).filter(Boolean)) {
      const why = badClass(cls);
      if (why) add('naming', file, lineAt(text, m.index), `класс ${cls} – kebab-case: ${why}`);
    }
  }
}

/* --- Импорты между папками – через алиасы (tsconfig.json → paths): @lib/, @styles/, @sections/… ------- */
const lintImports = (file, raw) => {
  /* комментарии не считаются: в них бывают примеры */
  const text = blank(blank(blank(raw, /\/\*[\s\S]*?\*\//g), /(^|[^:'"`\\])\/\/[^\n]*/g), /<!--[\s\S]*?-->/g);
  for (const m of text.matchAll(/(?:from\s+|import\s+|import\()\s*['"](\.\.\/[^'"]*)['"]/g)) {
    add('structure', file, lineAt(text, m.index), `импорт ${m[1]} – через алиас (@lib/, @styles/, @layouts/, @sections/, @components/, @assets/)`);
  }
};
for (const file of [...walk(SRC, '.astro'), ...walk(SRC, '.js')]) lintImports(file, read(file));

/* --- Структура: секция и компонент – папка Name/ с Name.astro; Name.css и Name.js подключены в Name.astro --- */
for (const dir of UNITS_DIRS) {
  if (!exists(dir)) continue;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) { add('structure', full, 0, `файл вне папки: ${entry.name} → ${path.basename(dir)}/${entry.name.split('.')[0]}/${entry.name}`); continue; }
    const name = entry.name;
    const astro = path.join(full, `${name}.astro`);
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) add('structure', full, 0, `имя папки – PascalCase, как у компонента: ${name}`);
    if (!exists(astro)) { add('structure', full, 0, `нет ${name}.astro`); continue; }
    const text = read(astro);
    const fm = (FRONTMATTER.exec(text) || [''])[0];
    const scripts = [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
    if (exists(path.join(full, `${name}.css`)) && !fm.includes(`'./${name}.css'`)) add('structure', astro, 0, `${name}.css не подключён: во frontmatter import './${name}.css';`);
    if (exists(path.join(full, `${name}.js`)) && !scripts.includes(`'./${name}.js'`)) add('structure', astro, 0, `${name}.js не подключён: <script> import './${name}.js'; </script>`);
    for (const f of fs.readdirSync(full)) {
      if (!f.startsWith('.') && ![`${name}.astro`, `${name}.css`, `${name}.js`].includes(f)) add('structure', path.join(full, f), 0, `в папке ${name}/ только ${name}.astro, .css и .js; картинки – src/assets/img/`);
    }
  }
}

/* --- Документация против кода ------------------------------------------------- */
const motionMd = path.join(ROOT, 'docs', 'motion.md');
if (exists(motionMd)) {
  const registry = read(motionMd).split('## Реестр `data-reveal`')[1] || '';
  const documented = new Set([...registry.split('\n## ')[0].matchAll(/^\|\s*`([a-z-]+)`\s*\|/gm)].map(m => m[1]));
  for (const p of presets) if (!documented.has(p)) add('motion', motionJs, 0, `приём «${p}» есть в коде, но не описан в docs/motion.md`);
  for (const d of documented) if (!presets.has(d)) add('motion', motionMd, 0, `приём «${d}» описан, но нет в src/lib/motion.js`);
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

/* --- Справочник библиотек против кода --------------------------------------------- */
const libsMd = path.join(ROOT, 'docs', 'libraries.md');
const gsapJs = path.join(SRC, 'lib', 'gsap.js');
if (exists(libsMd)) {
  const libs = read(libsMd);
  const section = title => (libs.split(`## ${title}`)[1] || '').split('\n## ')[0];
  const marked = new Set([...section('GSAP: плагины').matchAll(/^\|\s*`(\w+)`\s*\|.*\|\s*✅\s*\|\s*$/gm)].map(m => m[1]));
  const registered = new Set(exists(gsapJs) ? ((/registerPlugin\(([^)]*)\)/.exec(read(gsapJs)) || [, ''])[1].match(/\w+/g) || []) : []);
  for (const p of registered) if (!marked.has(p)) add('docs', libsMd, 0, `плагин ${p} зарегистрирован в src/lib/gsap.js, но не отмечен ✅ в docs/libraries.md`);
  for (const p of marked) if (!registered.has(p)) add('docs', libsMd, 0, `плагин ${p} отмечен ✅, но не зарегистрирован в src/lib/gsap.js`);
  const listed = new Set([...section('В проекте').matchAll(/^\|\s*`([@\w/.-]+)`\s*\|/gm)].map(m => m[1]));
  const deps = Object.keys(JSON.parse(read(path.join(ROOT, 'package.json'))).dependencies || {});
  for (const d of deps) if (!listed.has(d)) add('docs', libsMd, 0, `пакет ${d} есть в package.json, но не описан в docs/libraries.md → «В проекте»`);
  for (const l of listed) if (!deps.includes(l)) add('docs', libsMd, 0, `пакет ${l} описан в «В проекте», но его нет в package.json`);
}

/* --- Карта секций: id в src/sections/Name/Name.astro и на главной против карты в базе -- */
const indexPage = path.join(SRC, 'pages', 'index.astro');
const indexText = exists(indexPage) ? read(indexPage) : '';
/* Только src/sections/Name/Name.astro: файлы не на своём месте уже названы в проверке структуры */
const sectionFiles = walk(path.join(SRC, 'sections'), '.astro').filter(f => path.basename(f, '.astro') === path.basename(path.dirname(f)));
const idsHtml = [];
for (const file of [indexPage, ...sectionFiles]) {
  for (const m of (markupOf.get(file) || '').matchAll(/<section\b[^>]*\bid="([^"]+)"/g)) idsHtml.push({ id: m[1], file });
}
const mapIds = [];
const mapPart = (dsText.split('## Карта секций')[1] || '').split('\n## ')[0];
for (const row of mapPart.split('\n')) {
  const cells = row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim().replace(/`/g, ''));
  if (cells.length >= 2 && /^\d+$/.test(cells[0])) mapIds.push(cells[1]);
}
for (const { id, file } of idsHtml) if (!mapIds.includes(id)) add('map', file, 0, `секция id="${id}" не записана в карте секций docs/design-system.md`);
if (idsHtml.length) for (const id of mapIds) if (id && !idsHtml.some(s => s.id === id)) add('map', ds, 0, `секция «${id}» есть в карте, но не в src/sections/ (статус в карте – концепт?)`);
for (const file of sectionFiles) {
  const name = path.basename(file);
  const folder = path.basename(path.dirname(file));
  if (!indexText.includes(`sections/${folder}/${name}`)) add('map', file, 0, `секция не подключена в src/pages/index.astro (import ${folder} from '@sections/${folder}/${name}')`);
}

/* --- Сцена -------------------------------------------------------------------- */
const sceneJs = path.join(SRC, 'lib', 'scene.js');
const hasScene = [...markupOf.values()].some(m => /<[^>]*\sdata-scene\b/.test(m));
if (hasScene && exists(sceneJs) && read(sceneJs).includes('SMOKE_TEST')) {
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
