/* Закреплённая шапка (docs/motion.md: header-blend, header-hide).
   – Цвет: после прокрутки на треть экрана – класс is-blend (mix-blend-mode: difference).
   – Подвал закрыл экран – строки уходят вверх под маску, класс is-hidden выключает клики; обратно – строки снизу по одной.
   Без движения (?static, reduced motion) – цвет так же, скрытие без анимации (класс is-gone). */
import { gsap } from '@lib/gsap.js';
import { motionOn, onMotion, ready } from '@lib/env.js';

const header = document.querySelector('.site-header');
const lines = header ? header.querySelectorAll('.site-header-line') : [];

let hidden = false;

ready.then(() => {
  if (!header) return;
  const footer = document.querySelector('.site-footer');

  const setHidden = next => {
    if (next === hidden) return;
    hidden = next;
    header.classList.toggle('is-hidden', next);
    if (!motionOn) { header.classList.toggle('is-gone', next); return; }
    /* Замер референса: скрытие – все строки разом; появление – по одной (имя, затем меню слева направо), шаг 0.1 s; длительности подобраны по кривым */
    if (next) gsap.to(lines, { yPercent: -100, duration: 1.3, ease: 'power4.out', overwrite: true });
    else gsap.fromTo(lines, { yPercent: 100 }, { yPercent: 0, duration: 1.55, ease: 'power4.out', stagger: 0.1, overwrite: true });
  };

  const update = () => {
    header.classList.toggle('is-blend', window.scrollY > window.innerHeight / 3);
    if (footer) {
      const r = footer.getBoundingClientRect();
      setHidden(r.top <= Math.max(0, window.innerHeight - r.height) + 1);
    }
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
});

/* Вход при загрузке: строки приходят снизу после фото hero (photo-in), задержка 1.1 s. Зарегистрирован после логики выше
   (обе ждут один ready), поэтому hidden уже известен: страница открыта у подвала – входа нет, строки придут при прокрутке вверх.
   Иначе вход и скрытие спорили бы за одни строки, и часть меню оставалась видна под маской */
onMotion(() => {
  if (header && !hidden) gsap.from(lines, { yPercent: 100, duration: 1.55, ease: 'power4.out', stagger: 0.1, delay: 1.1 });
});
