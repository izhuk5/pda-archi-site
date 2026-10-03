/* Запуск. Режимы: ?static – без анимаций, всё видно (для скриншотов); &to=<id> – показать секцию (headless не рисует прокрутку,
   поэтому страница сдвигается отрицательным margin); prefers-reduced-motion – как static, но Lenis тоже выключен.
   Движение – js/motion.js (описание приёмов в docs/motion.md), 3D – js/scene.js лениво (docs/scene.md). */
import { initMotion } from './motion.js';

const params = new URLSearchParams(location.search);
const isStatic = params.has('static');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
const motionOn = !isStatic && !reduce && hasGsap;

/* Ленивое видео: в разметке data-src + preload="none"; src подставляется, когда секция в полутора экранах */
const lazyVideo = () => {
  const vids = document.querySelectorAll('video[data-src]');
  if (!vids.length) return;
  const load = v => { v.src = v.dataset.src; v.removeAttribute('data-src'); v.load(); if (v.autoplay) v.play().catch(() => {}); };
  if (isStatic || !('IntersectionObserver' in window)) { vids.forEach(load); return; }
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { load(e.target); io.unobserve(e.target); } }), { rootMargin: '50% 0px' });
  vids.forEach(v => io.observe(v));
};

/* 3D: модуль грузится, только если сцена есть на странице, WebGL доступен и движение включено; иначе остаётся запасной кадр */
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
  if (!motionOn || typeof Lenis === 'undefined') return null;
  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
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

document.fonts.ready.then(() => {
  if (motionOn) {
    document.documentElement.classList.add('has-motion');
    gsap.registerPlugin(ScrollTrigger, SplitText);
    smoothScroll();
    initMotion();
  } else {
    document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-ready'));
  }
  lazyVideo();
  lazyScene();
  if (isStatic) showSection();
});
