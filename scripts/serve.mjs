#!/usr/bin/env node
/* Локальный сервер для просмотра. Только встроенные модули Node, без npm.
   Запуск из корня: node scripts/serve.mjs [порт] (по умолчанию 8765), адрес http://127.0.0.1:8765/
   Поддерживает Range-запросы (перемотка видео) и отдаёт файлы без кеша, чтобы правки были видны сразу. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
};

const handler = (req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  let file = path.join(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; } /* ../ за пределы проекта */
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404'); return; }

  const { size } = fs.statSync(file);
  const headers = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    const start = range[1] ? Number(range[1]) : size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start < 0) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return; }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': size });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(file).pipe(res);
};

/* Порт 0 – первый свободный (так сервер поднимает scripts/shot.mjs). Возвращает { server, port } */
export const serve = (port = 0) => new Promise((resolve, reject) => {
  const server = http.createServer(handler);
  server.once('error', reject);
  server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 8765;
  serve(port)
    .then(({ port: p }) => console.log(`сервер: http://127.0.0.1:${p}/  (корень ${ROOT}, остановить – Ctrl+C)`))
    .catch(err => { console.error(err.code === 'EADDRINUSE' ? `порт ${port} занят: node scripts/serve.mjs <другой порт>` : err.message); process.exit(1); });
}
