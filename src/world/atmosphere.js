// ─────────────────────────────────────────────────────────────────────────────
// ATMOSPHERE: the dark space the player drifts through.
//
// Essay link: this is the world before belief: dark, foggy, undifferentiated.
// It only opens up as the player builds their structure of light. `clarity`
// (0..1, from the structure) thins the fog, lifts the darkness and brings the
// distant glows into view. Losing light closes the world back in.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { makeGlowTexture, makeFogTexture, makeSparkTexture } from './textures.js';

const rand = (a, b) => a + Math.random() * (b - a);

export function createAtmosphere(scene, camera) {
  const glow = makeGlowTexture();
  scene.background = new THREE.Color(CONFIG.space.background);
  scene.fog = new THREE.FogExp2(CONFIG.space.fogColor, CONFIG.space.fogDensity);

  const dust = createDust(makeSparkTexture(64));
  const banks = createFogBanks(scene);
  const far = createFarLights(scene, glow);
  scene.add(dust.points);

  const L = CONFIG.light;
  const dark = new THREE.Color(L.background[0]), lit = new THREE.Color(L.background[1]);
  let clarity = 0;

  return {
    glow,
    // how much the player's light has opened up the world (eased, so it never jumps)
    setClarity(c) { clarity += (c - clarity) * 0.02; },
    get clarity() { return clarity; },
    update(t, dt) {
      const lerp = THREE.MathUtils.lerp;
      scene.fog.density = lerp(L.fogDensity[0], L.fogDensity[1], clarity);
      scene.background.copy(dark).lerp(lit, clarity);
      scene.fog.color.copy(scene.background);
      dust.points.material.uniforms.uFogDensity.value = scene.fog.density;
      dust.update(t, camera);
      banks.update(t, dt, camera, lerp(L.fogBankOpacity[0], L.fogBankOpacity[1], clarity));
      far.update(t, camera, lerp(L.farLights[0], L.farLights[1], clarity));
    },
  };
}

// Dust: thousands of motes in a box that always surrounds the camera, so the
// space feels endless. All motion happens on the GPU for smoothness.
function createDust(glow) {
  const { count, volume, size, color, opacity, drift, fall, twinkle } = CONFIG.dust;
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random() * volume[0];
    pos[i * 3 + 1] = Math.random() * volume[1];
    pos[i * 3 + 2] = Math.random() * volume[2];
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uVol: { value: new THREE.Vector3(...volume) },
      uSize: { value: size * 260 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uDrift: { value: drift },
      uFall: { value: fall },
      uTwinkle: { value: twinkle },
      uTex: { value: glow },
      uFogDensity: { value: CONFIG.space.fogDensity },
    },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime, uSize, uDrift, uFall, uTwinkle;
      uniform vec3 uCam, uVol;
      varying float vAlpha;
      varying float vDepth;
      void main() {
        // wander on its own slow path
        vec3 p = position + uDrift * vec3(
          sin(uTime * 0.13 + seed * 40.0) * 6.0,
          sin(uTime * 0.09 + seed * 70.0) * 4.0,
          cos(uTime * 0.11 + seed * 20.0) * 6.0);
        // gravity: every mote slowly settles downward, some faster than others
        p.y -= uTime * uFall * (0.6 + seed * 0.8);
        // wrap the box around the camera so the dust never runs out
        p = mod(p - uCam + uVol * 0.5, uVol) - uVol * 0.5 + uCam;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vDepth = -mv.z;
        float tw = 1.0 - uTwinkle * 0.5 * (1.0 + sin(uTime * (0.6 + seed * 1.8) + seed * 100.0));
        // soften motes right at the edges of the box so wrapping never pops
        vec3 e = abs(p - uCam) / (uVol * 0.5);
        float edge = 1.0 - smoothstep(0.75, 1.0, max(max(e.x, e.y), e.z));
        vAlpha = tw * edge * (0.35 + seed * 0.65);
        gl_PointSize = uSize * (0.4 + seed) / max(vDepth, 0.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform vec3 uColor;
      uniform float uOpacity, uFogDensity;
      varying float vAlpha;
      varying float vDepth;
      void main() {
        float fog = exp(-pow(uFogDensity * vDepth, 2.0));
        float a = texture2D(uTex, gl_PointCoord).a * vAlpha * uOpacity * fog;
        // too close to the lens reads as a smear, so fade those out
        a *= smoothstep(0.6, 2.5, vDepth);
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(t, cam) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uCam.value.copy(cam.position);
    },
  };
}

// Fog banks: big soft clouds layered in depth. As the camera glides forward,
// banks behind it are recycled far ahead, so the fog rolls past forever.
function createFogBanks(scene) {
  const { count, size, opacity, color, roll, drift, lowerTo, spread, flow } = CONFIG.fogBanks;
  const textures = [1, 2, 3, 4].map((s) => makeFogTexture(s, 512));
  const depth = 90;
  const banks = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: textures[i % textures.length],
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    });
    const s = new THREE.Sprite(mat);
    const sc = rand(size[0], size[1]);
    s.scale.set(sc, sc * rand(0.5, 0.9), 1);
    s.position.set(rand(-35, 35), lowerTo + rand(-spread * 0.4, spread), -rand(0, depth));
    s.userData = {
      spin: rand(-roll, roll),
      phase: rand(0, 100),
      base: opacity * rand(0.5, 1.2),
    };
    mat.rotation = rand(0, Math.PI * 2);
    scene.add(s);
    banks.push(s);
  }
  return {
    update(t, dt, cam, amount = 1) {
      for (const s of banks) {
        const u = s.userData;
        s.material.rotation += u.spin * dt;
        s.position.x += Math.sin(t * 0.05 + u.phase) * drift * dt;
        s.position.y += Math.cos(t * 0.04 + u.phase) * drift * 0.5 * dt;
        // recycle banks that slip behind the camera
        if (s.position.z > cam.position.z + 8) {
          s.position.z -= depth;
          s.position.x = cam.position.x + rand(-35, 35);
          s.position.y = lowerTo + rand(-spread * 0.4, spread);
        }
        // slow breathing in density; fade in when close to avoid hard edges
        const near = THREE.MathUtils.smoothstep(cam.position.z - s.position.z, 2, 14);
        s.position.z += flow * dt; // the fog slowly rolls toward you
        s.material.opacity = u.base * amount * near * (0.7 + 0.3 * Math.sin(t * 0.07 + u.phase));
      }
    },
  };
}

// Far lights: a handful of distant glows, always just out of reach.
function createFarLights(scene, glow) {
  const { count, distance, size, colors, breathe } = CONFIG.farLights;
  const lights = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: glow,
      color: colors[i % colors.length],
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const s = new THREE.Sprite(mat);
    const sc = rand(size[0], size[1]);
    s.scale.setScalar(sc);
    s.userData = { phase: rand(0, 100), offset: new THREE.Vector3(rand(-50, 50), rand(-1, 14), -rand(distance[0], distance[1])) };
    scene.add(s);
    lights.push(s);
  }
  return {
    update(t, cam, amount = 1) {
      for (const s of lights) {
        const u = s.userData;
        // they keep their distance: drift with the camera, sliding very slowly
        s.position.copy(cam.position).add(u.offset);
        s.position.x += Math.sin(t * 0.02 + u.phase) * 4;
        s.material.opacity = amount * (0.08 + 0.17 * (0.5 + 0.5 * Math.sin(t * breathe + u.phase)));
      }
    },
  };
}
