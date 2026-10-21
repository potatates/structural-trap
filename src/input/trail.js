// TRAIL: the player's light sheds a wake of tiny sparkles as it moves,
// like the glittering trail of a Patronus. Purely for feel.

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const MAX = 500;

export function createTrail(scene, presence, spark) {
  const P = CONFIG.presence;
  const pos = new Float32Array(MAX * 3);
  const alpha = new Float32Array(MAX);
  const vel = Array.from({ length: MAX }, () => new THREE.Vector3());
  const life = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: spark }, uColor: { value: new THREE.Color(0xcfe6ff) } },
    vertexShader: /* glsl */ `
      attribute float aAlpha; varying float vA;
      void main() { vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 22.0 / -mv.z * (0.5 + aAlpha); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; uniform vec3 uColor; varying float vA;
      void main() { float a = texture2D(uTex, gl_PointCoord).a * vA; gl_FragColor = vec4(uColor * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  let next = 0;
  const last = new THREE.Vector3().copy(presence.group.position);

  return {
    update(dt) {
      const here = presence.group.position;
      const moved = here.distanceTo(last);
      const n = Math.min(P.trail * 3, Math.floor(P.trail * Math.min(1, moved * 6)));
      for (let k = 0; k < n; k++) {
        const i = next; next = (next + 1) % MAX;
        // scatter along the path just travelled
        pos[i * 3] = THREE.MathUtils.lerp(last.x, here.x, Math.random()) + (Math.random() - 0.5) * 0.25;
        pos[i * 3 + 1] = THREE.MathUtils.lerp(last.y, here.y, Math.random()) + (Math.random() - 0.5) * 0.25;
        pos[i * 3 + 2] = THREE.MathUtils.lerp(last.z, here.z, Math.random()) + (Math.random() - 0.5) * 0.25;
        vel[i].set((Math.random() - 0.5) * 0.4, -0.15 - Math.random() * 0.3, (Math.random() - 0.5) * 0.4);
        life[i] = P.trailLife * (0.5 + Math.random() * 0.5);
      }
      last.copy(here);
      for (let i = 0; i < MAX; i++) {
        if (life[i] <= 0) { alpha[i] = 0; continue; }
        life[i] -= dt;
        pos[i * 3] += vel[i].x * dt; pos[i * 3 + 1] += vel[i].y * dt; pos[i * 3 + 2] += vel[i].z * dt;
        const f = Math.max(0, life[i] / P.trailLife);
        alpha[i] = f * (0.6 + 0.4 * Math.sin(i * 12.9 + life[i] * 20)); // each sparkle twinkles as it fades
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
    },
  };
}
