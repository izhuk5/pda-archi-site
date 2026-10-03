# Wow-site starter

Заготовка проекта «сайт кодом через Claude Code»: дизайн собирается сразу в коде на Astro и смотрится в браузере, без Figma. Структура HTML/CSS/JS – по образцу [Webflow-Examples/astro-gsap](https://github.com/Webflow-Examples/astro-gsap): компонент – папка из `.astro`, `.css` и `.js`, GSAP подключается в одном месте. Скопируй папку, положи бриф, выполни `npm install`, открой Claude Code – и вставь первый промпт из `START.md`.

## Команды

Нужны Node 22.12+ и Google Chrome.

```
npm install          один раз после копирования: Astro, GSAP, Lenis, Three.js
npm run dev          просмотр на http://localhost:4321 (концепты – /concepts/hero-a)
npm run dev:stop     остановить dev-сервер, если он ушёл в фон (так делает Astro, когда его запускает агент)
npm run build        сборка в dist/ – это и выкладывается
npm run preview      посмотреть сборку перед выкладкой
npm run check        линтер правил CLAUDE.md
npm run shot         скриншоты 390 и 1440 + замеры; секция – npm run shot -- hero
npm run versions     что из библиотек устарело
```

## Карта папки

```
CLAUDE.md            правила работы: пайплайн, запреты, Definition of Done. Claude читает сам
START.md             первый промпт и промпт продолжения – вставлять как есть
LOG.md               журнал решений (продукт, процесс, технологии), новые сверху

brief/
  source/            сырой бриф клиента как есть: pdf, docx, письмо, скриншоты
  brief.md           бриф в едином формате, Claude заполняет из source
  references.md      референсы словами: что берём (структура, ритм, плотность), не «сделай так же»

docs/
  TASTE.md           как не сделать generic-дизайн. Читать перед каждой секцией
  design-system.md   источник правды: токены, компоненты, карта секций, ручная доводка, журнал
  motion.md          библиотека приёмов движения (GSAP, ScrollTrigger, Lenis) и реестр data-reveal
  scene.md           3D и Three.js: когда уместно, бюджет, приёмы, запасной вариант
  libraries.md       подсказка: библиотеки проекта, все плагины GSAP, аддоны Three.js, что есть в Astro
  publish.md         как выложить: сборка, GitHub Pages, Netlify, свой сервер

src/
  pages/
    index.astro      главная: секции в порядке карты, по строке на секцию
    concepts/        концепты hero и ветвления – 2–3 варианта рядом; в сборку не попадают
    dev/             служебные страницы (/dev/mobile – сайт в iframe 390); в сборку не попадают
  sections/
    Hero/            секция = папка из трёх файлов:
      Hero.astro     разметка и тексты, <section id="hero">
      Hero.css       стили; каждое правило с классом блока .hero
      Hero.js        своё поведение (пин, scrub) – только если нужно
  components/        всё, что повторилось дважды, – так же папкой из трёх файлов
                     классы – kebab-case: .hero, .hero-title, варианты .hero.is-dark (BEM не используем)
  layouts/
    Base.astro       каркас страницы: head, шрифты, глобальные стили, запуск движения
  styles/
    tokens.css       :root – единственное место, где живут сырые значения
    base.css         reset, сетка, шкала текста, состояния data-reveal
  lib/               общий JS
    gsap.js          GSAP и плагины: импорт и регистрация один раз, остальные берут отсюда
    env.js           режимы ?static и reduced-motion, onMotion() для движения секций
    main.js          запуск: Lenis, подключение движения и сцены
    motion.js        реестр приёмов data-reveal
    scene.js         Three.js: рендерер, ленивый старт, пауза вне экрана; объект сцены – слот
  assets/
    img/             картинки – выводятся через <Image>, Astro сам делает WebP/AVIF и srcset
    SOURCES.md       источники всех ассетов: картинки, видео, модели
public/
  video/  models/    файлы, которые уходят на хостинг как есть

scripts/
  check.mjs          линтер правил: сырые значения вне токенов, спейсеры, капс, моно, тире, картинки, сверка docs с кодом
  shot.mjs           скриншоты 390 и 1440 через Chrome + замеры: горизонтальный скролл, висячие строки, ошибки консоли

astro.config.mjs     настройки Astro: статичная сборка, концепты и dev-страницы вне выкладки
tsconfig.json        алиасы импортов: @layouts/ @sections/ @components/ @lib/ @styles/ @assets/
package.json         зависимости (точные версии) и команды

.claude/
  launch.json        локальный сервер для предпросмотра
  skills/            повторяемые процессы: section, critique, check, motion, scene
  agents/            субагенты со свежим контекстом: critic (вкус), qa (Definition of Done)
```

## Как это устроено

Три слоя контекста для Claude:
1. **Правила** – `CLAUDE.md`. Не меняются под проект, переезжают между проектами.
2. **Проект** – `brief/`, `docs/design-system.md`, `LOG.md`. Заполняются по ходу, это память проекта между чатами.
3. **Процессы** – `.claude/skills` и `.claude/agents`. Что делать шаг за шагом, когда говорят «собери секцию» или «проверь».

Всё, что не записано в `docs/design-system.md` или `LOG.md`, – не произошло. История кода – git: коммит после каждой закрытой секции.
