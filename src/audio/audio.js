// ─────────────────────────────────────────────────────────────────────────────
// SOUND: the ambient world.
//
// Sound carries as much meaning as light in this game: soft pad chords that
// drift from one to the next, a faint warm root, little bell "sprinkles"
// scattered through space, and a high breath of air. The music is thin in the
// dark and grows fuller as the player's structure of light grows (`fullness`),
// so losing light is heard as well as seen. Everything flows into one long
// reverb so it shares one space.
// Uses Tone.js (loaded as a global `Tone`).
// ─────────────────────────────────────────────────────────────────────────────

import { CONFIG } from '../config.js';

const Tone = window.Tone;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const between = (a, b) => a + Math.random() * (b - a);

export function createAudio() {
  const A = CONFIG.audio;
  let started = false;
  let muted = false;
  const timers = [];
  let reverb, touch, events;
  const mix = { fullness: 0, sour: 0, rots: [] }; // fullness: 0 = in the dark, 1 = fully lit; sour: 0 = sound, 1 = gone bad

  async function start() {
    if (started) return;
    started = true;
    await Tone.start();
    Tone.Destination.volume.value = -60;

    reverb = new Tone.Reverb({ decay: A.reverb.decay, wet: A.reverb.wet }).toDestination();
    await reverb.generate();

    mix.pad = buildPad(reverb, A.pad, A.sub, timers, mix);
    buildSprinkles(reverb, A.sprinkles, timers, mix);
    touch = buildTouch(reverb, A.sprinkles.notes, A.touch, mix);
    events = buildEvents(reverb, A.events);
    buildAir(reverb, A.air);

    Tone.Destination.volume.rampTo(A.masterVolume, A.fadeIn);
  }

  return {
    start,
    get started() { return started; },
    // the reverb bus, so later stages can send their own sounds into the same space
    get space() { return reverb; },
    // a sprinkle where the pointer is: x, y in -1..1, speed 0..1
    touchAt(x, y, speed) { if (started && !muted && touch) touch(x, y, speed); },
    // game sounds (each takes a stereo position -1..1)
    holdStart(p) { if (events) events.holdStart(p); },
    caught(p) { if (events) events.caught(p); },
    placed(p, isBase) { if (events) events.placed(p, isBase); },
    lost(p) { if (events) events.lost(p); },
    crack(p) { if (events) events.crack(p); },
    baseCrack() { if (events) events.baseCrack(); },
    // the end: everything slowly falls silent
    fadeOut(seconds) { if (started) Tone.Destination.volume.rampTo(-60, seconds); },
    pullStart(p, dur) { if (events) events.pullStart(p, dur); },
    pullStop() { if (events) events.pullStop(); },
    collapse(n, p, isBase) { if (events) events.collapse(n, p, isBase); },
    wake(pos) { if (events && !muted) events.wake(Math.max(-0.9, Math.min(0.9, pos.x / 25))); },
    // how soured the structure is (0..1): the music itself goes bad. Notes slide out
    // of tune, warble like a warped tape, and turn grainy; wrong notes creep in.
    setSour(x) {
      if (!started || Math.abs(x - mix.sour) < 0.02) return;
      mix.sour = x;
      for (const r of mix.rots) r(x);
    },
    // how full the music is (0..1), following the structure's light
    setFullness(f) {
      mix.fullness += (f - mix.fullness) * 0.02;
      if (mix.pad) {
        const F = A.fullness.padBoost;
        mix.pad.volume.value = F[0] + (F[1] - F[0]) * mix.fullness;
      }
    },
    toggleMute() {
      if (!started) return;
      muted = !muted;
      Tone.Destination.mute = muted;
    },
    suspend(hidden) {
      if (!started) return;
      if (hidden) Tone.getContext().rawContext.suspend();
      else Tone.getContext().rawContext.resume();
    },
    stop() { timers.forEach(clearTimeout); },
  };
}

// Rot: what a soured structure does to a sound. A warble (like a warped tape),
// grit, and a darker tone, all at zero until something goes bad.
function makeRot(out, mix, warble) {
  const R = CONFIG.audio.rot;
  const dark = new Tone.Filter({ type: 'lowpass', frequency: 12000, Q: 0.5 }).connect(out);
  const grit = new Tone.Distortion({ distortion: R.grit, wet: 0 }).connect(dark);
  const vib = new Tone.Vibrato({ frequency: R.warbleRate, depth: 0 }).connect(grit);
  mix.rots.push((x) => {
    vib.depth.rampTo(x * warble, 0.8);
    grit.wet.rampTo(x * R.gritWet, 0.8);
    dark.frequency.rampTo(12000 - x * (12000 - R.darkTo), 0.8);
  });
  return vib;
}

