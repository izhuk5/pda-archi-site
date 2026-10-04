/* Реестр приёмов data-reveal. Каждый приём описан в docs/motion.md до того, как появился здесь.
   Порядок в элементе: подготовить начальное состояние → пометить is-ready (снять visibility: hidden) → твин по ScrollTrigger.
   Переопределения из разметки: data-reveal-delay="0.2", data-reveal-stagger="0.05".
   GSAP и плагины – из src/lib/gsap.js. Запускает src/lib/main.js. */
import { gsap, ScrollTrigger, SplitText, CustomEase } from './gsap.js';

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const num = (el, key, fallback) => (el.dataset[key] !== undefined ? parseFloat(el.dataset[key]) : fallback);
const ready = el => el.classList.add('is-ready');
/* Элемент, видимый уже при загрузке (первый экран), появляется сразу: его верх ниже линии 85 % и иначе ждал бы прокрутки */
const inFirstScreen = el => el.getBoundingClientRect().top < window.innerHeight;
/* clamp(): у конца страницы точка 85 % может оказаться дальше, чем страница прокручивается, – тогда элемент не появится никогда */
const trigger = (el, once = true) => ({ trigger: el, start: inFirstScreen(el) ? 'top bottom' : 'clamp(top 85%)', once });
const yPx = () => parseFloat(css('--reveal-y')) || 24;

/* Easing из токенов. GSAP не понимает строку cubic-bezier(…) и молча подставляет свой дефолт, поэтому каждый --ease-* из :root
   регистрируется как CustomEase с тем же именем без «--»: --ease-sharp → ease: 'ease-sharp'. Новый токен подхватывается сам */
const registerEases = () => {
  const found = new Set();
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } /* чужие таблицы (Google Fonts) читать нельзя */
    for (const rule of rules) {
      if (!rule.selectorText || !rule.selectorText.split(',').some(s => s.trim() === ':root')) continue;
      for (const prop of rule.style) if (prop.startsWith('--ease-')) found.add(prop);
    }
  }
  found.forEach(prop => {
    const m = css(prop).match(/cubic-bezier\(([^)]+)\)/);
    if (m) CustomEase.create(prop.slice(2), m[1].replace(/\s+/g, ''));
    else console.warn(`motion: ${prop} не cubic-bezier(), пропущен`);
  });
};
const ease = (name, fallback) => (CustomEase.get(name) ? name : fallback);

