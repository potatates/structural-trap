// ─────────────────────────────────────────────────────────────────────────────
// MAIN: boots the world and runs the frame loop.
//
// Stage 1 (Atmosphere): the dark forest, fog, dust, the player's
// presence, ambient sound, and slow camera drift.
// Stage A (Growing your light): lights drift in, the player catches one, carries
// it, and rests it on their structure. The structure's light clears the fog,
// lights the ground and fills out the music.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { CONFIG } from './config.js';
import { createAtmosphere } from './world/atmosphere.js';
import { createDrift } from './world/drift.js';
import { createForest } from './world/forest.js';
import { createTrail } from './input/trail.js';
import { createPointer, createPresence } from './input/presence.js';
import { createAudio } from './audio/audio.js';
import { showFragment } from './ui/fragments.js';
import { makeRingTexture, makeSparkTexture } from './world/textures.js';
import { createObservations } from './world/observations.js';
import { createStructure } from './structure/structure.js';
import { createCatching } from './input/catch.js';
import { createCracks } from './structure/cracks.js';
import { createArc } from './core/arc.js';
import { createReveal } from './ui/reveal.js';
import { createRunRecord, exportAll } from './study/store.js';
import { createLog } from './core/log.js';

// Debug overlay: add ?debug to the URL (or #debug) to see frame rate.
const DEBUG = /[?&#]debug/.test(location.search + location.hash);

const canvas = document.getElementById('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.maxPixelRatio));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.render.exposure;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, 0.1, 200);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), CONFIG.render.bloomStrength, CONFIG.render.bloomRadius, CONFIG.render.bloomThreshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const pointer = createPointer(canvas);
const atmosphere = createAtmosphere(scene, camera);
const drift = createDrift(camera, pointer);
const presence = createPresence(scene, camera, pointer, atmosphere.glow);
const audio = createAudio();
const log = createLog();
const spark = makeSparkTexture();
const observations = createObservations(scene, camera, atmosphere.glow, spark, log);
const structure = createStructure(scene, atmosphere.glow, spark, log);
const forest = createForest(scene, structure.basePos, renderer, atmosphere.glow, (pos) => audio.wake(pos), spark);
const trail = createTrail(scene, presence, spark);
const lightAt = new THREE.Vector3();
const record = createRunRecord(log);
const cracks = createCracks(structure, log, {
  variant: record.run.variant,
  onLateKept: () => { audio.baseCrack(); arc.baseCracked(); },
});
// a crack snaps; a falling light hits the water
let hintedLetGo = false;
const arc = createArc({ structure, cracks, observations, log, onEnd: (reason) => end(reason) });
structure.on({
  onCrack: (n) => {
    // the early version's crack is not the late game; only the late crack starts it
    if (!n.parent) { audio.baseCrack(); if (!n.early) arc.baseCracked(); }
    else audio.crack(Math.max(-0.9, Math.min(0.9, n.pos.x / 8)));
  },
  onPull: (n, wasBase) => arc.pulled(n, wasBase),
  onSplash: (pos) => audio.wake(pos),
});
const catching = createCatching(scene, camera, pointer, observations, structure, audio, makeRingTexture(), log);
// handy for testing in the browser console: window.game.log.events
window.game = { log, structure, observations, cracks, arc, forest, camera, CONFIG };

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  const r = CONFIG.render.bloomResolution;
  bloom.resolution.set(w * r, h * r);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ── Beginning: one touch wakes the world (browsers need a gesture for sound) ──
const veil = document.getElementById('veil');
const fragment = document.getElementById('fragment');
const howto = document.getElementById('howto');
let howtoText = '', howtoSwap = 0, playTime = 0;
document.getElementById('begin').textContent = CONFIG.text.begin;
// players elsewhere are told their play is recorded (only when runs are sent away)
if (CONFIG.study.endpoint) document.getElementById('notice').textContent = CONFIG.study.notice;

async function begin() {
  if (audio.started) return;
  veil.removeEventListener('pointerdown', begin);
  veil.classList.add('lifted');
  document.body.classList.add('awake');
  try { await audio.start(); } catch (e) { console.warn('Audio could not start', e); }
  const { opening, openingDelay, openingHold } = CONFIG.text;
  showFragment(fragment, opening, { delay: openingDelay, hold: openingHold });
  log.add('run_started', { variant: record.run.variant });
  record.begin();
  setInterval(record.save, CONFIG.study.saveEvery * 1000);
  observations.start();
}
veil.addEventListener('pointerdown', begin);

// The end of a run: the world fades to dark and quiet, then the reveal shows
// everything you built, and how much of it stood on the cracked base.
const reveal = createReveal(camera, structure, log, () => { record.save(); record.send('answered'); });
function end(reason) {
  const T = CONFIG.text;
  audio.fadeOut(T.endFade);
  document.getElementById('end').classList.add('on');
  document.body.classList.remove('awake'); // the pointer comes back
  fragment.classList.remove('on');
  log.add('run_ended', { reason });
  record.save();
  record.send('ended');
  setTimeout(() => reveal.start(reason), CONFIG.reveal.after * 1000);
}
veil.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') begin(); });

// Moving the pointer scatters sprinkles: every bit of travel rings a small bell.
let lastX = null, lastY = null, travel = 0;
canvas.addEventListener('pointermove', (e) => {
  const x = e.clientX / window.innerWidth, y = e.clientY / window.innerHeight;
  if (lastX !== null) {
    const step = Math.hypot(x - lastX, y - lastY);
    travel += step;
    if (travel > CONFIG.audio.touch.distance) {
      travel = 0;
      audio.touchAt(x * 2 - 1, 1 - y * 2, Math.min(1, step * 25));
    }
  }
  lastX = x; lastY = y;
});

// every run is saved on this computer for the study (see src/study/store.js)
window.addEventListener('pagehide', () => { record.save(); record.send('leaving'); });

window.addEventListener('keydown', (e) => {
  // hidden: Ctrl+Shift+E (Cmd+Shift+E on a Mac) downloads every saved run
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); record.save(); exportAll(); return; }
  if (e.key === 'm' || e.key === 'M') audio.toggleMute();
  if (DEBUG && (e.key === 'e' || e.key === 'E')) arc.forceEnd();
});
document.addEventListener('visibilitychange', () => audio.suspend(document.hidden));
window.addEventListener('focus', () => audio.wake());
for (const type of ['pointerdown', 'pointermove', 'keydown', 'touchstart']) window.addEventListener(type, () => audio.wake(), { passive: true });

