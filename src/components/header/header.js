/* Закреплённая шапка (docs/motion.md: header-blend, header-hide).
   – Цвет: после прокрутки на треть экрана – класс is-blend (mix-blend-mode: difference).
   – Подвал закрыл экран – строки уходят вверх под маску, класс is-hidden выключает клики; обратно – строки снизу по одной.
   Без движения (?static, reduced motion) – цвет так же, скрытие без анимации (класс is-gone).
   Пороги считает ScrollTrigger: пересчитывает их при ресайзе и после пинов секций, свой обработчик скролла не пишется.
   onEnter / onLeaveBack, а не isActive: у конца страницы прогресс триггера = 1, а isActive при 1 уже false. */
import { gsap, ScrollTrigger } from '@lib/gsap.js';
import { motionOn, onMotion, ready } from '@lib/env.js';

/* Скрипт подключён из header.astro – шапка на странице есть всегда */
const header = document.querySelector('.header');
const lines = header.querySelectorAll('.header-line');

let hidden = false;

const setBlend = on => header.classList.toggle('is-blend', on);

/* Замер референса: скрытие – все строки разом; появление – по одной (имя, затем меню слева направо), шаг 0.1 s; длительности подобраны по кривым */
const hideLines = () =>
  gsap.to(lines, { yPercent: -100, duration: 1.3, ease: 'power4.out', overwrite: true });
const showLines = () =>
  gsap.fromTo(
    lines,
    { yPercent: 100 },
    { yPercent: 0, duration: 1.55, ease: 'power4.out', stagger: 0.1, overwrite: true },
  );

const setHidden = next => {
  if (next === hidden) return;
  hidden = next;
  header.classList.toggle('is-hidden', next);
  if (!motionOn) return header.classList.toggle('is-gone', next);
  (next ? hideLines : showLines)();
};

ready.then(() => {
  /* header-blend: start – позиция прокрутки в px; функция, чтобы порог пересчитывался при ресайзе */
  const blend = ScrollTrigger.create({
    start: () => window.innerHeight / 3,
    end: 'max',
    onEnter: () => setBlend(true),
    onLeaveBack: () => setBlend(false),
  });
  setBlend(blend.progress > 0);

  /* header-hide: подвал закрыл экран. Подвал ниже окна – его низ дошёл до низа окна, выше окна – его верх до верха окна.
     +=2 – запас 1 px на дробную прокрутку у конца страницы (ScrollTrigger срабатывает строго после start, отсюда ещё 1) */
  /* Подвал – чужой компонент: на странице без него шапка просто не прячется */
  const footer = document.querySelector('.footer');
  if (!footer) return;
  const hide = ScrollTrigger.create({
    trigger: footer,
    start: () => (footer.offsetHeight > window.innerHeight ? 'top top+=2' : 'bottom bottom+=2'),
    end: 'max',
    onEnter: () => setHidden(true),
    onLeaveBack: () => setHidden(false),
  });
  setHidden(hide.progress > 0);
});

/* Вход при загрузке: строки приходят снизу после фото hero (photo-in), задержка 1.1 s. Зарегистрирован после логики выше
   (обе ждут один ready), поэтому hidden уже известен: страница открыта у подвала – входа нет, строки придут при прокрутке вверх.
   Иначе вход и скрытие спорили бы за одни строки, и часть меню оставалась видна под маской */
onMotion(() => {
  if (!hidden)
    gsap.from(lines, {
      yPercent: 100,
      duration: 1.55,
      ease: 'power4.out',
      stagger: 0.1,
      delay: 1.1,
    });
});
