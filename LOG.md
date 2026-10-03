# Журнал решений

Новые записи сверху. Формат: дата – решение – почему – что изменилось в файлах. Сюда – продукт, процесс, технологии. Дизайн – в `docs/design-system.md`.

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
