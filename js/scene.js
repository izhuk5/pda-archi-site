/* Three.js-сцена. Правила – docs/scene.md. Грузится лениво из main.js, когда [data-scene] близко к экрану.
   Инфраструктура: рендерер с потолком DPR 2, камера, ресайз, пауза вне экрана, прогресс по скроллу через ScrollTrigger,
   цвета из токенов. Объект сцены – слот buildObject(): здесь стоит тестовый объект SMOKE_TEST, на странице проекта его быть не должно. */
import * as THREE from 'three';

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* Объект сцены. Заменить целиком на то, что записано в базе (Принятые решения, пункт 6). */
const buildObject = (scene) => {
  /* SMOKE_TEST: проверка, что рендер, свет, ресайз и прогресс работают. Убрать перед первой секцией со сценой. */
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(css('--color-accent') || '#111111'), wireframe: true });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return { update: (t, progress) => { mesh.rotation.x = t * 0.3 + progress * Math.PI; mesh.rotation.y = t * 0.4; } };
};

export const mount = (host) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 4);

  const object = buildObject(scene);
  const state = { progress: 0, visible: true, t0: performance.now() };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(host);

  /* Пауза вне экрана: кадр не рисуется, пока сцена не видна */
  new IntersectionObserver(entries => { state.visible = entries.some(e => e.isIntersecting); }, { rootMargin: '10% 0px' }).observe(host);

  /* Прогресс прокрутки хоста через экран, 0…1 – через ScrollTrigger, свой обработчик скролла не пишется */
  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.create({ trigger: host, start: 'top bottom', end: 'bottom top', scrub: true, onUpdate: self => { state.progress = self.progress; } });
  }

  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!state.visible) return;
    object.update((performance.now() - state.t0) / 1000, state.progress);
    renderer.render(scene, camera);
  };
  tick();
  host.classList.add('is-live');

  return () => { cancelAnimationFrame(raf); renderer.dispose(); renderer.domElement.remove(); host.classList.remove('is-live'); };
};
