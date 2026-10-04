/* Токены из :root в JS. Размеры в src/styles/tokens.css – в rem, а GSAP и расчёты в JS ждут пиксели:
   parseFloat('1.5rem') дал бы 1.5 px вместо 24. tokenPx переводит rem и em от корня в px по текущему кеглю корня
   (если человек увеличил шрифт в браузере, подъём при появлении вырастет вместе с ним). */
const rootStyle = () => getComputedStyle(document.documentElement);

/* Значение токена строкой, как в tokens.css: token('--color-accent') → '#131313' */
export const token = name => rootStyle().getPropertyValue(name).trim();

/* Размер токена в px: tokenPx('--reveal-y') → 24 при кегле корня 16 px. Число без единиц и px – как есть; нет токена – fallback */
export const tokenPx = (name, fallback = 0) => {
  const value = token(name);
  const n = parseFloat(value);
  if (Number.isNaN(n)) return fallback;
  if (/r?em$/.test(value)) return n * parseFloat(rootStyle().fontSize);
  return n;
};
