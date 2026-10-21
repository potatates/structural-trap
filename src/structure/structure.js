// ─────────────────────────────────────────────────────────────────────────────
// THE STRUCTURE: the player's light, built one caught light at a time.
//
// Essay link (the web of belief, and why core beliefs resist revision):
// every belief rests on beliefs beneath it. The first light the player catches
// becomes the BASE, planted on the ground. Each later light rests on the light
// it was brought to, and also links itself to any other lights close around it,
// so the structure knits into a web. Everything ends up held up, directly or
// indirectly, by what came first. A light in the middle is held from many
// sides; a light at the edge hangs by a single thread.
//
// CRACKS (essay: revision has a cost). A light can crack: it flickers, and its
// murk slowly spreads UP into everything resting on it, souring the light.
// The player can live with that, or pull the cracked light out, and then
// everything resting on it falls. At the edge that costs almost nothing; at
// the base it costs nearly everything.
//
// Why the player builds at all: the structure is their light. The more of it
// there is, the more it clears the fog, lights the ground, and fills the music.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { makeCrackTexture } from '../world/textures.js';

const MAX_STEMS = 600;
const MAX_BEADS = 6000;
const rand = (a, b) => a + Math.random() * (b - a);
let nextId = 1;

export function createStructure(scene, glow, spark, log) {
  const S = CONFIG.structure;
  const basePos = new THREE.Vector3(...S.base);
  const nodes = [];

  // ── Stems: the luminous threads from each light down to the one holding it ──
  const sPos = new Float32Array(MAX_STEMS * 6);
  const sU = new Float32Array(MAX_STEMS * 2);
  const sSeed = new Float32Array(MAX_STEMS * 2);
  const sAlpha = new Float32Array(MAX_STEMS * 2);
  for (let i = 0; i < MAX_STEMS; i++) {
    sU[i * 2] = 0; sU[i * 2 + 1] = 1;
    sSeed[i * 2] = sSeed[i * 2 + 1] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  geo.setAttribute('aU', new THREE.BufferAttribute(sU, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(sAlpha, 1));
  geo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(S.stemColor) }, uOpacity: { value: S.stemOpacity } },
    vertexShader: /* glsl */ `
      attribute float aU, aSeed, aAlpha;
      varying float vU, vSeed, vAlpha;
      void main() { vU = aU; vSeed = aSeed; vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity; uniform vec3 uColor;
      varying float vU, vSeed, vAlpha;
      void main() {
        // light flows UP each stem, from the supporting light to the one it holds
        float bead = exp(-pow((vU - fract(uTime * (0.12 + vSeed * 0.08) + vSeed)) * 8.0, 2.0));
        float a = vAlpha * uOpacity * (0.5 + 0.8 * bead);
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stems = new THREE.LineSegments(geo, mat);
  stems.frustumCulled = false;
  scene.add(stems);

  // ── Beads: small amber points strung along every stem, so stems read as
  // distinct glowing strands rather than faint lines ──
  const bPos = new Float32Array(MAX_BEADS * 3);
  const bAlpha = new Float32Array(MAX_BEADS);
  const bU = new Float32Array(MAX_BEADS);
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  bGeo.setAttribute('aAlpha', new THREE.BufferAttribute(bAlpha, 1));
  bGeo.setAttribute('aU', new THREE.BufferAttribute(bU, 1));
  bGeo.setDrawRange(0, 0);
  const bMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTex: { value: spark }, uColor: { value: new THREE.Color(S.stemColor) } },
    vertexShader: /* glsl */ `
      attribute float aAlpha, aU;
      uniform float uTime;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // a slow wave of light climbs each strand
        float wave = 0.55 + 0.45 * sin(aU * 2.5 - uTime * 2.2);
        vA = aAlpha * wave;
        gl_PointSize = 34.0 / -mv.z * (0.7 + 0.5 * wave);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; uniform vec3 uColor;
      varying float vA;
      void main() {
        float a = texture2D(uTex, gl_PointCoord).a * vA;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const beads = new THREE.Points(bGeo, bMat);
  beads.frustumCulled = false;
  scene.add(beads);

  function sprite(color, scale, opacity, map = glow) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    s.scale.setScalar(scale);
    scene.add(s);
    return s;
  }

  // Everything that would fall with this light (not counting itself).
  // CONFIG.structure.fallsWhen decides what holds a light up in the web:
  //   'all'   a light falls only once every light it rests on is gone
  //   'any'   a light falls as soon as any light it rests on is gone
  //   'first' only the light it was first placed on counts (links are just visual)
  // Lights only ever rest on earlier lights, so one pass in placement order is enough.
  function descendants(node) {
    const gone = new Set([node]);
    const out = [];
    for (const n of nodes) {
      if (gone.has(n) || !n.supports.length) continue;
      const lost = (s) => gone.has(s);
      const falls = S.fallsWhen === 'any' ? n.supports.some(lost)
        : S.fallsWhen === 'first' ? lost(n.parent)
        : n.supports.every(lost);
      if (falls) { gone.add(n); out.push(n); }
    }
    return out;
  }

  // the other lights close around a new light, which it links to as well
  function extraLinks(point, support) {
    if (support === 'ground' || !support) return [];
    return nodes
      .filter((n) => n !== support && point.y >= n.home.y - S.below && point.distanceTo(n.home) < S.linkReach)
      .sort((a, b) => point.distanceTo(a.home) - point.distanceTo(b.home))
      .slice(0, S.maxLinks - 1);
  }

  const falling = [];
  const murkColor = new THREE.Color(S.murkColor);
  const crackColor = new THREE.Color(S.crackColor);
  const previewColor = new THREE.Color(0xdde8ff);
  let preview = new Set();   // lights that would fall if the held one is pulled
  let hooks = {};
  // every light ever placed, kept for the ending: where it stood, what it
  // rested on, and what became of it. A new base starts a new generation.
  const history = [];
  let generation = 0;
  const record = (n) => history.find((h) => h.id === n.id);
  let shudder = 0;

  function dispose(n) {
    for (const sp of [n.halo, n.core, n.fracture]) if (sp) { scene.remove(sp); sp.material.dispose(); }
  }

  // ── What a crack looks like: a flash, then the light goes dark behind a
  // fracture, and thin dark smoke keeps rising from it ──
  const crackTex = makeCrackTexture();
  const smokeColor = new THREE.Color(S.smokeColor);
  const smoke = [];
  for (let i = 0; i < 70; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: smokeColor, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    sp.renderOrder = 5;
    sp.visible = false;
    scene.add(sp);
    smoke.push({ sp, life: 1, max: 1, vel: new THREE.Vector3() });
  }
  let smokeNext = 0, smokeTimer = 0;
  function puff(at, size) {
    const p = smoke[smokeNext = (smokeNext + 1) % smoke.length];
    p.sp.position.copy(at).add(new THREE.Vector3(rand(-0.15, 0.15), 0.1, rand(-0.15, 0.15)));
    p.vel.set(rand(-0.15, 0.15), rand(0.5, 0.9), 0);
    p.life = 0; p.max = rand(1.8, 2.8); p.size = size;
    p.sp.visible = true;
  }

  return {
    nodes,
    basePos,
    history,
    falling,
    on(h) { hooks = h; },
    // how fast murk creeps (the arc slows it once the base cracks, so dread builds)
    spreadScale: 1,
    // every light trembles for a moment (when the base cracks, the whole structure feels it)
    shudder(seconds) { shudder = seconds; },
    // everything that would fall if this light were pulled out (itself included)
    wouldFall(node) { return [node, ...descendants(node)]; },
    // the extra lights a new light at `point` would link to, besides its main support
    linksFor(point, support) { return extraLinks(point, support); },
    setPreview(list) { preview = new Set(list || []); },

    crack(node) {
      if (!node || node.cracked) return;
      node.cracked = true;
      node.crackedAt = performance.now() / 1000;
      node.flash = 1;
      const h = record(node); if (h) h.cracked = true;
      node.fracture = new THREE.Sprite(new THREE.SpriteMaterial({ map: crackTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false, rotation: rand(0, Math.PI * 2) }));
      node.fracture.renderOrder = 10;
      scene.add(node.fracture);
      for (let k = 0; k < 6; k++) puff(node.pos, node.size * 1.4);
      log.add('light_cracked', { node: node.id, light: node.lightId, depth: node.depth, isBase: !node.parent, resting: descendants(node).length });
      hooks.onCrack && hooks.onCrack(node);
    },

    // Pull a light out: it and everything resting on it fall into the water.
    pull(node) {
      const gone = [node, ...descendants(node)];
      const goneSet = new Set(gone);
      for (const n of nodes) {
        if (goneSet.has(n)) continue;
        n.supports = n.supports.filter((x) => !goneSet.has(x));
        n.children = n.children.filter((x) => !goneSet.has(x));
        if (goneSet.has(n.parent)) n.parent = n.supports[0] || null; // it now hangs by another thread
      }
      for (const n of gone) {
        const h = record(n); if (h) h.fate = n === node ? 'pulled' : 'fell';
        nodes.splice(nodes.indexOf(n), 1);
        falling.push({ n, vel: new THREE.Vector3(rand(-0.6, 0.6), rand(0, 0.8), rand(-0.3, 0.3)), life: 0, splashed: false });
      }
      log.add('light_pulled', {
        node: node.id, light: node.lightId, depth: node.depth, isBase: !node.parent, wasCracked: node.cracked,
        fell: gone.length, crackedFor: node.cracked ? +((performance.now() / 1000) - node.crackedAt).toFixed(1) : 0,
        remaining: nodes.length,
      });
      preview.clear();
      hooks.onPull && hooks.onPull(node, !node.parent);
      return gone.length;
    },

    // how soured the structure looks overall (0..1), for the music. Only dimness
    // you can already see counts (the cracked light itself, and murk past a
    // threshold), so the music never goes bad before the light visibly does.
    get sour() {
      if (!nodes.length) return 0;
      let m = 0;
      for (const n of nodes) m += n.cracked ? 0.3 : Math.max(0, n.murk - S.sourFrom) / (1 - S.sourFrom);
      return Math.min(1, m / nodes.length * 1.6);
    },
    get base() { return nodes[0] || null; },
    descendants,

    // Which light would hold a new one released at `point`? (null = none in reach)
    supportFor(point) {
      if (!nodes.length) return 'ground';
      let best = null, bestD = S.reach;
      for (const n of nodes) {
        if (point.y < n.pos.y - S.below) continue; // lights rest on others, not hang beneath
        const d = point.distanceTo(n.pos);
        if (d < bestD) { best = n; bestD = d; }
      }
      return best;
    },

    // Rest a light on the structure. `support` is a node, or 'ground' for the base.
    add(light, point, support) {
      const isBase = support === 'ground';
      const pos = isBase ? basePos.clone() : point.clone();
      // keep every light distinct: nudge it away from any light it sits too close to
      for (let pass = 0; pass < 4 && !isBase; pass++) {
        for (const n of nodes) {
          const d = pos.distanceTo(n.home);
          if (d < S.spacing) {
            const away = pos.clone().sub(n.home);
            if (away.lengthSq() < 1e-4) away.set(Math.random() - 0.5, 1, 0);
            away.z = 0;
            pos.copy(n.home).add(away.setLength(S.spacing));
          }
        }
      }
      // every light that joins the structure takes on the same amber glow
      const color = new THREE.Color(S.color).offsetHSL((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.06);
      const size = (isBase ? S.baseSize : S.nodeSize) * light.size;
      const links = isBase ? [] : [support, ...extraLinks(pos, support)];
      const node = {
        id: nextId++, lightId: light.id, pos, home: pos.clone(), color, size,
        parent: isBase ? null : support, supports: links, children: [],
        depth: isBase ? 0 : support.depth + 1,
        halo: sprite(color, 1, 0), core: sprite(color.clone().lerp(new THREE.Color(0xffffff), 0.35), 1, 0, spark),
        birth: 0, phase: rand(0, 100), brightness: 1,
        cracked: false, murk: 0, placedAt: performance.now() / 1000,
      };
      for (const l of links) l.children.push(node);
      if (isBase) generation++;
      history.push({ id: node.id, pos: pos.clone(), supports: links.map((l) => l.id), isBase, gen: generation, fate: 'stood', cracked: false });
      nodes.push(node);
      log.add('light_placed', { id: light.id, node: node.id, restsOn: isBase ? 'ground' : support.lightId, links: links.map((l) => l.lightId), depth: node.depth, pos: pos.toArray().map((v) => +v.toFixed(2)) });
      return node;
    },

    // Where the structure's light shines from (its middle, a little above the base).
    center(out) {
      if (!nodes.length) return out.copy(basePos);
      out.set(0, 0, 0);
      for (const n of nodes) out.add(n.home);
      out.multiplyScalar(1 / nodes.length);
      out.y += 1;
      return out;
    },

    // How many lights' worth of clear light the structure gives: a murky light
    // counts for less, so living with a crack also lets the mushrooms go dark.
    get litCount() {
      let sum = 0;
      for (const n of nodes) sum += Math.max(0, 1 - n.murk * S.murkCost) * Math.min(1, n.birth * 1.5);
      return sum;
    },

    // Total light, 0..1, used to clear the fog and fill the music.
    get light() {
      let sum = 0;
      for (const n of nodes) sum += n.brightness * Math.min(1, n.birth * 1.5);
      return Math.min(1, sum / CONFIG.light.fullAt);
    },

    update(t, dt) {
      shudder = Math.max(0, shudder - dt);
      // murk spreads upward: from a cracked light into what rests on it, then onward
      for (const n of nodes) {
        let target = 0;
        if (n.cracked) target = S.crackMurk;
        else for (const sp of n.supports) target = Math.max(target, sp.cracked ? S.crackMurk * 0.95 : sp.murk > 0.05 ? sp.murk * 0.97 : 0);
        const rate = target > n.murk ? S.murkSpread : S.murkSpread * 3;
        n.murk += (target - n.murk) * Math.min(1, rate * this.spreadScale * dt);
        // a cracked light stutters; murky ones are dim and dull
        let b = n.cracked ? S.crackedBrightness : 1 - n.murk;
        if (n.cracked) b *= 0.6 + 0.4 * (Math.sin(t * 13 + n.phase) * Math.sin(t * 7.1 + n.phase * 2) > -0.2 ? 1 : 0.15);
        if (shudder > 0) b *= 0.55 + 0.45 * Math.abs(Math.sin(t * 23 + n.phase * 5));
        if (n.flash > 0) { n.flash = Math.max(0, n.flash - dt * 2.5); b = Math.max(b, n.flash * 2); }
        if (preview.has(n)) b = 0.5 + 0.5 * Math.sin(t * 16); // what would fall trembles
        n.brightness = b;
        const tint = n.cracked ? crackColor.clone() : n.color.clone().lerp(murkColor, n.murk * 1.2);
        if (preview.has(n)) tint.lerp(previewColor, 0.6);
        n.halo.material.color.copy(tint);
        n.core.material.color.copy(tint.clone().lerp(new THREE.Color(0xffffff), n.flash > 0 ? n.flash : 0.35 * (1 - n.murk)));
      }

      // dark smoke rises from cracked lights, and thinner wisps from badly murky ones
      smokeTimer -= dt;
      if (smokeTimer <= 0) {
        smokeTimer = S.smokeEvery;
        for (const n of nodes) {
          if (n.cracked) puff(n.pos, n.size * 1.2);
          else if (n.murk > 0.4 && Math.random() < n.murk * 0.4) puff(n.pos, n.size * 0.8);
        }
      }
      for (const p of smoke) {
        if (p.life >= p.max) { p.sp.visible = false; continue; }
        p.life += dt;
        const f = p.life / p.max;
        p.sp.position.addScaledVector(p.vel, dt);
        p.sp.scale.setScalar(p.size * (0.6 + f * 1.6));
        p.sp.material.opacity = S.smokeOpacity * Math.sin(Math.PI * f);
      }

      // falling lights drop into the water and go out
      for (let fi = falling.length - 1; fi >= 0; fi--) {
        const f = falling[fi];
        f.life += dt;
        f.vel.y -= S.fallGravity * dt;
        f.n.pos.addScaledVector(f.vel, dt);
        if (!f.splashed && f.n.pos.y < CONFIG.forest.floorHeight + 0.2) {
          f.splashed = true;
          f.vel.multiplyScalar(0.1);
          hooks.onSplash && hooks.onSplash(f.n.pos.clone());
        }
        const fade = f.splashed ? Math.max(0, 1 - (f.life - 0.2) * 0.9) : 1;
        f.n.halo.position.copy(f.n.pos); f.n.core.position.copy(f.n.pos);
        f.n.halo.material.opacity = 0.35 * fade * (1 - f.n.murk * 0.6);
        f.n.core.material.opacity = fade * (1 - f.n.murk * 0.6);
        if (f.n.fracture) { f.n.fracture.position.copy(f.n.pos); f.n.fracture.material.opacity = S.fractureOpacity * fade; }
        if (f.splashed && fade <= 0) { dispose(f.n); falling.splice(fi, 1); }
      }

      for (const n of nodes) {
        n.birth = Math.min(1, n.birth + dt * 0.8);
        // the whole structure breathes slightly; higher lights move a little more
        const lift = (n.home.y - basePos.y) * S.sway * 0.15;
        n.pos.set(
          n.home.x + Math.sin(t * 0.4 + n.phase) * S.sway * (1 + lift),
          n.home.y + Math.sin(t * 0.55 + n.phase * 1.3) * S.sway * 0.6,
          n.home.z,
        );
        const ease = 1 - Math.pow(1 - n.birth, 3);
        const swell = n.birth < 1 ? 1 + Math.sin(n.birth * Math.PI) * 0.4 : 1;
        const breathe = 0.9 + 0.1 * Math.sin(t * 0.8 + n.phase);
        const s = n.size * ease * swell;
        n.halo.position.copy(n.pos); n.core.position.copy(n.pos);
        n.halo.scale.setScalar(s * 1.9);
        n.core.scale.setScalar(s * 1.0);
        n.halo.material.opacity = 0.35 * n.brightness * breathe * ease;
        n.core.material.opacity = n.brightness * ease;
        if (n.fracture) {
          n.fracture.position.copy(n.pos);
          n.fracture.scale.setScalar(n.size * 1.7);
          n.fracture.material.opacity = Math.min(S.fractureOpacity, n.fracture.material.opacity + dt * 1.5);
        }
      }

      let i = 0;
      for (const n of nodes) {
        const grow = Math.min(1, n.birth * 1.6);
        for (const sp of n.supports) {
          if (i >= MAX_STEMS) break;
          const a = sp.pos, b = sp.pos.clone().lerp(n.pos, grow);
          sPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
          // the main thread is strongest; side links are a little fainter
          sAlpha[i * 2] = sAlpha[i * 2 + 1] = Math.min(n.brightness, sp.brightness) * (sp === n.parent ? 1 : S.linkStrength);
          i++;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      geo.setDrawRange(0, i * 2);
      mat.uniforms.uTime.value = t;

      // beads along each stem
      let k = 0;
      const tmp = new THREE.Vector3();
      for (const n of nodes) {
        for (const sp of n.supports) {
          const len = sp.pos.distanceTo(n.pos);
          const count = Math.max(1, Math.floor(len / S.beadGap));
          const shown = Math.floor(count * Math.min(1, n.birth * 1.6));
          const strength = sp === n.parent ? 1 : S.linkStrength;
          for (let j = 1; j < shown && k < MAX_BEADS; j++, k++) {
            tmp.copy(sp.pos).lerp(n.pos, j / count);
            bPos.set([tmp.x, tmp.y, tmp.z], k * 3);
            bAlpha[k] = Math.min(n.brightness, sp.brightness) * strength;
            bU[k] = n.depth * 3 + j / count * 3; // the climbing wave runs up from the base
          }
        }
      }
      bGeo.attributes.position.needsUpdate = true;
      bGeo.attributes.aAlpha.needsUpdate = true;
      bGeo.attributes.aU.needsUpdate = true;
      bGeo.setDrawRange(0, k);
      bMat.uniforms.uTime.value = t;
    },
  };
}
