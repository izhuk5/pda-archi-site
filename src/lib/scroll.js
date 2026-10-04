/* Общая ссылка на плавный скролл. src/lib/main.js кладёт сюда экземпляр Lenis, когда движение включено;
   секции и компоненты берут его отсюда: держать якорь у аккордеона.
   Без движения (?static, reduced motion) – null: проверять перед вызовом (scroll.lenis?.stop()). */
export const scroll = { lenis: null };
