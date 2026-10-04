/* Форма contact – заглушка: открывает почтовую программу с готовым письмом на agence@pda.archi.
   Проверка полей – встроенная в браузер; сообщение о результате – в строке role="status".
   Скрипт подключён из contact.astro – форма и строка статуса на странице есть всегда. */
const form = document.querySelector('[data-contact-form]');
const status = form.querySelector('.contact-status');

form.addEventListener('submit', e => {
  e.preventDefault();
  if (!form.checkValidity()) return form.reportValidity();
  const d = new FormData(form);
  /* Компания необязательна: пустое значение выпадает из строки вместе с разделителем */
  const subject = ['New project', d.get('company')].filter(Boolean).join(' – ');
  const signature = [d.get('name'), d.get('company')].filter(Boolean).join(', ');
  const body = `${d.get('message')}\n\n${signature}\n${d.get('email')}`;
  window.location.href = `mailto:agence@pda.archi?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  status.textContent =
    'Your email app opens with the message ready. If nothing happens, write to agence@pda.archi.';
});
