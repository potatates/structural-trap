// ─────────────────────────────────────────────────────────────────────────────
// CRACKS: the world reveals that some lights were never sound.
//
// Essay link: new evidence contradicts something we believe. Once the structure
// is established, a light cracks every so often. Cracks favor lights that hold
// others up, because that is where revision is costly and the dilemma is real.
// Late in the game the base itself cracks: the core belief everything rests on.
// Whether to live with the murk or pull the light out is always the player's call.
// ─────────────────────────────────────────────────────────────────────────────

import { CONFIG } from '../config.js';

const rand = (a, b) => a + Math.random() * (b - a);

export function createCracks(structure, log) {
  const K = CONFIG.cracks;
  let timer = rand(K.every[0], K.every[1]);
  let baseCracked = false;
  let basePlantedAt = null;
  let clock = 0;
  const seen = new WeakMap();
  let smallCracks = 0; // cracks before the base: each one a choice to live with it or let it go

  return {
    get baseCracked() { return baseCracked; },
    update(dt) {
      clock += dt;
      const nodes = structure.nodes;
      const base = nodes[0] && !nodes[0].parent ? nodes[0] : null;
      if (base && basePlantedAt === null) basePlantedAt = clock;
      if (!base) basePlantedAt = null;
      for (const n of nodes) if (!seen.has(n)) seen.set(n, clock); // when each light joined, on this clock

      // late game: the base cracks (once per playthrough), but only after the player
      // has faced several smaller cracks, so how they meet the base can be compared
      // (or, whatever happens, once the base has stood long enough)
      if (base && !baseCracked && !base.cracked &&
          ((smallCracks >= K.cracksBeforeBase && nodes.length >= K.baseAfterLights) || clock - basePlantedAt >= K.baseAfterTime)) {
        baseCracked = true;
        structure.crack(base);
        return;
      }

      if (nodes.length < K.startAfter) return;
      timer -= dt;
      if (timer > 0) return;
      timer = rand(K.every[0], K.every[1]);
      if (nodes.filter((n) => n.cracked).length >= K.maxActive) return;

      // pick a light to crack, weighted toward lights that hold others up
      const candidates = nodes.filter((n) => n.parent && !n.cracked && clock - seen.get(n) > K.minAge);
      if (!candidates.length) return;
      const weights = candidates.map((n) => 1 + structure.descendants(n).length * 1.5);
      let r = Math.random() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < candidates.length; i++) {
        r -= weights[i];
        if (r <= 0) { structure.crack(candidates[i]); smallCracks++; return; }
      }
    },
  };
}
