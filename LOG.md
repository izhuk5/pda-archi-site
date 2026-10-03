# Журнал решений

Новые записи сверху. Формат: дата – решение – почему – что изменилось в файлах. Сюда – продукт, процесс, технологии. Дизайн – в `docs/design-system.md`.

## 2026-10-03 – mobile-first, справочник библиотек
- Mobile-first (решение владельца): базовые стили – мобильные (макет 390), шире – только `@media (min-width: 500px)` и `(min-width: 768px)`, `max-width` не используется. Токены: без суффикса – мобильные, `-desktop` – с 768 (`--page-margin` 16 / `--page-margin-desktop` 24, `--space-section` 64 / `--space-section-desktop` 128). `.grid-12`: на мобильном одна колонка, с 768 – 12. Скриншоты снимаются в порядке 390 → 1440.
- `docs/libraries.md` – подсказка: пакеты проекта, 24 плагина GSAP с отметкой подключённых, аддоны Three.js (GLTFLoader, DRACOLoader, HDRLoader вместо устаревшего RGBELoader…), встроенное в Astro, кандидаты (`@astrojs/sitemap`, `@sanity/astro`). `check.mjs` сверяет отметки ✅ с `src/lib/gsap.js` и пакеты с `package.json`.
- `check.mjs`: категория `responsive` – `max-width` и брейкпоинты вне шкалы.
- Решения владельца: CLAUDE.md пока не сокращаем (вернёмся позже); стартер пока не публикуем как шаблон на GitHub – сначала проверить на реальном проекте.
- Файлы: docs/libraries.md, src/styles/tokens.css, src/styles/base.css, scripts/check.mjs, scripts/shot.mjs, CLAUDE.md, README.md, START.md, docs/design-system.md, docs/publish.md, .claude/skills/*, .claude/agents/qa.md.

## 2026-10-03 – kebab-case и алиасы импортов
- Имена классов – kebab-case, BEM не используем (решение владельца): `.hero`, `.hero-title`, варианты и состояния – комбо-класс `is-*` (`.section.is-dark`, `.button.is-accent`). Префикс блока в CSS секций остаётся: подключённый `Name.css` Astro не изолирует (изолирует только `<style>` внутри `.astro`), без префикса стили протекают между секциями.
- base.css: `.section--dark` → `.section.is-dark`, `.section--sheet` → `.section.is-sheet`, `.scene__fallback` → `.scene-fallback`.
- Алиасы в `tsconfig.json` (`paths`, без `baseUrl` – Astro 7 читает и так, редактор подсказывает пути): `@layouts/`, `@sections/`, `@components/`, `@lib/`, `@styles/`, `@assets/`. Внутри своей папки – `./`, `../` не используется.
- check.mjs: категория `naming` (только kebab-case в CSS и разметке), импорт через `../` – замечание `structure`.
- Файлы: tsconfig.json, src/layouts/Base.astro, src/pages/index.astro, src/lib/gsap.js, src/styles/base.css, scripts/check.mjs, CLAUDE.md, README.md, docs/design-system.md, docs/scene.md, .claude/skills/section, scene, check.

## 2026-10-03 – структура по образцу astro-gsap
- Образец – github.com/Webflow-Examples/astro-gsap (только структура HTML/CSS/JS, не Webflow). Взято: секция и компонент – папка `Name/` с `Name.astro` (разметка), `Name.css` (стили, подключён во frontmatter), `Name.js` (поведение, подключён в `<script>`); GSAP – один файл `src/lib/gsap.js` с регистрацией плагинов; общий JS – `src/lib/` (бывший `src/js/`).
- Не взято: регистрация всех 24 плагинов – у нас только используемые (ScrollTrigger, SplitText, CustomEase), каждый лишний попадает в сборку; глобальные стили – не в index.astro, а в Base.astro (общий макет для главной и концептов).
- Своё: `src/lib/env.js` – режимы и `onMotion()`, чтобы JS секций уважал `?static` и reduced-motion; CSS секций глобальный, поэтому каждое правило обязано содержать класс блока (`.hero__title`), `<style>` в секциях не используется; концепты – одним файлом в `src/pages/concepts/` (`.js` в pages Astro считает маршрутом).
- `check.mjs`: категория `structure` – папка PascalCase, файлы подключены, префикс блока в CSS, нет `:root` в CSS секции, GSAP только из `lib/gsap.js`, движение через `onMotion()`, посторонние файлы в папке.
- Файлы: src/lib/* (из src/js/), src/lib/gsap.js, src/lib/env.js, src/layouts/Base.astro, scripts/check.mjs, CLAUDE.md, README.md, START.md, docs/design-system.md, docs/motion.md, docs/scene.md, .claude/skills/*, .claude/agents/critic.md.

## 2026-10-03 – переезд на Astro
- Решение: сайт собирается на Astro 7.3.5 в статичные файлы (`output: 'static'`, `npm run build` → `dist/`). Почему: компоненты вместо одного index.html, оптимизация картинок, путь к CMS. Правило 10 и «Сборка и публикация» в CLAUDE.md переписаны: npm-зависимости и сборка разрешены; UI-фреймворки, Tailwind и CSS-in-JS – только отдельным решением.
- Библиотеки – из npm, точные версии (`.npmrc` save-exact): astro 7.3.5, gsap 3.15.0, lenis 1.3.26, three 0.186.1 – все последние стабильные. CDN и importmap убраны. Three.js – отдельный файл сборки, грузится только при `[data-scene]`. Добавлен `lenis/dist/lenis.css` (рекомендованные стили Lenis).
- Тексты – прямо в компонентах секций (выбор владельца). При переходе на Sanity выносятся.
- Код – JavaScript; TypeScript только в служебном `tsconfig.json` для подсказок редактора.
- Структура: `src/pages/index.astro` (главная), `src/sections/` (секция = файл со своими стилями), `src/components/`, `src/layouts/Base.astro`, `src/styles/` (tokens, base – глобальные), `src/js/`, `src/assets/img/` (картинки через `<Image>`), `public/video`, `public/models`; источники ассетов – один файл `src/assets/SOURCES.md` (вне `public/`, на хостинг не уходит).
- Концепты – страницы `src/pages/concepts/`, служебные – `src/pages/dev/` (`/dev/mobile` вместо `scripts/mobile.html`); из сборки удаляются хуком в `astro.config.mjs`.
- Команды: `dev`, `dev:stop`, `build`, `preview`, `check`, `shot`, `versions` (= `npm outdated`). `scripts/serve.mjs` и `scripts/versions.mjs` удалены – их заменили Astro и npm.
- `check.mjs` разбирает `.astro`: frontmatter, разметку, `<style>`, `<script>`; требует `<Image>` вместо `<img>`; проверяет, что секция подключена на главной. `shot.mjs` поднимает свой `astro dev` (`--ignore-lock`, своя группа процессов), `--page concepts/hero-a`.
- Грабля: Astro 7 в среде агента сам уводит `astro dev` в фон и при обычном kill оставляет процесс-сироту. При разборе этого агент остановил по слишком широкому шаблону чужой dev-сервер (`~/Desktop/padel-shool`, порт 4331) – правило «гасить только по PID своего проекта» записано в CLAUDE.md.
- `npm audit`: 2 high в `http-cache-semantics` (зависимость Astro); «исправление» откатывает Astro на 2.x – не применяем, для статичной сборки не опасно. Ждём обновления Astro.
- Файлы: astro.config.mjs, package.json, package-lock.json, .npmrc, tsconfig.json, .gitignore, src/**, public/**, scripts/check.mjs, scripts/shot.mjs, CLAUDE.md, START.md, README.md, docs/*, .claude/**.

## 2026-10-03 – план (не решение): архитектура под Astro
- Следующая сессия – обсуждение архитектуры: сборка на Astro.js, позже, возможно, Sanity CMS (пока не подключаем). Противоречит текущим правилам «без сборки и без npm-зависимостей» (CLAUDE.md, правило 10 и «Сборка и публикация») – правила меняются отдельным решением, не заплаткой.

## 2026-10-03 – свежесть библиотек
- Сверено с npm (тег latest): gsap 3.15.0 (13.04.2026), lenis 1.3.26 (05.08.2026), three 0.186.1 (24.09.2026) – все закреплённые версии последние стабильные. lenis 2.0 – пока только dev, не берём.
- `npm run versions` (`scripts/versions.mjs`): сверяет версии CDN-ссылок в index.html и concepts/ с npm; `--write` обновляет в пределах мажора после проверки, что файлы есть на jsdelivr; через мажор – `--major`. У three 0.x каждый минор – мажор (API ломается почти в каждом релизе).
- Файлы: scripts/versions.mjs, package.json, CLAUDE.md, START.md, README.md, docs/publish.md.

## 2026-10-03 – запуск через npm
- `package.json` только со скриптами: `npm run dev` (сервер), `npm run check` (линтер), `npm run shot -- [id]` (скриншоты). Зависимостей нет, `npm install` не нужен. Почему: привычный запуск одной командой. Правило 10 в CLAUDE.md уточнено: npm – только запуск скриптов, пакеты не ставятся.
- Файлы: package.json, .gitignore, .claude/launch.json, scripts/*.mjs (комментарии), CLAUDE.md, START.md, README.md, docs/*, .claude/skills/*, .claude/agents/qa.md.

## 2026-10-03 – инженерный аудит заготовки
- git: репозиторий `main`, первый коммит – исходная заготовка. Коммит после каждой закрытой секции; «что изменилось» – `git diff`. Почему: правило «я правлю руками, скажи, что изменилось» без git невыполнимо.
- Python и bash убраны, инструменты – Node 22+ без npm: `scripts/serve.mjs` (сервер с Range для видео), `scripts/check.mjs` (линтер), `scripts/shot.mjs` (скриншоты через Chrome DevTools Protocol). Удалены `scripts/check.py`, `scripts/shot.sh`; `.claude/launch.json` – на node.
- `shot.mjs`: мобильная ширина – эмуляция устройства вместо iframe; вся страница кусками по два экрана; замеры горизонтального скролла, висячих строк, ошибок консоли и сети; выход 1 при скролле или ошибках.
- `check.mjs` против `check.py`: верные номера строк (комментарии больше не сдвигают счёт); ловит dvh/ch/ms/отрицательные размеры, цвет словом, вес, интерлиньяж, z-index, несуществующие `var(--…)`; проверяет JS и `concepts/`; распорки на нескольких строках и двойной `<br>`; нет ложных срабатываний на `aria-hidden` и `.visually-hidden`; картинки без alt/размеров/loading; сверка реестра движения и токенов с документацией.
- CustomEase (gsap@3.15.0, CDN) – зачем: GSAP молча игнорировал `cubic-bezier()` из токенов, приём `clip` шёл на дефолтном easing. Теперь каждый `--ease-*` регистрируется по имени.
- Скрипты библиотек – `defer` (не блокируют отрисовку). `html.has-motion` – inline-скрипт в `<head>` до первой отрисовки (без мигания контента); если GSAP не загрузился или движение упало – класс снимается, всё видно. Шрифты ждём не дольше 3 s.
- Якоря Lenis: `getElementById` вместо `querySelector` – `href="#"` больше не роняет обработчик.
- Google Fonts остаются; локальные шрифты – позже, решение владельца.
- Файлы: index.html, js/main.js, js/motion.js, js/scene.js, styles/tokens.css, styles/base.css, scripts/*, CLAUDE.md, START.md, README.md, docs/*, .claude/skills/*, .claude/agents/qa.md, .claude/launch.json.

## [дата старта]
- Проект начат из заготовки wow-site-starter. Стек: HTML/CSS/JS без сборки, GSAP + ScrollTrigger + SplitText, Lenis, Three.js через importmap, всё с CDN.
