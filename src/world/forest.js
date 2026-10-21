// ─────────────────────────────────────────────────────────────────────────────
// THE FOREST: the world the player's light reveals.
//
// A living night forest of faceted, low-poly pines standing around a still,
// dark pool, with an open path winding away into the distance. Cold moonlight picks out the nearest trunks and branches in blue;
// the deeper wood is lost in fog. The player's structure casts a real warm
// light; the more lights it holds, the brighter the moonlit wood becomes and
// the farther its amber glow reaches into the trees. The water mirrors it all.
// Glowing mushrooms line the path; each one wakes only when your light
// reaches it, so a growing structure literally lets you discover more of the
// world. Losing light lets the dark close back in, and they go to sleep.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { CONFIG } from '../config.js';

const rand = (a, b) => a + Math.random() * (b - a);

// Rough up a geometry's vertices so surfaces break into crisp facets.
function facet(geo, amount) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + rand(-amount, amount), p.getY(i) + rand(-amount * 0.5, amount * 0.5), p.getZ(i) + rand(-amount, amount));
  }
  geo.computeVertexNormals();
  return geo;
}

// the path's center line: it leaves the clearing, bends out to one side of
// your structure (so you can see down it) and then winds away
export function pathX(z, center) {
  const d = Math.max(0, center.z - z);
  return center.x + Math.sin(d * 0.05 + 0.6) * CONFIG.forest.pathWind * Math.min(1, d / 18);
}

// the whole forest stands in still, shallow water
function groundY() {
  return CONFIG.forest.floorHeight;
}

