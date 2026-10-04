# Источники ассетов

Один файл на все ассеты: он лежит вне `public/`, поэтому не уезжает на хостинг. Каждый файл ассета – строка в своей таблице.

## Изображения – `src/assets/img/`
Картинки выводятся компонентом `Photo` (`src/components/photo/`): при сборке Astro делает AVIF и WebP нужных ширин и запасной JPG. Сюда – исходник лучшего качества, без ручного пережатия.
Строка: имя – откуда (ссылка, «от клиента», «сгенерировано: модель и промпт одной фразой») – лицензия – что сделано (обрезка, размер).

| Файл | Источник | Лицензия | Обработка |
|---|---|---|---|
| `hero-virtuose-entrance-2400.jpg`, `hero-virtuose-entrance-mobile.jpg` | от клиента: pda.archi, проект Virtuose (…virtuose-bureaux-paris-8.jpg) – фото hero | материалы клиента; права и автора съёмки подтвердить | 2400 px JPEG q74; мобильный – вертикальный кадр из центра под 390 × 844, q76 |
| `about-belvista-aerial-2000.jpg`, `about-belvista-aerial-mobile.jpg` | от клиента: pda.archi, главная, Belvista – 118 Champs-Élysées (…118-champs-elysées-paris-9.jpg) – фото секции about | материалы клиента; права и автора съёмки подтвердить | 2000 px JPEG q66; мобильный – вертикальный кадр из центра с запасом по высоте под параллакс (рамка 4:5 × 1.4), 800 px, q70 |
| `projects/<проект>-0…4.jpg` (virtuose, volney, inbois, chaussee, belvista, raiselab, carat, tribunes) | от клиента: pda.archi, страницы проектов (images.prismic.io/pda-architecture); `-0` – обложка карточки, остальные – галерея окна проекта. Фото: Florian Wattier, Stéphane Muratet, Michel Tubiana, PDA, архивы; InBois, Carat, Tribunes, Belvista – в основном рендеры | материалы клиента; права и авторов подтвердить | 1600 px по ширине (вертикальные 1100 px), JPEG q70 |
| `projects/{saussure,biopark,timbre,verde,cooperation}-N.jpg` | от клиента: pda.archi, страницы 125 Saussure (фото Florian Wattier), Le Biopark (Guillaume Guerin), Timbre, Verde (рендеры), Coopération | материалы клиента; права подтвердить | 1600 px (вертикальные 1100), JPEG q70 |
| `projects/thumbs/<проект>.jpg` | обрезка обложек `projects/<проект>-0.jpg` | то же | 480 × 320, JPEG q72 – превью в строках clients |
| `transformation/{entrance,courtyard,top}-{before,after}.jpg` | от клиента: pda.archi, проект Virtuose – пары «стройка / готово» в тех же пространствах (…chantier-florian-wattier-13/15/17, …virtuose-bureaux-paris-8, …renovatio-10-, …virtuose-bureaux-paris-14). Фото Florian Wattier | материалы клиента; права подтвердить | кадр 4:5, 1200 × 1500, JPEG q72; пары выровнены по центру (верхний этаж – по левому краю, окно с Эйфелевой башней) |
| `digital/scan-section.jpg`, `digital/model-axonometry.jpg` | от клиента: pda.archi, InBois – разрез и разнесённая аксонометрия (…surelevation-bois-bureaux-paris-axonometrie(-eclatee).jpg) | материалы клиента; права подтвердить | 1400 px, JPEG q72 |
| `digital/generate-grid.jpg`, `digital/print-model.jpg` | от клиента: pda.archi, Atelier Maquette (…savoir-faire-expertises-impression-3d-imprimante-paris-12 / -intro) | то же | 1400 px, JPEG q72 |
| `digital/build-site.jpg` | копия `projects/inbois-4.jpg` – стройка InBois | то же | без изменений |

## Шрифты – `public/fonts/`
Файлы woff2 как есть, `@font-face` – в `src/styles/base.css`. Наборы урезаны пользователем до 79 глифов (2026-09-30), пользователь подтвердил, что набора хватает; текст с акцентами и знаками сверять на скриншоте.

| Файл | Семейство, начертание | Словолитня | Лицензия на веб | Источник |
|---|---|---|---|---|
| `NeueMontreal-Regular.woff2` | Neue Montreal, Regular 400 | Pangram Pangram Foundry | платный, веб-лицензию уточнить | от пользователя, 2026-09-30, оптимизирован пользователем |
| `HedvigLettersSerif18pt-Regular.woff2` | Hedvig Letters Serif 18pt, Regular 400 | Kanon Foundry | OFL, бесплатно | от пользователя, 2026-09-30, оптимизирован пользователем |

## Видео – `public/video/`
Только пережатые файлы: `ffmpeg -i in.mov -vf scale=640:-2 -c:v libx264 -crf 28 -preset slow -movflags +faststart -an out.mp4`. Исходники в проект не кладутся. В разметке – `data-src="/video/имя.mp4"` + `preload="none"`.

| Файл | Источник | Длительность | Размер |
|---|---|---|---|

## 3D-модели – `public/models/`
Только сжатые `.glb` ≤ 2 МБ: `npx @gltf-transform/cli optimize in.glb out.glb --compress draco --texture-size 2048` (разовый запуск, в проект не ставится). Сцены `.blend` и исходники в проект не кладутся.

| Файл | Источник | Лицензия | Полигоны | Размер |
|---|---|---|---|---|
