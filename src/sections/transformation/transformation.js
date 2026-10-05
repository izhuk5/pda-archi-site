/* Пин-секция «было – стало» (приём compare-pin, docs/motion.md): шторка и смена кадра – по скроллу, смена текста главы – по времени.
   Только от 768 px (gsap.matchMedia); телефон, ?static, reduced motion – главы стопкой со шторкой пальцем (compare.js). */
import { gsap, SplitText } from '@lib/gsap.js';
import { onMotion } from '@lib/env.js';

onMotion(() => {
  /* Скрипт подключён из transformation.astro – секция на странице есть всегда */
  const el = document.getElementById('transformation');
  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
    const chapters = Array.from(el.querySelectorAll('.transformation-chapter'));
    const frames = chapters.map(c => c.querySelector('.compare-frame'));
    const caps = chapters.map(c => c.querySelector('figcaption'));
    const count = el.querySelector('.transformation-count');
    el.classList.add('is-pinned');
    let current = 0;
    const lines = [];
    /* Текст главы – строки в масках, пока секция закреплена; autoSplit пересобирает строки при смене ширины */
    const splits = chapters.map((c, i) =>
      SplitText.create(c.querySelectorAll('.transformation-text > *'), {
        type: 'lines',
        mask: 'lines',
        linesClass: 'line',
        aria: 'none' /* строки слов не рвут; aria-label на <p> запрещён – см. src/lib/motion.js */,
        autoSplit: true,
        onSplit: self => {
          lines[i] = self.lines;
          gsap.set(self.lines, { yPercent: i === current ? 0 : 110 });
        },
      }),
    );
    gsap.set(caps.slice(1), { autoAlpha: 0 });
    const show = next => {
      if (next === current) return;
      const dir = next > current ? 1 : -1;
      gsap.to(lines[current], {
        yPercent: -110 * dir,
        duration: 0.5,
        ease: 'power3.in',
        stagger: 0.03,
        overwrite: true,
      });
      gsap.to(caps[current], { autoAlpha: 0, duration: 0.3, overwrite: true });
      gsap.fromTo(
        lines[next],
        { yPercent: 110 * dir },
        {
          yPercent: 0,
          duration: 0.9,
          ease: 'power4.out',
          stagger: 0.06,
          delay: 0.3,
          overwrite: true,
        },
      );
      gsap.to(caps[next], { autoAlpha: 1, duration: 0.6, delay: 0.5, overwrite: true });
      count.textContent = `${next + 1} / ${chapters.length}`;
      current = next;
    };
    /* Глава и прогресс считаются по времени таймлайна (onUpdate таймлайна, а не ScrollTrigger): scrub догоняет скролл ещё ~1 s
       после остановки, событие скролла к этому времени уже не приходит */
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: 'top top',
        end: () => `+=${chapters.length * window.innerHeight}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
      onUpdate: () => {
        el.style.setProperty('--tr-p', tl.progress().toFixed(4));
        const t = tl.time();
        /* Текущая глава – последняя, чья метка уже пройдена (ch0 стоит на 0, поэтому -1 не бывает) */
        show(chapters.findLastIndex((_, i) => t >= tl.labels[`ch${i}`] - 0.0001));
      },
    });
    /* Стартовые значения – внутри таймлайна: выставленное до него ScrollTrigger при пересчёте пина откатывает */
    tl.set(frames, { '--split': '100%' }, 0);
    tl.set(frames.slice(1), { clipPath: 'inset(100% 0% 0% 0%)' }, 0);
    tl.addLabel('ch0', 0);
    chapters.forEach((c, i) => {
      if (i) {
        /* Кадр следующей главы открывается снизу поверх предыдущего, фото внутри оседает */
        tl.addLabel(`ch${i}`);
        tl.to(frames[i], { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.4, ease: 'power2.inOut' });
        tl.fromTo(
          frames[i].querySelectorAll('img'),
          { scale: 1.15 },
          { scale: 1, duration: 0.4, ease: 'power2.out' },
          '<',
        );
      }
      tl.fromTo(
        frames[i],
        { '--split': '100%' },
        { '--split': '0%', duration: 1, ease: 'none', immediateRender: false },
      );
      tl.to({}, { duration: 0.25 });
    });
    return () => {
      el.classList.remove('is-pinned');
      el.style.removeProperty('--tr-p');
      splits.forEach(s => s.revert());
      gsap.set([...frames, ...caps, ...frames.flatMap(f => [...f.querySelectorAll('img')])], {
        clearProps: 'all',
      });
      count.textContent = `1 / ${chapters.length}`;
    };
  });
  /* sort() и refresh() – один раз на всю страницу в конце initMotion (src/lib/motion.js): появления ниже учтут три экрана пина */
});