// a note that has gone bad: pulled a semitone off, or a little out of tune
function sourNote(note, mix) {
  if (Math.random() < mix.sour * mix.sour * CONFIG.audio.rot.wrongNotes) return Tone.Frequency(note).transpose(Math.random() < 0.5 ? 1 : -1).toNote();
  return note;
}

// Pad: chords that bloom in slowly and overlap as they change, so the harmony
// is always moving but never lands hard. A soft low root follows each chord.
function buildPad(out, pad, sub, timers, mix) {
  const boost = new Tone.Volume(CONFIG.audio.fullness.padBoost[0]).connect(makeRot(out, mix, CONFIG.audio.rot.padWarble));
  const chorus = new Tone.Chorus({ frequency: 0.3, delayTime: 4, depth: 0.6, wet: 0.5 }).connect(boost).start();
  const filter = new Tone.Filter({ type: 'lowpass', frequency: pad.brightness, Q: 0.3 }).connect(chorus);
  new Tone.LFO({ frequency: 0.04, min: pad.brightness * 0.6, max: pad.brightness * 1.4 }).connect(filter.frequency).start();
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fattriangle', count: 3, spread: 14 },
    envelope: { attack: 5, decay: 2, sustain: 0.7, release: 9 },
    volume: pad.volume,
  }).connect(filter);
  synth.maxPolyphony = 24;

  const subSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 6, decay: 1, sustain: 1, release: 8 },
    volume: sub.volume,
  }).connect(boost);

  let i = 0;
  const next = () => {
    const chord = pad.chords[i % pad.chords.length];
    // not every voice every time: small variations keep it from looping
    const V = CONFIG.audio.fullness.voices;
    const count = Math.round(V[0] + (V[1] - V[0]) * mix.fullness);
    const voices = chord.filter(() => Math.random() < 0.85).slice(0, Math.max(1, count)).map((n) => sourNote(n, mix));
    synth.triggerAttackRelease(voices, pad.every * 0.9);
    subSynth.triggerAttackRelease(Tone.Frequency(chord[0]).transpose(-12), pad.every * 0.9);
    i++;
    timers.push(setTimeout(next, pad.every * 1000));
  };
  next();
  return boost;
}

// Sprinkles: bell-like notes that appear here and there in space, sometimes
// alone, sometimes in a little run, each followed by a soft bouncing echo.
function buildSprinkles(out, sp, timers, mix) {
  const pan = new Tone.Panner(0).connect(makeRot(out, mix, CONFIG.audio.rot.sprinkleWarble));
  const echo = new Tone.PingPongDelay({ delayTime: '8n.', feedback: 0.35, wet: sp.echo }).connect(pan);
  const bell = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 2,
    oscillator: { type: 'sine' },
    modulation: { type: 'sine' },
    envelope: { attack: 0.005, decay: 1.6, sustain: 0, release: 1.8 },
    modulationEnvelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.5 },
    volume: sp.volume,
  }).connect(echo);
  bell.maxPolyphony = 16;

  const sprinkle = () => {
    pan.pan.rampTo(between(-0.85, 0.85), 0.05);
    const now = Tone.now();
    if (Math.random() < sp.runChance) {
      // a little run: up or down through nearby notes
      const len = 2 + Math.floor(Math.random() * 4);
      let idx = Math.floor(Math.random() * sp.notes.length);
      const dir = Math.random() < 0.5 ? 1 : -1;
      for (let k = 0; k < len; k++) {
        const note = sourNote(sp.notes[Math.max(0, Math.min(sp.notes.length - 1, idx))], mix);
        bell.triggerAttackRelease(note, 0.6, now + k * between(0.11, 0.2), between(0.35, 0.8));
        idx += dir * (Math.random() < 0.7 ? 1 : 2);
      }
    } else {
      bell.triggerAttackRelease(sourNote(pick(sp.notes), mix), 0.8, now, between(0.4, 0.9));
    }
    const R = CONFIG.audio.fullness.sprinkleRate;
    const rate = R[0] + (R[1] - R[0]) * mix.fullness;
    timers.push(setTimeout(sprinkle, (between(sp.everyMin, sp.everyMax) / rate) * 1000));
  };
  timers.push(setTimeout(sprinkle, 2500));
}