export const PRESETS = {
  'fade': (el) => {
    gsap.set(el, { autoAlpha: 0, y: yPx() }); ready(el);
    /* power3.out – как на старом сайте (подпись hero); токен --ease-out шаблона – другая, более резкая кривая */
    gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: num(el, 'revealDelay', 0), scrollTrigger: trigger(el) });
  },
  'lines': (el) => {
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line' }); ready(el);
    gsap.from(split.lines, { yPercent: 110, duration: 0.9, ease: 'power4.out', stagger: num(el, 'revealStagger', 0.08), delay: num(el, 'revealDelay', 0), scrollTrigger: trigger(el), onComplete: () => split.revert() });
  },
  'words': (el) => {
    /* Заявление about (docs/motion.md): слова по одному выезжают из маски строки, замер kononenkogroup.com – 1.55 s expo.out, шаг 0.1 */
    const split = SplitText.create(el, { type: 'lines,words', mask: 'lines', linesClass: 'line' }); ready(el);
    gsap.from(split.words, { yPercent: 101, duration: 1.55, ease: 'expo.out', stagger: num(el, 'revealStagger', 0.1), delay: num(el, 'revealDelay', 0), scrollTrigger: trigger(el), onComplete: () => split.revert() });
  },
  'chars': (el) => {
    const split = SplitText.create(el, { type: 'lines,chars', mask: 'lines', linesClass: 'line' }); ready(el);
    gsap.from(split.chars, { yPercent: 110, duration: 1, ease: 'power4.out', stagger: num(el, 'revealStagger', 0.025), delay: num(el, 'revealDelay', 0), scrollTrigger: trigger(el), onComplete: () => split.revert() });
  },
  'letters': (el) => {
    /* Знак в подвале (docs/motion.md): буквы по одной снизу, маска – сам элемент (overflow: clip в CSS) */
    const split = SplitText.create(el, { type: 'chars' }); ready(el);
    gsap.from(split.chars, { y: () => el.offsetHeight * 1.05, duration: 1.6, ease: 'expo.out', stagger: num(el, 'revealStagger', 0.065),
      delay: num(el, 'revealDelay', 0), scrollTrigger: { trigger: el, start: 'clamp(top 75%)', once: true }, onComplete: () => split.revert() });
  },
  'clip': (el) => {
    gsap.set(el, { clipPath: 'inset(100% 0 0 0)' }); ready(el);
    /* power1.out – раскрытие сразу и плавно тормозит. Так фото открывались на старом сайте (утверждено глазами): там стояла строка
       cubic-bezier(--ease-sharp), GSAP её не понимал и брал свой power1.out. Настоящий --ease-sharp (медленный старт, рывок посередине)
       ощущается резко – замер 2026-10-04: 7 % за 300 мс, затем 17 → 63 % за 100 мс */
    gsap.to(el, { clipPath: 'inset(0% 0 0 0)', duration: 1, ease: 'power1.out', delay: num(el, 'revealDelay', 0), scrollTrigger: trigger(el) });
  },
  'card': (el) => {
    const kids = Array.from(el.children);
    gsap.set(el, { autoAlpha: 0, y: yPx() * 2, scale: 0.98 }); gsap.set(kids, { autoAlpha: 0, y: yPx() * 0.6 }); ready(el);
    const tl = gsap.timeline({ scrollTrigger: trigger(el), delay: num(el, 'revealDelay', 0) });
    tl.to(el, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out' })
      .to(kids, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: num(el, 'revealStagger', 0.1) }, '-=0.5');
  },
  'stagger': (el) => {
    const kids = Array.from(el.children);
    gsap.set(kids, { autoAlpha: 0, y: yPx() }); ready(el);
    gsap.to(kids, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: num(el, 'revealStagger', 0.08), delay: num(el, 'revealDelay', 0), scrollTrigger: trigger(el) });
  },
  'rows': (el) => {
    /* Длинный список: каждая строка появляется сама, когда въезжает на экран (ScrollTrigger.batch), а не все разом */
    const kids = Array.from(el.children);
    gsap.set(kids, { autoAlpha: 0, y: yPx() }); ready(el);
    ScrollTrigger.batch(kids, { start: 'clamp(top 92%)', once: true,
      onEnter: batch => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: num(el, 'revealStagger', 0.06), overwrite: true }) });
  },
  'photo-in': (el) => {
    /* Фото первого экрана: из фона страницы с лёгким масштабом. Затемнение секции (::before) читает --photo-in */
    const section = el.closest('section');
    gsap.set(el, { autoAlpha: 0, scale: 1.06 }); if (section) gsap.set(section, { '--photo-in': 0 }); ready(el);
    const play = () => {
      const tl = gsap.timeline({ delay: num(el, 'revealDelay', 0) });
      tl.to(el, { autoAlpha: 1, scale: 1, duration: 1.4, ease: 'power2.out' });
      if (section) tl.to(section, { '--photo-in': 1, duration: 1.4, ease: 'power2.out' }, 0);
    };
    (el.decode ? el.decode() : Promise.resolve()).then(play, play);
  },
  'scrub': (el) => {
    /* Прогресс прокрутки элемента через экран → CSS-переменная --p (0…1). Что с ней делать, решает правило секции */
    ready(el);
    gsap.fromTo(el, { '--p': 0 }, { '--p': 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1 } });
  },
};

export const initMotion = () => {
  gsap.config({ nullTargetWarn: false });
  registerEases();
  document.querySelectorAll('[data-reveal]').forEach(el => {
    const name = el.dataset.reveal;
    const fn = PRESETS[name];
    if (!fn) { console.warn(`motion: приёма "${name}" нет в реестре (docs/motion.md)`); ready(el); return; }
    fn(el);
  });
  ScrollTrigger.refresh();
};
