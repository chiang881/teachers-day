import {
  Box3,
  Group,
  HemisphereLight,
  DirectionalLight,
  Material,
  Mesh,
  PerspectiveCamera,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

type Options = {
  model: string;
  onReady: () => void;
  onError: () => void;
};

/** One scene-owned renderer. No model, bitmap, or GPU resources are cached globally. */
export function createJujubeViewer(host: HTMLElement, options: Options) {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 30);
  camera.position.set(0, 0.22, 4.7);
  camera.lookAt(0, 0, 0);
  scene.add(new HemisphereLight(0xfff3da, 0x785348, 2.4));
  const light = new DirectionalLight(0xffead0, 3);
  light.position.set(-3, 4, 5);
  scene.add(light);
  const rim = new DirectionalLight(0xffffff, 1.8);
  rim.position.set(3, 1, -2);
  scene.add(rim);
  const dates = new Group();
  scene.add(dates);
  const controller = new AbortController();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false,
    ready = false,
    spinning = true,
    inView = true;
  let frame = 0,
    previous = 0;
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  let drag: { id: number; x: number; y: number } | null = null;

  const render = () => {
    if (!disposed && ready) renderer.render(scene, camera);
  };
  const shouldAnimate = () =>
    ready && spinning && !motion.matches && !document.hidden && inView && !drag;
  const tick = (time: number) => {
    frame = 0;
    if (disposed || !shouldAnimate()) return;
    if (!previous || time - previous >= 1000 / 30) {
      const delta = previous ? Math.min(0.1, (time - previous) / 1000) : 0;
      dates.rotation.y += delta * 0.38;
      previous = time;
      render();
    }
    frame = requestAnimationFrame(tick);
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    if (!disposed && shouldAnimate()) frame = requestAnimationFrame(tick);
  };
  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  };
  const down = (event: PointerEvent) => {
    if (!ready || !event.isPrimary || event.button !== 0 || drag) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    schedule();
  };
  const move = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    dates.rotation.y += (event.clientX - drag.x) * 0.012;
    dates.rotation.x = Math.max(
      -0.65,
      Math.min(0.65, dates.rotation.x + (event.clientY - drag.y) * 0.008),
    );
    drag.x = event.clientX;
    drag.y = event.clientY;
    render();
  };
  const up = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    schedule();
  };
  const key = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    dates.rotation.y += event.key === 'ArrowLeft' ? -0.2 : 0.2;
    render();
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    if (!disposed) options.onError();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    schedule();
  });
  visibilityObserver.observe(host);
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', schedule);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  host.addEventListener('keydown', key);
  canvas.addEventListener('webglcontextlost', contextLost);

  const releaseModel = () => {
    dates.clear();
    textures.forEach((value) => value.dispose());
    textures.clear();
    materials.forEach((value) => value.dispose());
    materials.clear();
    geometries.forEach((value) => value.dispose());
    geometries.clear();
  };
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  void (async () => {
    try {
      const modelResponse = await fetch(options.model, {
        signal: controller.signal,
      });
      if (!modelResponse.ok) throw new Error('Gift asset unavailable');
      const modelBytes = await modelResponse.arrayBuffer();
      if (disposed || controller.signal.aborted)
        throw new Error('Gift load cancelled');
      const gltf = await new GLTFLoader().parseAsync(modelBytes, '');
      const model = gltf.scene;
      model.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        geometries.add(child.geometry);
        const meshMaterials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        meshMaterials.forEach((material) => {
          materials.add(material);
          Object.values(material).forEach((value) => {
            if (value instanceof Texture) textures.add(value);
          });
        });
      });
      if (disposed || controller.signal.aborted)
        throw new Error('Gift load cancelled');
      model.rotation.x = -Math.PI / 2;
      model.updateMatrixWorld(true);
      const sourceBounds = new Box3().setFromObject(model);
      const sourceSize = sourceBounds.getSize(new Vector3());
      const sourceCenter = sourceBounds.getCenter(new Vector3());
      const longestSide = Math.max(sourceSize.x, sourceSize.y, sourceSize.z);
      if (!Number.isFinite(longestSide) || longestSide <= 0)
        throw new Error('Invalid gift bounds');
      model.position.sub(sourceCenter);
      if (geometries.size === 0) throw new Error('Empty gift model');
      const normalized = new Group();
      normalized.add(model);
      normalized.scale.setScalar(2.05 / longestSide);
      for (const [x, y, z, scale, tilt] of [
        [-0.85, -0.14, 0, 0.85, -0.5],
        [0, 0.25, -0.1, 1, 0.16],
        [0.9, -0.2, 0.15, 0.82, 0.6],
      ]) {
        const fruit = normalized.clone(true);
        fruit.position.set(x, y, z);
        fruit.scale.multiplyScalar(scale);
        fruit.rotation.set(0.15, x * 1.4, tilt);
        dates.add(fruit);
      }
      // Check the imported geometry is finite before giving it to WebGL.
      const bounds = new Box3().setFromObject(dates);
      if (!Number.isFinite(bounds.max.x))
        throw new Error('Invalid gift bounds');
      ready = true;
      resize();
      options.onReady();
      schedule();
    } catch (error) {
      console.error('Unable to render the red-date model.', error);
      releaseModel();
      if (!disposed) options.onError();
    } finally {
      clearTimeout(timeout);
    }
  })();
  resize();
  return {
    setSpinning(value: boolean) {
      spinning = value;
      schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', schedule);
      motion.removeEventListener('change', schedule);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
      host.removeEventListener('keydown', key);
      canvas.removeEventListener('webglcontextlost', contextLost);
      releaseModel();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      canvas.width = canvas.height = 0;
    },
  };
}