// Touch: the player's movement sounds. Each step of pointer travel rings one
// small bell; its pitch follows height on screen and it is heard where it happens.
// This is the player "touching the world," and will matter more once lights can be caught.
function buildTouch(out, notes, cfg, mix) {
  const pan = new Tone.Panner(0).connect(makeRot(out, mix, CONFIG.audio.rot.sprinkleWarble));
  const echo = new Tone.FeedbackDelay({ delayTime: 0.23, feedback: 0.25, wet: 0.25 }).connect(pan);
  const bell = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 4.01,
    modulationIndex: 1.2,
    oscillator: { type: 'sine' },
    modulation: { type: 'sine' },
    envelope: { attack: 0.003, decay: 0.9, sustain: 0, release: 1.2 },
    modulationEnvelope: { attack: 0.003, decay: 0.25, sustain: 0, release: 0.3 },
    volume: cfg.volume,
  }).connect(echo);
  bell.maxPolyphony = 12;
  let last = 0;
  return (x, y, speed) => {
    const now = Tone.now();
    if (now - last < cfg.minGap) return;
    last = now;
    // height picks the region of the scale, with a little randomness so it shimmers
    const base = Math.round(((y + 1) / 2) * (notes.length - 1));
    const idx = Math.max(0, Math.min(notes.length - 1, base + Math.round(between(-1.4, 1.4))));
    pan.pan.rampTo(Math.max(-0.9, Math.min(0.9, x)), 0.03);
    bell.triggerAttackRelease(sourNote(notes[idx], mix), 0.4, now, 0.25 + 0.6 * speed);
  };
}

