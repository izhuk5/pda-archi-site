# Публикация

Сайт собирается в статичные файлы: `npm run build` → папка `dist/`. На хостинг уезжает только `dist/` – исходники, `brief/`, `docs/`, концепты и `scripts/` туда не попадают. Концепты (`src/pages/concepts/`) и служебные страницы (`src/pages/dev/`) из сборки удаляются автоматически (`astro.config.mjs`).

## Перед выкладкой
1. `npm run check` – 0 замечаний.
2. `npm run shot` – скриншоты 1440 и 390 последнего состояния просмотрены, горизонтального скролла и ошибок консоли 0.
3. `npm run versions` – библиотеки на последних стабильных или осознанно закреплены (причина в `LOG.md`).
4. `npm run build` без ошибок, `npm run preview` – сборка открыта и пролистана глазами: то, что уедет на хостинг, иногда отличается от dev.
5. Всё закоммичено: выкладывается то, что в git, а не рабочая копия.
6. Видео – только пережатые в `public/video/`, модели – только сжатые в `public/models/`.

Кеш: Astro добавляет хеш к именам файлов стилей и скриптов (`_astro/имя.a1b2c3.js`), браузер сам берёт новые после выкладки – `?v=N` не нужен.

## Варианты
- **Netlify** (проще всего): подключить репозиторий, команда сборки `npm run build`, папка публикации `dist`. Каждый push в `main` выкладывается сам. Разово – перетащить `dist/` на app.netlify.com/drop.
- **GitHub Pages**: Settings → Pages → Source: GitHub Actions, workflow `withastro/action` (официальный, собирает и выкладывает). Если адрес `https://<user>.github.io/<repo>/`, в `astro.config.mjs` указать `site` и `base: '/<repo>'`.
- **Свой сервер** (nginx): содержимое `dist/`, `try_files $uri $uri/ =404`, кеш `_astro/` – год (имена с хешем), `index.html` без кеша, gzip. Выкладка – `rsync -a --delete dist/ сервер:/путь/`.

Хостинг выбирается один раз и записывается в `LOG.md` вместе с адресом.

## Выбрано: Netlify
Репозиторий – `git@github.com:izhuk5/pda-archi-site.git` (публичный, ветка `main`). Настройки сборки – в `netlify.toml` в корне: `npm run build`, папка `dist`, Node 22, кеш `/_astro/*` на год. В Netlify: Add new site → Import an existing project → GitHub → `pda-archi-site`, поля сборки подтянутся из `netlify.toml`. Каждый push в `main` выкладывается сам.

В публичный репозиторий не попадает `brief/` (бриф клиента и референсы – только на диске, в `.gitignore`).
