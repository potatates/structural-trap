// ─────────────────────────────────────────────────────────────────────────────
// OBSERVATIONS: the lights that drift toward the player out of the dark.
//
// Essay link: these are experiences the world offers. Catching one and resting
// it on your structure is accepting it as a belief. They look alike on purpose:
// nothing on the surface tells you which will hold up later (stage B).
// Every light is logged, caught or not.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { pathX } from './forest.js';

const rand = (a, b) => a + Math.random() * (b - a);
let nextId = 1;

export function createObservations(scene, camera, glow, spark, log) {
  const O = CONFIG.observations;
  const lights = [];
  let timer = O.firstDelay;
  let started = false;
  let waitingForFirst = true; // nothing else arrives until the first light is placed
  const tmp = new THREE.Vector3();

  function makeSprite(color, scale, opacity, map = glow) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map, color, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    s.scale.setScalar(scale);
    return s;
  }

  // where a light drifting at depth z with sideways offset `off` should be: inside
  // the path while it is among the trees, free to spread out once in the clearing
  const home = new THREE.Vector3(...CONFIG.structure.base);
  function alongPath(z, off) {
    const open = THREE.MathUtils.smoothstep(z, home.z - 22, home.z - 4);
    const narrow = Math.min(Math.abs(off), CONFIG.forest.pathWidth * 0.7) * Math.sign(off);
    return pathX(z, home) + THREE.MathUtils.lerp(narrow, off, open);
  }

  function spawn(opts = {}) {
    const color = new THREE.Color(O.colors[Math.floor(Math.random() * O.colors.length)]);
    const size = rand(O.size[0], O.size[1]);
    const group = new THREE.Group();
    const halo = makeSprite(color, size * 1.7, 0.3);
    const core = makeSprite(color.clone().lerp(new THREE.Color(0xffffff), 0.6), size * 0.9, 1, spark);
    group.add(halo, core);
    // lights come down the open path through the forest, so the trees never hide them
    const off = opts.x ?? rand(-O.spreadX, O.spreadX);
    const from = opts.distance ?? O.spawnDistance;
    group.position.set(0, opts.y ?? rand(O.spreadY[0], O.spreadY[1]), camera.position.z - from);
    group.position.x = alongPath(group.position.z, off);
    scene.add(group);
    const light = {
      id: nextId++, color, size, group, halo, core,
      speed: opts.speed ?? rand(O.speed[0], O.speed[1]),
      sway: rand(0, 100), off, from,
      state: 'drifting', // drifting → held → carried → placed | lost | passed
      first: !!opts.first,
      fade: 1,
    };
    lights.push(light);
    log.add('light_appeared', { id: light.id, first: light.first });
    return light;
  }

  function remove(light) {
    scene.remove(light.group);
    light.group.traverse((o) => o.material && o.material.dispose());
    const i = lights.indexOf(light);
    if (i >= 0) lights.splice(i, 1);
  }

  return {
    lights,
    remove,
    start() { started = true; },
    // the game's arc slows the flow of new lights late on, and stops it at the end
    gapScale: 1,
    stop() { started = false; },
    // after the first light is placed, the world opens up
    releaseFlow() { waitingForFirst = false; timer = rand(O.gap[0], O.gap[1]); },
    // after everything has fallen, the next light caught becomes a new base (no special first light needed)
    allowNewBase() {},

    // The drifting light under the player's own light, if any (screen-space test).
    touchable(pointer) {
      let best = null, bestD = Infinity;
      for (const l of lights) {
        if (l.state !== 'drifting') continue;
        tmp.copy(l.group.position).project(camera);
        if (tmp.z > 1) continue;
        const d = Math.hypot((tmp.x - pointer.x) * camera.aspect, tmp.y - pointer.y);
        const depth = camera.position.z - l.group.position.z;
        const reach = CONFIG.catching.reach * 2 + (l.size * 1.2) / Math.max(depth, 4);
        if (d < reach && d < bestD) { best = l; bestD = d; }
      }
      return best;
    },

    update(t, dt) {
      if (started) {
        // the first light was let go or missed: send another
        if (waitingForFirst && timer === Infinity && !lights.some((l) => l.first)) timer = 1.5;
        timer -= dt;
        const drifting = lights.filter((l) => l.state === 'drifting').length;
        if (timer <= 0) {
          if (waitingForFirst) {
            // the first light comes alone and slowly, straight ahead
            if (!lights.some((l) => l.first)) spawn({ first: true, speed: O.firstSpeed, distance: O.firstDistance, x: rand(-1, 1), y: rand(-1.5, 0.5) });
            timer = Infinity;
          } else if (drifting < O.maxAlive) {
            spawn();
            timer = rand(O.gap[0], O.gap[1]) * this.gapScale;
          }
        }
      }

      for (let i = lights.length - 1; i >= 0; i--) {
        const l = lights[i];
        if (l.state === 'drifting') {
          l.group.position.z += l.speed * dt;
          l.group.position.x = alongPath(l.group.position.z, l.off) + Math.sin(t * 0.3 + l.sway) * 0.6;
          l.group.position.y += Math.cos(t * 0.25 + l.sway) * 0.1 * dt;
          if (l.group.position.z > camera.position.z + 1) {
            log.add('light_passed', { id: l.id, first: l.first });
            if (l.first) timer = 1.5; // the first light comes again if it was missed
            remove(l);
            continue;
          }
        }
        if (l.state === 'lost') {
          // let go in the dark: it rises and fades away
          l.group.position.y += CONFIG.catching.lostFloat * dt;
          l.fade -= dt * 0.6;
          if (l.fade <= 0) { remove(l); continue; }
        }
        const depth = camera.position.z - l.group.position.z;
        const fadeIn = THREE.MathUtils.smoothstep(l.from - depth, 0, l.first ? 4 : 10);
        const flicker = 0.92 + 0.08 * Math.sin(t * 3 + l.sway);
        const b = fadeIn * flicker * l.fade;
        l.halo.material.opacity = 0.3 * b;
        l.core.material.opacity = b;
      }
    },
  };
}