// Events: the sounds of the game's moments. Holding a light hums softly; a
// caught light chimes; one that settles into the structure blooms into a warm
// open fifth (deeper for the base); one let go into the dark sighs downward.
function buildEvents(out, ev) {
  const pan = new Tone.Panner(0).connect(out);
  const bloom = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 1.4, sustain: 0.15, release: 3 },
    volume: ev.volume,
  }).connect(pan);
  const shimmer = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01, modulationIndex: 1.5,
    envelope: { attack: 0.003, decay: 0.8, sustain: 0, release: 1 },
    modulationEnvelope: { attack: 0.003, decay: 0.2, sustain: 0, release: 0.3 },
    volume: ev.volume - 8,
  }).connect(pan);
  const hold = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.4, decay: 0.2, sustain: 0.4, release: 0.6 },
    volume: ev.volume - 12,
  }).connect(pan);
  const sigh = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.05, decay: 1.4, sustain: 0, release: 0.8 }, volume: ev.lostVolume }).connect(pan);
  const at = (p) => pan.pan.rampTo(p, 0.02);

  // a crack: a long hiss, like something burning out, over a dull low crunch
  const hissBand = new Tone.Filter({ type: 'bandpass', frequency: 5000, Q: 0.8 }).connect(pan);
  const hiss = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.01, decay: ev.crackHiss, sustain: 0, release: 0.4 }, volume: ev.crackVolume }).connect(hissBand);
  const crunch = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 }, volume: ev.crackVolume + 2 }).connect(new Tone.Filter({ type: 'lowpass', frequency: 500 }).connect(pan));
  const sink = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 1.6, sustain: 0, release: 0.8 }, volume: ev.crackVolume - 2 }).connect(pan);
  // pulling: a soft breath of air that rises while you hold (no pitch, no tremble)
  const strainBand = new Tone.Filter({ type: 'lowpass', frequency: 300, Q: 1.5 }).connect(pan);
  const strain = new Tone.Noise({ type: 'pink', volume: -80 }).connect(strainBand).start();
  // collapse: a descending cascade, and for the base a deep low fall
  const fallBells = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.01, modulationIndex: 1.4, envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 1.2 }, volume: ev.volume - 4 }).connect(pan);
  fallBells.maxPolyphony = 32;
  const thud = new Tone.MembraneSynth({ pitchDecay: 0.4, octaves: 3, envelope: { attack: 0.005, decay: 1.6, sustain: 0, release: 1 }, volume: ev.volume - 2 }).connect(pan);
  // a plant waking: one soft high glint
  const glint = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.9, sustain: 0, release: 0.8 }, volume: ev.volume - 14 }).connect(pan);
  let lastWake = 0;
  return {
    crack(p) {
      at(p);
      const now = Tone.now();
      crunch.triggerAttackRelease(0.15, now);
      hiss.triggerAttackRelease(ev.crackHiss, now + 0.03);
      hissBand.frequency.cancelScheduledValues(now);
      hissBand.frequency.setValueAtTime(6500, now);
      hissBand.frequency.exponentialRampToValueAtTime(900, now + ev.crackHiss);
      // a low tone that sags flat as the light goes dark
      sink.triggerAttackRelease('D3', 1.4, now);
      sink.frequency.setValueAtTime(Tone.Frequency('D3').toFrequency(), now);
      sink.frequency.exponentialRampToValueAtTime(Tone.Frequency('A#2').toFrequency(), now + 1.4);
    },
    // the base cracking: the same hiss, far longer, over a deep fall that shakes the room
    baseCrack() {
      at(0);
      const now = Tone.now();
      crunch.triggerAttackRelease(0.3, now);
      thud.triggerAttackRelease('D1', 3, now + 0.05);
      hiss.triggerAttackRelease(ev.crackHiss * 2.5, now + 0.1);
      hissBand.frequency.cancelScheduledValues(now);
      hissBand.frequency.setValueAtTime(7000, now);
      hissBand.frequency.exponentialRampToValueAtTime(400, now + ev.crackHiss * 2.5);
      sink.triggerAttackRelease('D2', 3, now);
      sink.frequency.setValueAtTime(Tone.Frequency('D2').toFrequency(), now);
      sink.frequency.exponentialRampToValueAtTime(Tone.Frequency('G#1').toFrequency(), now + 3);
    },
    pullStart(p, dur) {
      at(p);
      const now = Tone.now();
      strain.volume.cancelScheduledValues(now);
      strain.volume.rampTo(ev.pullVolume, dur * 0.8);
      strainBand.frequency.cancelScheduledValues(now);
      strainBand.frequency.setValueAtTime(300, now);
      strainBand.frequency.exponentialRampToValueAtTime(2200, now + dur);
    },
    pullStop() { strain.volume.cancelScheduledValues(Tone.now()); strain.volume.rampTo(-80, 0.4); },
    collapse(n, p, isBase) {
      at(p);
      strain.volume.cancelScheduledValues(Tone.now());
      strain.volume.rampTo(-80, 0.3);
      const now = Tone.now();
      const notes = ['E6', 'D6', 'B5', 'A5', 'F#5', 'E5', 'D5', 'B4', 'A4', 'F#4', 'E4', 'D4'];
      const count = Math.min(notes.length, Math.max(2, n + 1));
      for (let k = 0; k < count; k++) fallBells.triggerAttackRelease(notes[k], 0.6, now + 0.15 + k * 0.09, 0.5 + 0.5 * (1 - k / count));
      thud.triggerAttackRelease(isBase ? 'D1' : n > 3 ? 'A1' : 'D2', 1.2, now + 0.5);
    },
    wake(p) {
      const now = Tone.now();
      if (now - lastWake < 0.25) return;
      lastWake = now;
      at(p);
      glint.triggerAttackRelease(pick(['B5', 'D6', 'E6', 'F#6', 'A6']), 0.5);
    },
    holdStart(p) { at(p); hold.triggerAttackRelease('A4', CONFIG.catching.holdTime); },
    caught(p) { at(p); shimmer.triggerAttackRelease([pick(ev.threadNote), 'A5'], 0.3); },
    placed(p, isBase) {
      at(p);
      const n = isBase ? 'D3' : pick(ev.placeNotes);
      bloom.triggerAttackRelease([n, Tone.Frequency(n).transpose(7).toNote()], isBase ? 3 : 1.6);
    },
    lost(p) {
      at(p);
      const now = Tone.now();
      sigh.triggerAttackRelease('A4', 1.2, now);
      sigh.frequency.exponentialRampToValueAtTime(Tone.Frequency('D4').toFrequency(), now + 1.2);
    },
  };
}

// Air: a faint, high band of noise that slowly wanders, like breath in a large room.
function buildAir(out, air) {
  const band = new Tone.Filter({ type: 'bandpass', frequency: air.bandBase, Q: 0.7 }).connect(out);
  new Tone.Noise({ type: 'pink', volume: air.volume }).connect(band).start();
  new Tone.LFO({ frequency: air.rate, min: air.bandBase, max: air.bandBase + air.bandSweep }).connect(band.frequency).start();
}