export function createForest(scene, center, renderer, glowTex, onWake, sparkTex = glowTex) {
  const F = CONFIG.forest;

  // moonlight: a cold key light from the upper left plus a faint blue sky fill
  const moon = new THREE.DirectionalLight(F.moonlight, F.moonStrength[0]);
  moon.position.set(-30, 40, 25);
  const sky = new THREE.HemisphereLight(F.skyColor, 0x000000, F.skyStrength);
  scene.add(moon, sky);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();

  // the still water: a dark mirror under the whole forest that doubles every
  // light. The reflection is rendered at full screen sharpness, then softly
  // blurred, and stirs very slightly.
  const waterShader = {
    uniforms: {
      color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
      uBlur: { value: F.reflectionBlur }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec2 vLocal;
      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform sampler2D tDiffuse;
      uniform float uBlur, uTime;
      varying vec4 vUv;
      varying vec2 vLocal;
      void main() {
        vec2 uv = vUv.xy / vUv.w;
        // the faintest stir on the surface
        uv.x += sin(vLocal.y * 1.3 + uTime * 0.6) * 0.0015;
        // a soft blur: a ring of samples around the point, weighted toward the middle
        vec3 sum = texture2D(tDiffuse, uv).rgb * 2.0;
        float w = 2.0;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 0.5236;
          float r = (mod(float(i), 2.0) + 1.0) * 0.5;
          vec2 o = vec2(cos(a), sin(a) * 1.6) * uBlur * r;
          sum += texture2D(tDiffuse, uv + o).rgb;
          w += 1.0;
        }
        vec3 refl = sum / w;
        gl_FragColor = vec4(refl * color * 2.2, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const pr = renderer.getPixelRatio();
  const water = new Reflector(new THREE.PlaneGeometry(260, 260), {
    color: F.waterColor,
    textureWidth: Math.round(window.innerWidth * pr * F.reflectionQuality),
    textureHeight: Math.round(window.innerHeight * pr * F.reflectionQuality),
    clipBias: 0.003,
    multisample: 0,
    shader: waterShader,
  });
  water.rotateX(-Math.PI / 2);
  water.position.set(center.x, F.floorHeight, center.z);
  // the water never hides what dips below it, so lights resting just above it
  // keep their whole glow instead of being cut off in a hard line
  water.material.depthWrite = false;
  water.renderOrder = -1;
  scene.add(water);

  // flat stepping stones along the path, catching your light as it reaches them
  const stoneGeo = facet(new THREE.IcosahedronGeometry(1, 0), 0.12);
  const stones = new THREE.InstancedMesh(stoneGeo, new THREE.MeshStandardMaterial({ color: F.stoneColor, roughness: 0.7, flatShading: true }), 200);
  let sn = 0;
  for (let z = center.z - (F.clearing - 3) - 2; z > center.z - F.area[1] * 0.75 && sn < 200; z -= rand(1.6, 2.6)) {
    const x = pathX(z, center) + rand(-1.2, 1.2);
    p.set(x, groundY(x, z, center) + 0.02, z);
    e.set(0, rand(0, 6), 0); q.setFromEuler(e);
    sc.set(rand(0.5, 0.9), rand(0.1, 0.18), rand(0.4, 0.7));
    stones.setMatrixAt(sn++, m.compose(p, q, sc));
  }
  stones.count = sn;
  scene.add(stones);

  // trees: faceted trunks with stacked, jagged cones of needles (a living pine wood)
  const trunkGeo = facet(new THREE.CylinderGeometry(0.7, 1, 1, 6, 4, false).translate(0, 0.5, 0), 0.08);
  const coneGeo = facet(new THREE.ConeGeometry(1, 1, 7, 2, false).translate(0, 0.5, 0), 0.1);
  const barkMat = new THREE.MeshStandardMaterial({ color: F.trunkColor, roughness: 0.85, flatShading: true });
  const leafMat = new THREE.MeshStandardMaterial({ color: F.leafColor, roughness: 0.9, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, F.trees);
  const cones = new THREE.InstancedMesh(coneGeo, leafMat, F.trees * 5);
  let placed = 0, c = 0, tries = 0;
  while (placed < F.trees && tries < F.trees * 30) {
    tries++;
    const x = center.x + rand(-F.area[0] / 2, F.area[0] / 2);
    const z = center.z + rand(-F.area[1] * 0.8, F.area[1] * 0.2);
    // a clearing around the base, and nothing right in front of the player
    if (Math.hypot(x - center.x, z - center.z) < F.clearing + rand(0, 3)) continue;
    if (z > center.z - 6 && Math.abs(x - center.x) < 15) continue;
    // the path stays open, widening a little as it recedes
    if (z < center.z && Math.abs(x - pathX(z, center)) < F.pathWidth + (center.z - z) * 0.03 + rand(0, 1.5)) continue;
    const r = rand(F.trunkRadius[0], F.trunkRadius[1]);
    const h = rand(F.treeHeight[0], F.treeHeight[1]);
    const yaw = rand(0, Math.PI * 2);
    e.set(rand(-0.03, 0.03), yaw, rand(-0.03, 0.03));
    q.setFromEuler(e);
    const gy = groundY(x, z, center);
    p.set(x, gy - 0.05, z);
    sc.set(r, h, r);
    trunks.setMatrixAt(placed++, m.compose(p, q, sc));
    // tiers of needles from a third of the way up to the top, narrowing as they rise
    const tiers = 3 + Math.floor(Math.random() * 3);
    const start = h * rand(0.22, 0.38);
    for (let k = 0; k < tiers && c < F.trees * 5; k++) {
      const f = k / tiers;
      const w = r * rand(5.5, 7.5) * (1 - f * 0.6);
      const th = (h - start) / tiers * 1.7;
      p.set(x, gy + start + (h - start) * f * 0.92, z);
      e.set(0, yaw + k * 0.9, 0);
      q.setFromEuler(e);
      sc.set(w, th, w * rand(0.85, 1.15));
      cones.setMatrixAt(c++, m.compose(p, q, sc));
    }
  }
  trunks.count = placed;
  cones.count = c;
  scene.add(trunks, cones);

  // the structure's warm light
  const glow = new THREE.PointLight(F.lightColor, 0, 0, 1.4);
  glow.position.copy(center);
  scene.add(glow);

  // Things to find. Each one sleeps in the dark and wakes only when your light
  // reaches it. Mushrooms grow in loose rings along the path and through the wood;
  // each one wakes on its own, slowly, a little after the light first touches its
  // ring, so a growing light kindles them one by one rather than all at once.
  const shrooms = [];
  const spots = [];
  for (let z = center.z - 12; z > center.z - F.area[1] * 0.8; z -= F.plantSpacing * rand(0.6, 1.4)) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const edge = F.pathWidth + (center.z - z) * 0.03;
    spots.push({ x: pathX(z, center) + side * rand(edge * 0.5, edge * 1.1), z });
  }
  for (let i = 0; i < F.extraPlants; i++) {
    // more of them close around the clearing, so the first few lights already find some
    const a = rand(0, Math.PI * 2), r = F.clearing + Math.pow(Math.random(), 1.6) * F.area[0] * 0.4;
    spots.push({ x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r * 0.9 - 2 });
  }
  // each ring grows on a low mossy mound rising out of the water
  const moundGeo = facet(new THREE.IcosahedronGeometry(1, 1), 0.12);
  const mounds = new THREE.InstancedMesh(moundGeo, new THREE.MeshStandardMaterial({ color: F.moundColor, roughness: 0.95, flatShading: true }), spots.length);
  spots.forEach((sp, i) => {
    sp.color = new THREE.Color(F.plantColors[Math.floor(Math.random() * F.plantColors.length)]);
    sp.top = F.floorHeight + 0.25;
    q.setFromEuler(e.set(0, rand(0, 6), 0));
    mounds.setMatrixAt(i, m.compose(p.set(sp.x, F.floorHeight - 0.1, sp.z), q, sc.set(rand(1.4, 2), 0.35, rand(1.2, 1.8))));
    sp.members = [];
    sp.awake = 0;
    const n = 3 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const a = rand(0, Math.PI * 2), r = rand(0, 1.0);
      const px = sp.x + Math.cos(a) * r, pz = sp.z + Math.sin(a) * r;
      sp.members.push(shrooms.length);
      shrooms.push({
        pos: new THREE.Vector3(px, sp.top - r * 0.15, pz),
        h: rand(0.25, 0.75) * F.plantSize, w: F.plantSize * rand(0.7, 1.3),
        // every mushroom picks its own color, so each ring is a mix
        color: new THREE.Color(F.plantColors[Math.floor(Math.random() * F.plantColors.length)]).offsetHSL(rand(-0.03, 0.03), 0, rand(-0.05, 0.05)),
        lag: rand(0, F.wakeLag),           // how much further the light must reach before this one wakes
        speed: rand(0.6, 1.4) / F.wakeTime, // how quickly it brightens once awake
        awake: 0, wasAwake: false, phase: rand(0, 100),
      });
    }
  });
  scene.add(mounds);
  // the order mushrooms wake in: roughly nearest your base first
  [...shrooms].sort((a, b) => a.pos.distanceTo(center) + a.lag - (b.pos.distanceTo(center) + b.lag)).forEach((sh, i) => { sh.rank = i; });
  const capGeo = new THREE.SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const stalkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 5).translate(0, 0.5, 0);
  const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), shrooms.length);
  const stalks = new THREE.InstancedMesh(stalkGeo, new THREE.MeshStandardMaterial({ color: 0x8fa3a8, roughness: 0.8, flatShading: true }), shrooms.length);
  const sleepColor = new THREE.Color(F.plantSleepColor);
  shrooms.forEach((sh, i) => {
    q.identity();
    stalks.setMatrixAt(i, m.compose(sh.pos, q, sc.set(F.plantSize, sh.h, F.plantSize)));
    p.copy(sh.pos); p.y += sh.h;
    caps.setMatrixAt(i, m.compose(p, q, sc.set(0.35 * sh.w, 0.22 * sh.w, 0.35 * sh.w)));
    caps.setColorAt(i, sleepColor);
  });
  scene.add(caps, stalks);
  const capColor = new THREE.Color();
  // a bright colored glow around each cap
  const haloPos = new Float32Array(shrooms.length * 3);
  const haloCol = new Float32Array(shrooms.length * 3);
  shrooms.forEach((sh, i) => haloPos.set([sh.pos.x, sh.pos.y + sh.h + 0.1, sh.pos.z], i * 3));
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute('color', new THREE.BufferAttribute(haloCol, 3));
  const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({ map: glowTex, vertexColors: true, size: F.plantHalo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halos.frustumCulled = false;
  scene.add(halos);

  // the colored light a ring of mushrooms casts: a glow spilled on the water around
  // it, and a few real lights (given to the brightest rings) that tint nearby trunks
  const spillGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  for (const sp of spots) {
    sp.spill = new THREE.Mesh(spillGeo, new THREE.MeshBasicMaterial({ map: glowTex, color: sp.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.spill.position.set(sp.x, F.floorHeight + 0.3, sp.z);
    sp.spill.scale.setScalar(F.spillSize);
    scene.add(sp.spill);
  }
  const shroomLights = Array.from({ length: F.plantLights }, () => {
    const l = new THREE.PointLight(0xffffff, 0, F.plantLightReach, 1.6);
    scene.add(l);
    return l;
  });

  // fireflies: little swarms hovering over the path, only out where it is lit
  const swarms = [];
  for (let k = 0; k < F.swarms; k++) {
    const z = center.z - (F.clearing - 3) - 4 - (k + rand(0.2, 0.8)) * (F.area[1] * 0.6 / F.swarms);
    const at = new THREE.Vector3(pathX(z, center) + rand(-3, 3), 0, z);
    at.y = groundY(at.x, at.z, center) + rand(1.2, 2.5);
    const count = 14;
    const pos = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: glowTex, color: F.fireflyColor, size: 0.6, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    const seeds = Array.from({ length: count }, () => [rand(0, 100), rand(0.3, 0.8), rand(1.5, 3.5)]);
    swarms.push({ at, pos, geo, mat, seeds, awake: 0 });
  }

  // at the end of the path: a great old tree in pale blossom, only reached by a full light
  const great = new THREE.Group();
  const gz = center.z - F.area[1] * 0.5;
  const gx = pathX(gz, center);
  great.position.set(gx, groundY(gx, gz, center), gz);
  const gTrunk = new THREE.Mesh(facet(new THREE.CylinderGeometry(1.1, 2.2, 14, 7, 5).translate(0, 7, 0), 0.25), barkMat);
  great.add(gTrunk);
  const blossomColor = new THREE.Color(F.blossomColor);
  // a broad, dark canopy (same needles as the wood, only a faint glow from within)
  const crownMat = new THREE.MeshStandardMaterial({ color: F.leafColor, emissive: blossomColor, emissiveIntensity: 0, roughness: 0.9, flatShading: true });
  const blossoms = [];
  for (let k = 0; k < 14; k++) {
    const a = rand(0, Math.PI * 2), r = rand(1, 7);
    const lump = new THREE.Mesh(facet(new THREE.ConeGeometry(rand(3, 4.5), rand(3, 5), 7, 2), 0.3), crownMat);
    lump.position.set(Math.cos(a) * r, rand(12, 17), Math.sin(a) * r * 0.6);
    lump.rotation.y = rand(0, 6);
    great.add(lump);
  }
  for (let k = 0; k < 90; k++) {
    // blossoms shine through the fog, so the tree calls from far down the path
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: blossomColor, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.position.set(rand(-8, 8), rand(11, 19), rand(-4, 4));
    sp.scale.setScalar(rand(0.35, 0.8));
    sp.userData.phase = rand(0, 100);
    great.add(sp); blossoms.push(sp);
  }
  scene.add(great);
  let greatAwake = 0, greatWoke = false;

  // where the path leads: a pale glow far down the trail, only seen once the fog clears
  const beyond = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: F.beyondColor, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const bz = center.z - F.area[1] * 0.54;
  beyond.position.set(pathX(bz, center), F.floorHeight + 4, bz);
  beyond.scale.set(26, 16, 1);
  scene.add(beyond);

  const tmp = new THREE.Vector3();
  return {
    debugAwake: () => shrooms.filter((sh) => sh.awake > 0.5).length + '/' + shrooms.length,
    // amount 0..1 = how much light the structure holds; `at` = where it shines from
    update(amount, at, hasLight, t = 0, count = 0) {
      // mushrooms wake as your structure grows, nearest first, each in its own time:
      // three for your first light, a couple more for each after. Their colored
      // glow is the first thing that lets you see into the dark.
      const n = count - 1;
      const awake = count > 0 ? Math.round(F.wakeFirst + F.wakeEach * n * (1 + n * F.wakeGrowth)) : 0;
      let changed = false;
      shrooms.forEach((sh, i) => {
        const want = sh.rank < awake ? 1 : 0;
        if (want && !sh.wasAwake && onWake) onWake(sh.pos);
        sh.wasAwake = !!want;
        const before = sh.awake;
        sh.awake = want ? Math.min(1, sh.awake + sh.speed / 60) : Math.max(0, sh.awake - 1 / 60 / F.wakeTime);
        if (sh.awake === 0 && before === 0) return;
        const glow = sh.awake * (0.85 + 0.15 * Math.sin(t * 1.3 + sh.phase));
        caps.setColorAt(i, capColor.copy(sleepColor).lerp(sh.color, glow).multiplyScalar(1 + (F.plantGlow - 1) * glow));
        haloCol.set([sh.color.r * glow, sh.color.g * glow, sh.color.b * glow], i * 3);
        changed = true;
      });
      if (changed) { caps.instanceColor.needsUpdate = true; haloGeo.attributes.color.needsUpdate = true; }
      for (const sp of spots) {
        let a = 0;
        for (const k of sp.members) a += shrooms[k].awake;
        sp.awake = a / sp.members.length;
        sp.spill.material.opacity = sp.awake * F.spillStrength;
      }
      // hand the real lights to the brightest rings nearest you
      const lit = spots.filter((sp) => sp.awake > 0.05).sort((a, b) => b.awake / (1 + b.z * -0.02) - a.awake / (1 + a.z * -0.02));
      shroomLights.forEach((l, k) => {
        const sp = lit[k];
        if (!sp) { l.intensity *= 0.9; return; }
        l.position.set(sp.x, sp.top + 1.2, sp.z);
        l.color.copy(sp.color);
        l.intensity = sp.awake * F.plantLightStrength;
      });
      // fireflies gather once your light reaches them
      const reach = count >= 2 ? 9 + 5 * count : 0;
      for (const sw of swarms) {
        const want = tmp.copy(sw.at).distanceTo(at) < reach ? 1 : 0;
        sw.awake += (want - sw.awake) * 0.015;
        sw.mat.opacity = sw.awake;
        if (sw.awake < 0.01) continue;
        sw.seeds.forEach(([ph, sp, rad], i) => {
          sw.pos.set([
            sw.at.x + Math.sin(t * sp + ph) * rad,
            sw.at.y + Math.sin(t * sp * 1.7 + ph * 2) * 0.8,
            sw.at.z + Math.cos(t * sp * 0.8 + ph) * rad,
          ], i * 3);
        });
        sw.geo.attributes.position.needsUpdate = true;
      }
      // the great tree blooms once your light is nearly full
      const gWant = hasLight && amount > F.greatTreeAt ? 1 : 0;
      greatAwake += (gWant - greatAwake) * 0.008;
      if (gWant && !greatWoke && onWake) onWake(great.position);
      greatWoke = !!gWant;
      crownMat.emissiveIntensity = greatAwake * 0.12;
      for (const b of blossoms) b.material.opacity = greatAwake * (0.5 + 0.5 * Math.sin(t * 0.9 + b.userData.phase));
      beyond.material.opacity = Math.max(0, amount - 0.35) * 0.35 * (1 - greatAwake * 0.6);

      const lerp = THREE.MathUtils.lerp;
      const target = hasLight ? lerp(F.lightStrength[0], F.lightStrength[1], amount) : 0;
      glow.intensity += (target - glow.intensity) * 0.03;
      glow.distance = lerp(F.lightReach[0], F.lightReach[1], amount);
      glow.position.lerp(at, 0.05);
      water.material.uniforms.uTime.value = t;
      moon.intensity += (lerp(F.moonStrength[0], F.moonStrength[1], amount) - moon.intensity) * 0.03;
    },
  };
}
