// CAMERA DRIFT: the player is never still. They glide slowly forward above
// the dark ground, swaying slightly like something carried by a current,
// leaning a little toward wherever their attention (the pointer) goes.
// The horizon stays level so the motion feels calm, not disorienting.

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createDrift(camera, pointer) {
  const { height, pitch, forwardSpeed, swayAmount, swaySpeed, rollAmount, pointerParallax, pointerEase } = CONFIG.camera;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sway = reduced ? swayAmount * 0.3 : swayAmount;
  const lean = new THREE.Vector2();
  let z = 0;

  return {
    // speed lets later stages slow or stop the drift (e.g. during the reveal)
    speed: 1,
    update(t, dt) {
      z -= forwardSpeed * this.speed * dt;
      lean.x += (pointer.x - lean.x) * pointerEase;
      lean.y += (pointer.y - lean.y) * pointerEase;
      // two overlapping slow waves so the motion never feels like a loop
      const sx = Math.sin(t * swaySpeed * 6.1) * 0.6 + Math.sin(t * swaySpeed * 2.3 + 1.7) * 0.4;
      const sy = Math.sin(t * swaySpeed * 4.7 + 0.5) * 0.6 + Math.sin(t * swaySpeed * 1.9 + 3.1) * 0.4;
      camera.position.set(sx * sway + lean.x * pointerParallax, height + sy * sway * 0.4 + lean.y * pointerParallax * 0.3, z);
      camera.rotation.set(
        pitch + lean.y * 0.04 + sy * 0.006,
        -lean.x * 0.06 - sx * 0.01,
        Math.sin(t * swaySpeed * 3.3) * rollAmount,
      );
    },
  };
}
