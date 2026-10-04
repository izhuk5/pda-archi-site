/* Digital Lab: горизонтальная лента.
   – Без пина (телефон, ?static, reduced motion): лента листается вбок, линия прогресса заполняется по scrollLeft, счётчик – последний шаг,
     чей левый край прошёл 60 % ширины ленты.
   – Приём h-scroll (docs/motion.md), от 768 px: секция закрепляется, прокрутка сдвигает ленту на её лишнюю ширину.
     Внутри ленты (containerAnimation): параллакс фото, появление текста шага, прогресс и счётчик. */
import { gsap, ScrollTrigger } from '@lib/gsap.js';
import { onMotion } from '@lib/env.js';
import { token, tokenPx } from '@lib/tokens.js';

const sec = document.getElementById('digital-lab');
const track = sec?.querySelector('.digital-lab-track');
const count = sec?.querySelector('.digital-lab-count');
const steps = sec ? Array.from(sec.querySelectorAll('.digital-lab-step')) : [];
const label = i => `${String(i + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`;

/* Прогресс при нативной прокрутке ленты; в пин-режиме (data-pinned) его ведёт h-scroll */
if (sec && track && count) {
  const update = () => {
    if (sec.dataset.pinned !== undefined) return;
    const max = track.scrollWidth - track.clientWidth;
    sec.style.setProperty('--track-p', max > 0 ? (track.scrollLeft / max).toFixed(4) : '0');
    const edge = track.getBoundingClientRect().left + track.clientWidth * 0.6;
    let active = 0;
    steps.forEach((s, i) => { if (s.getBoundingClientRect().left < edge) active = i; });
    count.textContent = label(active);
  };
  track.addEventListener('scroll', update, { passive: true });
  update();
}

onMotion(() => {
  if (!sec || !track) return;
  const yPx = () => tokenPx('--reveal-y', 24);
  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
    const shift = parseFloat(token('--parallax-x')) || 6;  /* числа без единиц */
    const zoom = parseFloat(token('--parallax-zoom')) || 1.2;
    sec.classList.add('is-pinned');
    sec.dataset.pinned = '';
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tw = gsap.to(track, { x: () => -distance(), ease: 'none', scrollTrigger: {
      trigger: sec, start: 'top top', end: () => `+=${distance()}`, pin: true, scrub: 1, invalidateOnRefresh: true,
      onUpdate: self => sec.style.setProperty('--track-p', self.progress.toFixed(4)) } });
    /* Масштаб – в том же твине: GSAP перезаписывает CSS-свойство scale у элемента с твином */
    sec.querySelectorAll('.digital-lab-figure img').forEach(img => gsap.fromTo(img, { xPercent: -shift, scale: zoom }, { xPercent: shift, scale: zoom, ease: 'none',
      scrollTrigger: { trigger: img.parentElement, containerAnimation: tw, start: 'left right', end: 'right left', scrub: true } }));
    steps.forEach((s, i) => {
      ScrollTrigger.create({ trigger: s, containerAnimation: tw, start: 'left 60%', end: 'right 60%',
        onToggle: self => { if (self.isActive && count) count.textContent = label(i); } });
      gsap.from(s.querySelectorAll('.digital-lab-text > *'), { autoAlpha: 0, y: yPx(), stagger: 0.08, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: s, containerAnimation: tw, start: 'left 85%' } });
    });
    return () => { sec.classList.remove('is-pinned'); delete sec.dataset.pinned; sec.style.removeProperty('--track-p'); gsap.set(track, { clearProps: 'all' }); };
  });
  /* Пин создан здесь, а появления ниже – в src/lib/motion.js: без сортировки триггеры ниже не учтут прокрутку ленты */
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
});
