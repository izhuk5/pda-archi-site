/* Digital Lab: горизонтальная лента.
   – Без пина (телефон, ?static, reduced motion): лента листается вбок со scroll-snap, JS не нужен.
   – Приём h-scroll (docs/motion.md), от 768 px: секция закрепляется, прокрутка сдвигает ленту на её лишнюю ширину.
     Внутри ленты (containerAnimation): параллакс фото и появление текста шага. */
import { gsap, ScrollTrigger } from '@lib/gsap.js';
import { onMotion } from '@lib/env.js';
import { token, tokenPx } from '@lib/tokens.js';

const sec = document.getElementById('digital-lab');
const track = sec?.querySelector('.digital-lab-track');
const steps = sec ? Array.from(sec.querySelectorAll('.digital-lab-step')) : [];

onMotion(() => {
  if (!sec || !track) return;
  const yPx = () => tokenPx('--reveal-y', 24);
  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
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
            trigger: img.parentElement,
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
    return () => {
      sec.classList.remove('is-pinned');
      gsap.set(track, { clearProps: 'all' });
    };
  });
  /* Пин создан здесь, а появления ниже – в src/lib/motion.js: без сортировки триггеры ниже не учтут прокрутку ленты */
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
});
