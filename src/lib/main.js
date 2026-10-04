/* Запуск. Режимы: ?static – без анимаций, всё видно (для скриншотов); &to=<id> – показать секцию (headless не рисует прокрутку,
   поэтому страница сдвигается отрицательным margin); prefers-reduced-motion – как static, но Lenis тоже выключен.
   Класс html.has-motion ставит inline-скрипт в <head> до первой отрисовки; здесь он снимается, если движение не запустилось.
   Подключается из src/layouts/Base.astro. GSAP – из src/lib/gsap.js, режимы – из src/lib/env.js.
   Движение – src/lib/motion.js (описание приёмов в docs/motion.md), 3D – src/lib/scene.js лениво (docs/scene.md). */
import { gsap, ScrollTrigger } from './gsap.js';
import { params, isStatic, reduce, motionOn, ready } from './env.js';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { initMotion } from './motion.js';
import { scroll } from './scroll.js';

/* Ленивое видео: в разметке data-src + preload="none"; src подставляется, когда секция в полутора экранах */
const lazyVideo = () => {
  const vids = document.querySelectorAll('video[data-src]');
  if (!vids.length) return;
  const load = v => { v.src = v.dataset.src; v.removeAttribute('data-src'); v.load(); if (v.autoplay) v.play().catch(() => {}); };
  if (isStatic || !('IntersectionObserver' in window)) { vids.forEach(load); return; }
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { load(e.target); io.unobserve(e.target); } }), { rootMargin: '50% 0px' });
  vids.forEach(v => io.observe(v));
};

/* 3D: модуль (вместе с Three.js – отдельный файл сборки) грузится, только если сцена есть на странице, WebGL доступен и движение включено; иначе остаётся запасной кадр */
const lazyScene = () => {
  const host = document.querySelector('[data-scene]');
  if (!host) return;
  const canvas = document.createElement('canvas');
  const webgl = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  if (!webgl || isStatic || reduce) return;
  const start = () => import('./scene.js').then(m => m.mount(host)).catch(err => console.warn('scene: не запустилась', err));
  if (!('IntersectionObserver' in window)) { start(); return; }
  const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '100% 0px' });
  io.observe(host);
};

/* Плавный скролл: Lenis на тикере GSAP, якоря – через lenis.scrollTo */
const smoothScroll = () => {
  if (!motionOn) return null;
  const lenis = new Lenis({ lerp: 0.1 });
  scroll.lenis = lenis;  /* для секций и компонентов: src/lib/scroll.js */
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    /* getElementById, а не querySelector: href="#" и id с цифры не роняют обработчик */
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.2 });
  }));
  return lenis;
};

const showSection = () => {
  const id = params.get('to');
  const el = id && document.getElementById(id);
  if (el) document.body.style.marginTop = `-${el.offsetTop}px`;
};

/* Без движения или при ошибке в нём – всё видно сразу */
const showAll = () => {
  document.documentElement.classList.remove('has-motion');
  document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-ready'));
};

/* Шрифты ждём не дольше 3 s (ready из env.js): пока они грузятся, элементы с data-reveal скрыты */
ready.then(() => {
  if (motionOn) {
    try {
      smoothScroll();
      initMotion();
    } catch (err) {
      console.warn('motion: не запустилось, показываю всё', err);
      showAll();
    }
  } else {
    showAll();
  }
  lazyVideo();
  lazyScene();
  if (isStatic) showSection();
});
