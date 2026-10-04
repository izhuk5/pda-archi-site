/* Clients на тач-экране (приём row-active, docs/motion.md): наведения нет, поэтому то же состояние даёт скролл –
   строка, которая пересекает линию 55 % высоты экрана, получает is-active: название сдвигается, обложка раскрывается (CSS).
   С мышью – обычный hover в clients.css, этот код не работает. Без движения (?static, reduced motion) обложки открыты сразу (CSS). */
import { gsap, ScrollTrigger } from '@lib/gsap.js';
import { onMotion } from '@lib/env.js';

const TOUCH = '(hover: none), (pointer: coarse)';

onMotion(() => {
  /* Скрипт подключён из clients.astro – строки на странице есть всегда */
  const rows = document.querySelectorAll('.clients-row');
  gsap.matchMedia().add(TOUCH, () => {
    rows.forEach(row =>
      ScrollTrigger.create({
        trigger: row,
        start: 'top 55%',
        end: 'bottom 55%',
        toggleClass: 'is-active',
      }),
    );
  });
});
