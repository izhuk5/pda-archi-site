/* Режимы страницы – общие для src/lib/main.js и JS секций и компонентов.
   ?static – без анимаций, всё видно (для скриншотов); prefers-reduced-motion – то же для людей, которые просили меньше движения.
   onMotion(fn) – запустить своё движение секции: после загрузки шрифтов (не дольше 3 s) и только если движение включено.
   Включено ли движение, решает одно место – inline-скрипт в <head> src/layouts/base.astro (класс html.has-motion),
   здесь только читаем результат: модуль выполняется позже, когда класс уже стоит. */
export const params = new URLSearchParams(location.search);
export const isStatic = params.has('static');
export const motionOn = document.documentElement.classList.contains('has-motion');

export const ready = Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]);
export const onMotion = fn =>
  ready.then(() => {
    if (motionOn) fn();
  });
