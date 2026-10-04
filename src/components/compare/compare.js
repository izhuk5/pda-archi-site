/* Шторка «до / после» пальцем или мышью (жест compare, docs/motion.md): input range пишет --split в кадр.
   Работает и без движения. В пин-режиме transformation ползунок скрыт стилями, шторку ведёт прокрутка (transformation.js). */
document.querySelectorAll('.compare-frame').forEach(frame => {
  const range = frame.querySelector('.compare-range');
  const apply = () => frame.style.setProperty('--split', `${range.value}%`);
  range.addEventListener('input', apply);
  apply();
});
