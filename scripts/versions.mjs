#!/usr/bin/env node
/* Версии библиотек с CDN против последних стабильных релизов npm (тег latest – без beta, dev и next).
   Запуск из корня:
     npm run versions                      показать, что устарело (выход 1, если есть что обновить)
     npm run versions -- --write           обновить index.html до последних в пределах мажора
     npm run versions -- --write --major   обновить и через мажор (возможны ломающие изменения – читать changelog)
   Перед заменой каждый файл новой версии проверяется на jsdelivr: если его нет, замена не делается.
   Версии берутся из ссылок вида cdn.jsdelivr.net/npm/<пакет>@<версия>/ в index.html и concepts/*.html. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const allowMajor = process.argv.includes('--major');

const conceptsDir = path.join(ROOT, 'concepts');
const files = [path.join(ROOT, 'index.html'), ...(fs.existsSync(conceptsDir) ? fs.readdirSync(conceptsDir).filter(f => f.endsWith('.html')).map(f => path.join(conceptsDir, f)) : [])];
const CDN = /cdn\.jsdelivr\.net\/npm\/((?:@[\w.-]+\/)?[\w.-]+)@(\d+\.\d+\.\d+)(\/[^"'\s)]*)?/g;

/* Пакет → версия → какие файлы с CDN используются */
const used = new Map();
for (const file of files) {
  for (const [, name, version, filePath] of fs.readFileSync(file, 'utf8').matchAll(CDN)) {
    if (!used.has(name)) used.set(name, new Map());
    const byVersion = used.get(name);
    if (!byVersion.has(version)) byVersion.set(version, new Set());
    if (filePath && !filePath.endsWith('/')) byVersion.get(version).add(filePath);
  }
}
if (!used.size) { console.log('ссылок на cdn.jsdelivr.net/npm не найдено'); process.exit(0); }

const major = v => v.split('.')[0] === '0' ? v.split('.').slice(0, 2).join('.') : v.split('.')[0]; /* у 0.x мажор – второе число */
const latestOf = async name => (await (await fetch(`https://registry.npmjs.org/${name}/latest`)).json()).version;
const existsOnCdn = async url => (await fetch(url, { method: 'HEAD' })).ok;

const updates = [];
let outdated = 0;
for (const [name, versions] of used) {
  const latest = await latestOf(name);
  for (const [version, paths] of versions) {
    if (version === latest) { console.log(`  ${name}@${version} – последняя`); continue; }
    outdated++;
    const breaking = major(version) !== major(latest);
    console.log(`  ${name}@${version} → ${latest}${breaking ? '  (новый мажор: возможны ломающие изменения, нужен --major)' : ''}`);
    if (!write || (breaking && !allowMajor)) continue;
    const missing = [];
    for (const p of paths) if (!(await existsOnCdn(`https://cdn.jsdelivr.net/npm/${name}@${latest}${p}`))) missing.push(p);
    if (missing.length) { console.log(`    не обновлено: в ${latest} нет файлов ${missing.join(', ')}`); continue; }
    updates.push({ name, from: version, to: latest });
  }
}

if (write) {
  for (const file of files) {
    let text = fs.readFileSync(file, 'utf8');
    for (const { name, from, to } of updates) text = text.split(`/npm/${name}@${from}/`).join(`/npm/${name}@${to}/`);
    fs.writeFileSync(file, text);
  }
  if (updates.length) {
    console.log(`\nобновлено: ${updates.map(u => `${u.name} ${u.from} → ${u.to}`).join(', ')}`);
    console.log('дальше: npm run shot (страница работает, ошибок консоли 0), запись в LOG.md, коммит');
  }
  process.exit(0);
}
console.log(outdated ? `\nустарело: ${outdated}. Обновить: npm run versions -- --write` : '\nвсё на последних стабильных');
process.exit(outdated ? 1 : 0);