// ── Frame loop ───────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
const fpsEl = DEBUG ? document.getElementById('debug') : null;
if (fpsEl) fpsEl.hidden = false;
let frames = 0, fpsTime = 0, fpsWall = performance.now();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  drift.update(t, dt);
  atmosphere.update(t, dt);
  presence.update(t);
  trail.update(dt);
  observations.update(t, dt);
  if (!arc.over) catching.update(t, dt); else catching.fadeOut();
  if (audio.started) { cracks.update(dt); arc.update(dt); }
  structure.update(t, dt);
  audio.setSour(structure.sour);
  // how to play: shown until the first light is set down
  if (audio.started) {
    playTime += dt;
    const T = CONFIG.text;
    const want = structure.nodes.length || arc.over ? '' : playTime > T.howtoAfter ? (catching.busy ? T.howtoCarry : T.howto) : '';
    if (want !== howtoText) {
      howtoText = want;
      howto.classList.remove('on');
      clearTimeout(howtoSwap);
      howtoSwap = setTimeout(() => { howto.textContent = want; if (want) howto.classList.add('on'); }, want && howto.textContent ? 700 : 0);
    }
  }
  // the one hint that a light can be let go: the first time a crack's dimness
  // has visibly spread into the lights around it
  if (!hintedLetGo && structure.nodes.some((n) => !n.cracked && n.murk > CONFIG.text.letGoMurk)) {
    hintedLetGo = true;
    const T = CONFIG.text;
    log.add('hint_let_go');
    showFragment(fragment, T.letGo, { delay: T.letGoDelay, hold: T.letGoHold });
  }
  // the structure's light opens up the world: it reaches into the forest, thins the fog, fills the music
  const light = structure.light;
  atmosphere.setClarity(light);
  audio.setFullness(light);
  forest.update(light, structure.center(lightAt), structure.nodes.length > 0, t, structure.litCount);
  composer.render();

  if (fpsEl) {
    frames++; fpsTime = (performance.now() - fpsWall) / 1000; // real time, not capped game time
    if (fpsTime > 0.5) {
      fpsWall = performance.now();
      const deepest = structure.nodes.reduce((m, n) => Math.max(m, n.depth), 0);
      fpsEl.textContent = `${Math.round(frames / fpsTime)} fps · drifting ${observations.lights.length} · structure ${structure.nodes.length} · height ${deepest} · light ${structure.light.toFixed(2)} · clarity ${atmosphere.clarity.toFixed(2)}`;
      frames = 0; fpsTime = 0;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
