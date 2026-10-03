#!/usr/bin/env python3
"""Линтер правил CLAUDE.md. Запуск из корня проекта: python3 scripts/check.py
Выход 1, если есть замечания. Категории: raw (сырые значения вне tokens.css), type (размер текста числом / капс / моно),
spacer (пустые элементы), hidden (скрытые блоки и закомментированный код), text (тире, точка-разделитель, lorem),
motion (data-reveal вне реестра), map (id секций не по карте), scene (тестовый объект)."""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
issues = []
def add(cat, path, line, msg): issues.append((cat, str(path.relative_to(ROOT)), line, msg))

def strip_comments(text):
    return re.sub(r'/\*.*?\*/', lambda m: ' ' * len(m.group(0)), text, flags=re.S)

# --- CSS -------------------------------------------------------------------
HEX = re.compile(r'#[0-9a-fA-F]{3,8}\b')
COLOR_FN = re.compile(r'\b(?:rgba?|hsla?|oklch|color)\(')
PX = re.compile(r'(?<![\w-])(\d*\.?\d+)(px|rem|em|vw|vh)\b')
ALLOWED_PX = {'0', '1', '100'}  # 0, волосяная линия 1px, 100 % ширины/высоты
for css in sorted((ROOT / 'styles').glob('*.css')):
    src = strip_comments(css.read_text(encoding='utf-8'))
    is_tokens = css.name == 'tokens.css'
    for n, line in enumerate(src.splitlines(), 1):
        s = line.strip()
        if not s or s.startswith('@media') or s.startswith('@container'):
            continue
        if is_tokens:
            continue
        if HEX.search(s) or COLOR_FN.search(s):
            add('raw', css, n, f'цвет числом: {s}')
        for m in PX.finditer(s):
            val, unit = m.group(1), m.group(2)
            if unit == 'px' and val in ALLOWED_PX: continue
            if 'clip:' in s or 'inset(' in s: continue
            add('raw', css, n, f'размер числом ({val}{unit}), нужен токен: {s}')
        if css.name in ('sections.css', 'components.css'):
            if re.search(r'\bfont-size\s*:', s): add('type', css, n, f'размер текста в правиле, нужен класс шкалы: {s}')
            if re.search(r'\bfont-family\s*:', s): add('type', css, n, f'гарнитура в правиле, только через токен в base.css: {s}')
        if re.search(r'text-transform\s*:\s*uppercase', s): add('type', css, n, 'капс запрещён')
        if re.search(r'monospace', s): add('type', css, n, 'моноширинный шрифт запрещён')
        if re.search(r'scroll-behavior\s*:\s*smooth', s): add('raw', css, n, 'scroll-behavior: smooth ломает съёмку и Lenis')
        if '!important' in s: add('raw', css, n, '!important – признак конфликта, разобраться')
        if re.search(r'cubic-bezier\(', s): add('raw', css, n, 'easing числом, нужен --ease-* токен')

# --- HTML ------------------------------------------------------------------
html = ROOT / 'index.html'
text = html.read_text(encoding='utf-8')
for n, line in enumerate(text.splitlines(), 1):
    if re.search(r'<(div|span)(\s+class="[^"]*")?\s*>\s*</\1>', line): add('spacer', html, n, f'пустой элемент: {line.strip()}')
    if re.search(r'\bhidden\b(?![-\w])', line) and '<' in line and 'data-' not in line.split('hidden')[0][-6:]:
        add('hidden', html, n, f'атрибут hidden – блок «на потом»?: {line.strip()[:80]}')
    if 'style="display:' in line.replace(' ', ''): add('hidden', html, n, 'inline display – убрать в стили')
    if '—' in line: add('text', html, n, 'длинное тире, только короткое «–»')
    if re.search(r'\s·\s', line): add('text', html, n, 'точка-разделитель «·» запрещена')
    if re.search(r'lorem\s+ipsum', line, re.I): add('text', html, n, 'lorem ipsum')
    if re.search(r'style="[^"]*#[0-9a-fA-F]{3,8}', line): add('raw', html, n, 'цвет в inline-стиле')
# закомментированный код: комментарии с тегами внутри (кроме заглавного комментария в <main>)
for m in re.finditer(r'<!--(.*?)-->', text, re.S):
    body = m.group(1)
    if re.search(r'<(section|div|ul|li|p|h[1-6]|img|video)\b', body) and 'Секции появляются здесь' not in body:
        n = text[:m.start()].count('\n') + 1
        add('hidden', html, n, 'закомментированная разметка – удалить')

# --- Движение: data-reveal только из реестра --------------------------------
motion = (ROOT / 'js' / 'motion.js').read_text(encoding='utf-8')
presets = set(re.findall(r"^\s+'([a-z-]+)':", motion, re.M))
for n, line in enumerate(text.splitlines(), 1):
    for name in re.findall(r'data-reveal="([^"]+)"', line):
        if name not in presets: add('motion', html, n, f'data-reveal="{name}" нет в реестре js/motion.js / docs/motion.md')

# --- Карта секций ------------------------------------------------------------
ds = ROOT / 'docs' / 'design-system.md'
ids_html = re.findall(r'<section\b[^>]*\bid="([^"]+)"', text)
map_ids = []
if ds.exists():
    dtext = ds.read_text(encoding='utf-8')
    part = dtext.split('## Карта секций', 1)[-1].split('\n## ', 1)[0]
    for row in part.splitlines():
        cells = [c.strip().strip('`') for c in row.strip().strip('|').split('|')]
        if len(cells) >= 2 and cells[0].isdigit(): map_ids.append(cells[1])
for sid in ids_html:
    if sid not in map_ids: add('map', html, 0, f'секция id="{sid}" не записана в карте секций docs/design-system.md')
for sid in map_ids:
    if sid and ids_html and sid not in ids_html:
        add('map', ds, 0, f'секция «{sid}» есть в карте, но не в index.html (статус в карте – концепт?)')

# --- Сцена -------------------------------------------------------------------
scene = ROOT / 'js' / 'scene.js'
if re.search(r'<[^>]*\bdata-scene\b', re.sub(r'<!--.*?-->', '', text, flags=re.S)) and scene.exists() and 'SMOKE_TEST' in scene.read_text(encoding='utf-8'):
    add('scene', scene, 0, 'на странице есть [data-scene], а в scene.js остался тестовый объект SMOKE_TEST')

# --- Отчёт -------------------------------------------------------------------
if not issues:
    print('check: 0 замечаний'); sys.exit(0)
by = {}
for cat, path, line, msg in issues:
    by.setdefault(cat, []).append((path, line, msg))
for cat, items in by.items():
    print(f'\n[{cat}] {len(items)}')
    for path, line, msg in items:
        print(f'  {path}:{line}  {msg}' if line else f'  {path}  {msg}')
print(f'\nвсего: {len(issues)}')
sys.exit(1)
