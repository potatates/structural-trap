// PRESENCE: the player's own small light, floating where the pointer is.
// It is how the player "touches the world." In stage 2 it becomes the thing
// that catches observations. The system cursor is hidden; this replaces it.

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createPointer(el) {
  // normalized device coords: -1..1 on both axes, (0,0) at screen center
  const pointer = { x: 0, y: 0, down: false, active: false };
  const set = (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    pointer.active = true;
  };
  el.addEventListener('pointermove', set);
  el.addEventListener('pointerdown', (e) => { set(e); pointer.down = true; });
  window.addEventListener('pointerup', () => { pointer.down = false; });
  el.addEventListener('pointerleave', () => { pointer.active = false; });
  return pointer;
}

export function createPresence(scene, camera, pointer, glow) {
  const { color, size, distance, ease, breathe } = CONFIG.presence;
  const group = new THREE.Group();
  const make = (scale, opacity) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, color, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    s.scale.setScalar(scale);
    group.add(s);
    return s;
  };
  const halo = make(size * 3.2, 0.18);
  const core = make(size * 0.55, 0.9);
  scene.add(group);

  const target = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  let visible = 0;

  return {
    group,
    get visibility() { return visible; },
    update(t) {
      // project the pointer into the world at a fixed distance from the eye
      ndc.set(pointer.x, pointer.y, 0.5).unproject(camera);
      target.copy(ndc).sub(camera.position).normalize().multiplyScalar(distance).add(camera.position);
      group.position.lerp(target, ease);
      // keep up with the forward drift exactly so the light never trails behind
      group.position.z = target.z;
      visible += ((pointer.active ? 1 : 0.35) - visible) * 0.05;
      const b = 0.85 + 0.15 * Math.sin(t * breathe * Math.PI * 2);
      const press = pointer.down ? 1.35 : 1;
      halo.material.opacity = 0.18 * b * visible * press;
      core.material.opacity = 0.9 * visible;
      halo.scale.setScalar(size * 3.2 * b * press);
    },
  };
}
