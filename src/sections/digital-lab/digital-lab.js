/* Digital Lab: горизонтальная лента.
   – Приём h-scroll (docs/motion.md), на любой ширине: секция закрепляется, прокрутка сдвигает ленту на её лишнюю ширину.
     Раскладку в пине на телефоне задаёт CSS (.digital-lab.is-pinned в блоке ≤ 767).
   – Без движения (?static, reduced motion): лента листается вбок со scroll-snap, JS не нужен.
     Внутри ленты (containerAnimation): параллакс фото и появление текста шага. */
import { gsap } from '@lib/gsap.js';
import { onMotion } from '@lib/env.js';
import { token, tokenPx } from '@lib/tokens.js';

/* Скрипт подключён из digital-lab.astro – секция на странице есть всегда */
const sec = document.getElementById('digital-lab');
const track = sec.querySelector('.digital-lab-track');
const steps = Array.from(sec.querySelectorAll('.digital-lab-step'));

onMotion(() => {
  const yPx = () => tokenPx('--reveal-y', 24);
  const shift = parseFloat(token('--parallax-x')) || 6; /* числа без единиц */
  const zoom = parseFloat(token('--parallax-zoom')) || 1.2;
  sec.classList.add('is-pinned');
  const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
  const tw = gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: sec,
      start: 'top top',
      end: () => `+=${distance()}`,
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
    },
  });
  /* Масштаб – в том же твине: GSAP перезаписывает CSS-свойство scale у элемента с твином */
  sec.querySelectorAll('.digital-lab-figure img').forEach(img =>
    gsap.fromTo(
      img,
      { xPercent: -shift, scale: zoom },
      {
        xPercent: shift,
        scale: zoom,
        ease: 'none',
        scrollTrigger: {
          /* Рамка кадра, а не родитель: у <picture> из Photo нет своего блока (display: contents) */
          trigger: img.closest('.digital-lab-figure'),
          containerAnimation: tw,
          start: 'left right',
          end: 'right left',
          scrub: true,
        },
      },
    ),
  );
  steps.forEach(s => {
    gsap.from(s.querySelectorAll('.digital-lab-text > *'), {
      autoAlpha: 0,
      y: yPx(),
      stagger: 0.08,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: s, containerAnimation: tw, start: 'left 85%' },
    });
  });
  /* sort() и refresh() – один раз на всю страницу в конце initMotion (src/lib/motion.js): появления ниже учтут прокрутку ленты */
});
