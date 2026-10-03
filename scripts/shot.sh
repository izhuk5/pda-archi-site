#!/usr/bin/env bash
# Скриншоты 1440 и 390 headless-Chrome в scripts/out/. Запуск из корня: scripts/shot.sh [id-секции]
# Страница снимается в режиме ?static (анимации выключены, всё видно); id секции сдвигает страницу к ней (&to=).
# Мобильная ширина – через scripts/mobile.html (iframe 390): окно уже ~500 px Chrome не сжимает, а режет.
# Сервер: берётся тот, что уже отдаёт ЭТУ папку (проверка по scripts/mobile.html), иначе поднимается на первом свободном порту.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/scripts/out"; mkdir -p "$OUT"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TO="${1:-}"
Q="static"; [ -n "$TO" ] && Q="$Q&to=$TO"

serves_us() { curl -s -m 2 "http://127.0.0.1:$1/scripts/mobile.html" | grep -q '<title>390</title>'; }
PORT=""
for p in $(seq "${PORT_FROM:-8765}" "$(( ${PORT_FROM:-8765} + 10 ))"); do
  if nc -z 127.0.0.1 "$p" 2>/dev/null; then
    serves_us "$p" && PORT="$p" && break
  else
    (cd "$ROOT" && python3 -m http.server "$p" --bind 127.0.0.1 >/dev/null 2>&1 &)
    sleep 1; PORT="$p"; break
  fi
done
[ -n "$PORT" ] || { echo "нет свободного порта"; exit 1; }

"$CHROME" --headless=new --hide-scrollbars --window-size=1440,900 --virtual-time-budget=10000 \
  --autoplay-policy=no-user-gesture-required \
  --screenshot="$OUT/desktop-1440.png" "http://127.0.0.1:$PORT/?$Q" 2>/dev/null
"$CHROME" --headless=new --hide-scrollbars --window-size=1440,900 --virtual-time-budget=10000 \
  --autoplay-policy=no-user-gesture-required \
  --screenshot="$OUT/mobile-390.png" "http://127.0.0.1:$PORT/scripts/mobile.html?$Q" 2>/dev/null
echo "готово (порт $PORT): $OUT/desktop-1440.png, $OUT/mobile-390.png (секция: ${TO:-вся страница})"
