/* Аккордеон expertise (приём accordion, docs/motion.md). Нативный <details> остаётся для доступности и работы без JS;
   клик по summary перехватывается, высота и содержимое анимируются GSAP, открыта одна строка.
   Пока движение не включено (?static, reduced motion, шрифты ещё грузятся) – мгновенно. После смены высоты – ScrollTrigger.refresh для секций ниже.
   Якорь: если закрывается строка выше кликнутой, всё ниже неё уезжает вверх (замер: на 370 px на 1440) – пока идёт анимация,
   прокрутка компенсирует сдвиг, и кликнутая строка остаётся под курсором. */
import { gsap, ScrollTrigger } from '@lib/gsap.js';
import { onMotion } from '@lib/env.js';
import { scroll } from '@lib/scroll.js';
import { tokenPx } from '@lib/tokens.js';

let animate = false;
onMotion(() => { animate = true; });

const items = Array.from(document.querySelectorAll('.expertise-item'));
const kids = item => item.querySelectorAll('.expertise-inner > *');
const revealY = () => tokenPx('--reveal-y', 24);
const refresh = () => ScrollTrigger.refresh();
const scrollBy = d => { if (scroll.lenis) scroll.lenis.scrollTo(scroll.lenis.scroll + d, { immediate: true, force: true }); else window.scrollBy(0, d); };

/* Держит строку на месте в окне: на каждом кадре сдвигает прокрутку на столько, на сколько строка ушла; ms – длительность анимации */
const anchor = (el, ms) => {
  const y0 = el.getBoundingClientRect().top;
  const fix = () => { const d = el.getBoundingClientRect().top - y0; if (Math.abs(d) > 0.5) scrollBy(d); };
  if (!animate) { fix(); return; }
  gsap.ticker.add(fix);
  gsap.delayedCall(ms / 1000, () => { fix(); gsap.ticker.remove(fix); });
};

const close = item => {
  item.classList.remove('is-open');
  const panel = item.querySelector('.expertise-panel');
  if (!animate) { item.open = false; return; }
  const y = revealY();
  gsap.killTweensOf([panel, ...kids(item)]);
  gsap.timeline({ onComplete: () => { item.open = false; gsap.set(panel, { clearProps: 'height' }); refresh(); } })
    .to(kids(item), { autoAlpha: 0, y: -y / 2, duration: 0.25, ease: 'power2.in', stagger: 0.03 })
    .to(panel, { height: 0, duration: 0.6, ease: 'power3.inOut' }, 0.1);
};

const open = item => {
  item.classList.add('is-open');
  const panel = item.querySelector('.expertise-panel');
  item.open = true;
  if (!animate) return;
  const y = revealY();
  gsap.killTweensOf([panel, ...kids(item)]);
  gsap.timeline({ onComplete: () => { gsap.set(panel, { clearProps: 'height' }); refresh(); } })
    .fromTo(panel, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'power3.inOut' })
    .fromTo(kids(item), { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.06 }, 0.25);
};

items.forEach(item => {
  const summary = item.querySelector('summary');
  /* Двойной и тройной клик по строке не выделяет слово (браузер выделяет по mousedown со 2-го клика); выделение мышью остаётся */
  summary.addEventListener('mousedown', e => { if (e.detail > 1) e.preventDefault(); });
  summary.addEventListener('click', e => {
    e.preventDefault();
    if (item.classList.contains('is-open')) { close(item); return; }
    const before = items.filter(i => i !== item && i.classList.contains('is-open'));
    const above = before.some(i => items.indexOf(i) < items.indexOf(item));
    const y0 = summary.getBoundingClientRect().top;
    before.forEach(close);
    open(item);
    if (above) { if (animate) anchor(summary, 1000); else scrollBy(summary.getBoundingClientRect().top - y0); }
  });
});
