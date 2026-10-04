/* Форма contact: до подключения отправки с сервера (вместе с CMS) открывает почтовую программу с готовым письмом
   на agence@pda.archi. Проверка полей – встроенная в браузер; сообщение о результате – в строке role="status". */
const form = document.querySelector('[data-contact-form]');
const status = form?.querySelector('.contact-status');

form?.addEventListener('submit', e => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const d = new FormData(form);
  const subject = `New project${d.get('company') ? ` – ${d.get('company')}` : ''}`;
  const body = `${d.get('message')}\n\n${d.get('name')}${d.get('company') ? `, ${d.get('company')}` : ''}\n${d.get('email')}`;
  window.location.href = `mailto:agence@pda.archi?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  if (status) status.textContent = 'Your email app opens with the message ready. If nothing happens, write to agence@pda.archi.';
});
