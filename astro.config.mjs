/* Конфигурация Astro. Сайт собирается в статичные файлы (dist/) – на хостинге сервер не нужен. */
import fs from 'node:fs';
import { defineConfig } from 'astro/config';

/* Концепты (src/pages/concepts/) и служебные страницы (src/pages/dev/) смотрятся только в npm run dev:
   из сборки для выкладки они удаляются */
const dropDevPages = {
  name: 'drop-dev-pages',
  hooks: {
    'astro:build:done': ({ dir }) => {
      for (const folder of ['concepts/', 'dev/']) fs.rmSync(new URL(folder, dir), { recursive: true, force: true });
      /* Пустые .gitkeep из public/ на хостинге не нужны */
      for (const f of fs.readdirSync(dir, { recursive: true })) if (String(f).endsWith('.gitkeep')) fs.rmSync(new URL(String(f), dir));
    },
  },
};

export default defineConfig({
  output: 'static',
  /* Панель разработчика Astro внизу страницы прячется на скриншотах scripts/shot.mjs */
  devToolbar: { enabled: !process.env.SHOT },
  integrations: [dropDevPages],
  vite: {
    /* Three.js (~520 kB, 130 kB в gzip) – отдельный файл, грузится только при [data-scene]: предупреждение о размере для него ожидаемо */
    build: { chunkSizeWarningLimit: 600 },
  },
});
