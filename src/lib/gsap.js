/* Единая точка GSAP: импорт и регистрация плагинов – один раз здесь. Остальной код берёт GSAP только отсюда:
   import { gsap, ScrollTrigger } from '@lib/gsap.js';
   Зарегистрированы только используемые плагины: каждый лишний попадает в сборку целиком. Все плагины GSAP бесплатны;
   нужен новый (Flip, DrawSVG, ScrollTo…) – import, строка в registerPlugin и в export здесь, одна фраза «зачем» в LOG.md. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

export { gsap, ScrollTrigger, SplitText, CustomEase };
