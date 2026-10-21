// ─────────────────────────────────────────────────────────────────────────────
// THE ARC: how one run unfolds over about seven minutes.
//
//   gathering    lights drift in; you build. Nothing breaks yet.
//   cracking     your structure is established; now and then a light cracks.
//   base         late on, the base itself cracks: the core belief everything
//                rests on. New lights come rarely now, and its dimness creeps
//                slowly into everything, so you can't simply outgrow it.
//   ended        you pulled the base and everything fell, or you held on while
//                the dimness took the whole structure and the world went dark.
//
// Essay link: early beliefs are cheap to revise; the longer we build on them,
// the more revision costs, until the choice is between losing everything and
// living in the dark. Both endings are the player's own choice.
// ─────────────────────────────────────────────────────────────────────────────

import { CONFIG } from '../config.js';

export function createArc({ structure, cracks, observations, log, onEnd }) {
  const A = CONFIG.arc;
  let phase = 'gathering';
  let clock = 0, baseAt = 0, darkFor = 0, endIn = Infinity, endReason = null;

  function enter(next, details = {}) {
    phase = next;
    log.add('phase', { phase: next, ...details });
  }

  return {
    get phase() { return phase; },

    // the base cracked (called from the structure's crack hook)
    baseCracked() {
      if (phase === 'base' || phase === 'ended') return;
      baseAt = clock;
      enter('base', { lights: structure.nodes.length });
      observations.gapScale = A.lateGapScale;
      structure.spreadScale = A.baseSpread;
      structure.shudder(A.shudder);
    },

    // a light was pulled; pulling a cracked base ends the run once the fall settles
    pulled(node, wasBase) {
      if (phase === 'base' && wasBase && node.cracked) {
        endReason = 'pulled_base';
        endIn = A.endAfterFall;
      }
    },

    // jump straight to the end (debug only: press E with ?debug in the URL)
    forceEnd() { if (phase !== 'ended') { endReason = endReason || 'went_dark'; endIn = 0; } },

    update(dt) {
      clock += dt;
      if (phase === 'ended') return;
      if (phase === 'gathering' && structure.nodes.length >= CONFIG.cracks.startAfter) enter('cracking', { lights: structure.nodes.length });

      if (phase === 'base' && endIn === Infinity) {
        // holding on: once the dimness has taken nearly everything, the world goes dark
        darkFor = structure.sour > A.darkAt ? darkFor + dt : 0;
        if (darkFor > A.darkHold) { endReason = 'went_dark'; endIn = 0; }
        else if (clock - baseAt > A.maxAfterBase) { endReason = 'went_dark'; endIn = 0; }
      }

      endIn -= dt;
      if (endIn <= 0) {
        enter('ended', { reason: endReason, lights: structure.nodes.length, afterBase: +(clock - baseAt).toFixed(1) });
        // the cracks the player lived with to the end, and for how long
        for (const n of structure.nodes) {
          if (n.cracked) log.add('crack_kept', { node: n.id, isBase: !n.parent, keptFor: +(performance.now() / 1000 - n.crackedAt).toFixed(1), resting: structure.descendants(n).length });
        }
        observations.stop();
        onEnd && onEnd(endReason);
      }
    },
  };
}
