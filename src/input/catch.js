// ─────────────────────────────────────────────────────────────────────────────
// CATCHING AND CARRYING: how the player takes in a light and builds with it.
//
// Essay link: accepting an experience as a belief, and fitting it onto what you
// already believe. Press and hold on a drifting light: a ring tightens and it is
// caught. Keep holding to carry it; a faint thread shows which light in your
// structure would hold it. Release near the structure and it settles there.
// Release in empty dark and it floats away.
//
// The first light needs no structure: wherever you release it, it plants itself
// on the ground and becomes the base everything else will rest on.
//
// PULLING OUT (essay: revising a belief): press and hold on a light that is
// already in the structure. Everything that rests on it trembles, showing the
// cost before you commit. Hold through and it is pulled out, and all of that
// falls. Let go early and nothing happens.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createCatching(scene, camera, pointer, observations, structure, audio, ringTex, log) {
  const C = CONFIG.catching;
  let held = null;      // a light being caught (ring tightening)
  let carried = null;   // a caught light following the pointer
  let progress = 0;
  let support = null;   // where the carried light would rest if released now
  let pulling = null;   // a light in the structure being pulled out
  let pulledOnce = false; // until the player first pulls a light, cracked lights show a hint ring
  let pullProgress = 0;

  const ringMat = new THREE.SpriteMaterial({ map: ringTex, color: 0xfff2dc, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false });
  const ring = new THREE.Sprite(ringMat);
  scene.add(ring);
  const hintMat = ringMat.clone();
  const hint = new THREE.Sprite(hintMat);
  scene.add(hint);
  const targetMat = ringMat.clone();
  const target = new THREE.Sprite(targetMat);
  scene.add(target);

  // the preview threads from a carried light to the lights that would hold it
  // (its main support plus the neighbors it would link to)
  const pGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 2 * CONFIG.structure.maxLinks }, () => new THREE.Vector3()));
  const pMat = new THREE.LineBasicMaterial({ color: 0xffe6c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const preview = new THREE.LineSegments(pGeo, pMat);
  preview.frustumCulled = false;
  scene.add(preview);

  // carried lights move on the plane where the structure stands
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -structure.basePos.z);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const onPlane = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const amber = new THREE.Color(CONFIG.structure.color);
  const amberCore = amber.clone().lerp(new THREE.Color(0xffffff), 0.35);

  let pressConsumed = false; // one press does one thing: catch, or pull

  // the light in the structure under the pointer, if any
  function nodeUnder() {
    let best = null, bestD = Infinity;
    for (const n of structure.nodes) {
      tmp.copy(n.pos).project(camera);
      const d = Math.hypot((tmp.x - pointer.x) * camera.aspect, tmp.y - pointer.y);
      const depth = camera.position.z - n.pos.z;
      const reach = C.reach * 1.6 + n.size / Math.max(depth, 4);
      if (d < reach && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  const panOf = (pos) => Math.max(-0.9, Math.min(0.9, tmp.copy(pos).project(camera).x));

  function pointerOnPlane() {
    ndc.set(pointer.x, pointer.y);
    ray.setFromCamera(ndc, camera);
    ray.ray.intersectPlane(plane, onPlane);
    onPlane.y = Math.max(onPlane.y, structure.basePos.y + 0.3); // never below the ground
    return onPlane;
  }

  function place() {
    const l = carried; carried = null;
    if (support) {
      structure.add(l, l.group.position.clone(), support);
      audio.placed(panOf(l.group.position), support === 'ground');
      observations.remove(l);
      if (l.first) observations.releaseFlow();
    } else {
      l.state = 'lost';
      log.add('light_lost', { id: l.id });
      audio.lost(panOf(l.group.position));
      if (l.first) { l.first = false; }
    }
    support = null;
  }

  return {
    get busy() { return !!(held || carried); },
    update(t, dt) {
      if (pointer.down) {
        if (!held && !carried && !pulling && !pressConsumed) {
          const l = observations.touchable(pointer);
          if (l) { held = l; l.state = 'held'; progress = 0; pressConsumed = true; audio.holdStart(panOf(l.group.position)); }
          else {
            const n = nodeUnder();
            if (n) {
              pulling = n; pullProgress = 0; pressConsumed = true;
              const falls = structure.wouldFall(n);
              structure.setPreview(falls);
              audio.pullStart(panOf(n.pos), CONFIG.cracks.pullTime);
              // for the study: every reach toward letting a light go, and how long after its crack
              log.add('pull_started', { node: n.id, cracked: n.cracked, isBase: !n.parent, wouldFall: falls.length, sinceCrack: n.cracked ? +(performance.now() / 1000 - n.crackedAt).toFixed(1) : null });
            }
          }
        }
        if (pulling) {
          pullProgress += dt / CONFIG.cracks.pullTime;
          if (!structure.nodes.includes(pulling)) { pulling = null; structure.setPreview(null); }
          else if (pullProgress >= 1) {
            const n = pulling; pulling = null;
            const pan = panOf(n.pos);
            pulledOnce = true;
            const fell = structure.pull(n);
            audio.collapse(fell, pan, !n.parent);
            if (!structure.nodes.length) observations.allowNewBase && observations.allowNewBase();
          }
        }
        if (held) {
          progress += dt / C.holdTime;
          held.group.position.lerp(pointerOnPlane(), 0.02 + progress * 0.05);
          if (progress >= 1) {
            carried = held; held = null; progress = 0;
            carried.state = 'carried';
            log.add('light_caught', { id: carried.id, first: carried.first });
            audio.caught(panOf(carried.group.position));
          }
        }
        if (carried) {
          carried.group.position.lerp(pointerOnPlane(), C.carryEase);
          support = structure.supportFor(carried.group.position);
        }
      } else {
        pressConsumed = false;
        if (pulling) {
          log.add('pull_abandoned', { node: pulling.id, cracked: pulling.cracked, wouldFall: structure.wouldFall(pulling).length, progress: +pullProgress.toFixed(2) });
          pulling = null; structure.setPreview(null); audio.pullStop();
        }
        if (held) {
          log.add('catch_abandoned', { id: held.id, progress: +progress.toFixed(2) });
          held.state = 'drifting'; held = null; progress = 0;
        }
        if (carried) place();
      }

      // tightening ring while catching or pulling
      if (held) {
        ring.position.copy(held.group.position);
        ring.scale.setScalar(held.size * (4.2 - 2.4 * progress));
        ringMat.opacity = 0.25 + 0.5 * progress;
      } else if (pulling) {
        ring.position.copy(pulling.pos);
        ring.scale.setScalar(pulling.size * (4.6 - 3.0 * pullProgress));
        ringMat.opacity = 0.3 + 0.5 * pullProgress;
      } else ringMat.opacity *= 0.85;

      // where a carried light would rest: a thread to its holder, or a glow on the ground for the base
      if (carried && support) {
        const to = support === 'ground' ? structure.basePos : support.pos;
        const ends = [to, ...(support === 'ground' ? [] : structure.linksFor(carried.group.position, support).map((n) => n.pos))];
        const cp = carried.group.position;
        ends.forEach((e, k) => {
          pGeo.attributes.position.setXYZ(k * 2, cp.x, cp.y, cp.z);
          pGeo.attributes.position.setXYZ(k * 2 + 1, e.x, e.y, e.z);
        });
        pGeo.setDrawRange(0, ends.length * 2);
        pGeo.attributes.position.needsUpdate = true;
        pMat.opacity = 0.35 + 0.2 * Math.sin(t * 6);
        target.position.copy(to);
        target.scale.setScalar(support === 'ground' ? 2.6 + 0.3 * Math.sin(t * 3) : 1.8);
        targetMat.opacity = 0.35;
      } else if (carried && structure.nodes.length && structure.nodes.length <= C.hintPlacements) {
        // early on, a wordless hint: the nearest light in the structure calls the carried one
        // with a closing ring and a faint thread, until the player has the idea
        let near = null, nd = Infinity;
        for (const n of structure.nodes) { const d = n.pos.distanceTo(carried.group.position); if (d < nd) { nd = d; near = n; } }
        const cyc = (t * 0.8) % 1;
        target.position.copy(near.pos);
        target.scale.setScalar(4.5 - 2.7 * cyc);
        targetMat.opacity = 0.45 * Math.sin(cyc * Math.PI);
        pGeo.attributes.position.setXYZ(0, carried.group.position.x, carried.group.position.y, carried.group.position.z);
        pGeo.attributes.position.setXYZ(1, near.pos.x, near.pos.y, near.pos.z);
        pGeo.setDrawRange(0, 2);
        pGeo.attributes.position.needsUpdate = true;
        pMat.opacity = 0.08 + 0.06 * Math.sin(t * 6);
      } else if (!pulledOnce && !pulling && !held && !carried && structure.nodes.some((n) => n.cracked)) {
        // until the player has pulled a light once, a slow closing ring on the
        // cracked light suggests it can be held (and let go of)
        const cn = structure.nodes.find((n) => n.cracked);
        const cyc = (t * 0.5) % 1;
        target.position.copy(cn.pos);
        target.scale.setScalar(cn.size * (4.5 - 2.7 * cyc));
        targetMat.opacity = 0.35 * Math.sin(cyc * Math.PI);
        pMat.opacity *= 0.8;
      } else {
        pMat.opacity *= 0.8;
        targetMat.opacity *= 0.85;
      }

      // a carried light starts to warm toward the structure's amber
      if (carried) {
        carried.halo.material.color.lerp(amber, 0.03);
        carried.core.material.color.lerp(amberCore, 0.03);
      }

      // the wordless hint around the first light: a ring that keeps closing in
      const first = observations.lights.find((l) => l.first && l.state === 'drifting');
      if (first) {
        const cyc = (t * 0.55) % 1;
        hint.position.copy(first.group.position);
        hint.scale.setScalar(first.size * (5.2 - 3.0 * cyc));
        hintMat.opacity = 0.35 * Math.sin(cyc * Math.PI);
      } else hintMat.opacity *= 0.9;
    },
  };
}
