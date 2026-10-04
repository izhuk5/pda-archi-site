/* Аккордеон expertise (приём accordion, docs/motion.md). Нативный <details> остаётся для доступности и работы без JS;
   клик по summary перехватывается, высота и содержимое анимируются GSAP, открыта одна строка.
   Пока движение не включено (?static, reduced motion, шрифты ещё грузятся) – мгновенно. На тач-экране – только высота панели,
   текст внутри не анимируется (gsap.matchMedia по наличию мыши). После смены высоты – ScrollTrigger.refresh для секций ниже.
   Якорь: если закрывается строка выше кликнутой, всё ниже неё уезжает вверх (замер: на 370 px на 1440) – пока идёт анимация,
   прокрутка компенсирует сдвиг, и кликнутая строка остаётся под курсором. */
import { gsap, ScrollTrigger } from '@lib/gsap.js';
import { onMotion } from '@lib/env.js';
import { scroll } from '@lib/scroll.js';
import { tokenPx } from '@lib/tokens.js';

const items = Array.from(document.querySelectorAll('.expertise-item'));
const kids = item => item.querySelectorAll('.expertise-inner > *');

/* Устройство с мышью: тач-экраны получают только раскрытие по высоте */
const FINE_POINTER = '(hover: hover) and (pointer: fine)';
let animate = false;
let textMotion = false;
onMotion(() => {
  animate = true;
  gsap.matchMedia().add(FINE_POINTER, () => {
    textMotion = true;
    /* Ушли с мыши на тач (планшет с клавиатурой) – текст, спрятанный закрытием, снова виден */
    return () => {
      textMotion = false;
      gsap.set(
        items.flatMap(i => [...kids(i)]),
        { clearProps: 'opacity,visibility,transform' },
      );
    };
  });
});
const revealY = () => tokenPx('--reveal-y', 24);
const refresh = () => ScrollTrigger.refresh();
const scrollBy = d => {
  if (!scroll.lenis) return window.scrollBy(0, d);
  scroll.lenis.scrollTo(scroll.lenis.scroll + d, { immediate: true, force: true });
};

/* Держит строку на месте в окне: сдвигает прокрутку на столько, на сколько строка ушла от y0 (её верх до клика).
   Без движения строки закрылись мгновенно – одной поправки хватает; с движением – поправка на каждом кадре, пока идёт анимация (1 s) */
const anchor = (el, y0) => {
  const fix = () => {
    const d = el.getBoundingClientRect().top - y0;
    if (Math.abs(d) > 0.5) scrollBy(d);
  };
  fix();
  if (!animate) return;
  gsap.ticker.add(fix);
  gsap.delayedCall(1, () => {
    fix();
    gsap.ticker.remove(fix);
  });
};

const close = item => {
  item.classList.remove('is-open');
  const panel = item.querySelector('.expertise-panel');
  if (!animate) {
    item.open = false;
    return;
  }
  const y = revealY();
  gsap.killTweensOf([panel, ...kids(item)]);
  const tl = gsap.timeline({
    onComplete: () => {
      item.open = false;
      gsap.set(panel, { clearProps: 'height' });
      refresh();
    },
  });
  if (textMotion)
    tl.to(kids(item), {
      autoAlpha: 0,
      y: -y / 2,
      duration: 0.25,
      ease: 'power2.in',
      stagger: 0.03,
    });
  tl.to(panel, { height: 0, duration: 0.6, ease: 'power3.inOut' }, textMotion ? 0.1 : 0);
};

const open = item => {
  item.classList.add('is-open');
  const panel = item.querySelector('.expertise-panel');
  item.open = true;
  if (!animate) return;
  const y = revealY();
  gsap.killTweensOf([panel, ...kids(item)]);
  const tl = gsap
    .timeline({
      onComplete: () => {
        gsap.set(panel, { clearProps: 'height' });
        refresh();
      },
    })
    .fromTo(panel, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'power3.inOut' });
  if (textMotion)
    tl.fromTo(
      kids(item),
      { autoAlpha: 0, y },
      { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.06 },
      0.25,
    );
};

items.forEach(item => {
  const summary = item.querySelector('summary');
  /* Двойной и тройной клик по строке не выделяет слово (браузер выделяет по mousedown со 2-го клика); выделение мышью остаётся */
  summary.addEventListener('mousedown', e => {
    if (e.detail > 1) e.preventDefault();
  });
  summary.addEventListener('click', e => {
    e.preventDefault();
    if (item.classList.contains('is-open')) return close(item);
    const before = items.filter(i => i !== item && i.classList.contains('is-open'));
    const above = before.some(i => items.indexOf(i) < items.indexOf(item));
    const y0 = summary.getBoundingClientRect().top;
    before.forEach(close);
    open(item);
    if (above) anchor(summary, y0);
  });
});
