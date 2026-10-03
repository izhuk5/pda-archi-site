/* Режимы страницы – общие для src/lib/main.js и JS секций и компонентов.
   ?static – без анимаций, всё видно (для скриншотов); prefers-reduced-motion – то же для людей, которые просили меньше движения.
   onMotion(fn) – запустить своё движение секции: после загрузки шрифтов (не дольше 3 s) и только если движение включено. */
export const params = new URLSearchParams(location.search);
export const isStatic = params.has('static');
export const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const motionOn = !isStatic && !reduce;

export const ready = Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]);
export const onMotion = fn => ready.then(() => { if (motionOn) fn(); });
