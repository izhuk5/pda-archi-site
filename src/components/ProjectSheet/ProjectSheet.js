/* Окна проектов (<dialog class="project-sheet">). Любая кнопка [data-project="id"] открывает #project-id – карточка projects и строка clients.
   Закрытие: кнопка [data-close], Esc (встроено в dialog), клик по фону вокруг окна. Пока окно открыто, Lenis стоит.
   Фокус после закрытия возвращается на ту кнопку, которая открыла окно (у одного окна их бывает две). */
import { scroll } from '@lib/scroll.js';

let opener = null;

document.querySelectorAll('.project-sheet').forEach(dialog => {
  dialog.addEventListener('close', () => {
    scroll.lenis?.start();
    opener?.focus({ preventScroll: true });
    opener = null;
  });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
});

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-project]');
  const dialog = btn && document.getElementById(`project-${btn.dataset.project}`);
  if (!dialog) return;
  opener = btn;
  dialog.showModal();
  dialog.scrollTop = 0;
  scroll.lenis?.stop();
});
