// Procedural textures, drawn once on hidden canvases so the game ships no image files.
// A soft round glow (for every point of light) and a wispy noise cloud (for fog).

import * as THREE from 'three';

// A soft radial glow: bright core, long gentle falloff.
export function makeGlowTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Small seeded value-noise so each fog cloud has an uneven, wispy shape.
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  let s = seed * 9301 + 49297;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grid = (x, y) => perm[(perm[x & 255] + y) & 511] / 255;
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = grid(xi, yi), b = grid(xi + 1, yi);
    const c = grid(xi, yi + 1), d = grid(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

// A wispy cloud: layered noise, faded to nothing at the edges.
export function makeFogTexture(seed = 1, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const noise = makeNoise(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.55, freq = 3 / size;
      for (let o = 0; o < 5; o++) {
        v += noise(x * freq + seed * 17, y * freq + seed * 31) * amp;
        amp *= 0.5;
        freq *= 2;
      }
      const dx = x / size - 0.5, dy = y / size - 0.5;
      const edge = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2);
      const a = Math.pow(Math.max(0, v - 0.25), 1.4) * edge * edge * 1.8;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A thin soft ring, used for the "touch" hint and the tightening catch circle.
export function makeRingTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, r * 0.68, r, r, r * 0.95);
  grad.addColorStop(0.0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A crisp point of light: a hard bright center with a short, quick falloff.
// Used for the cores of lights so each one reads as a distinct point, not a blur.
export function makeSparkTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,1)');
  grad.addColorStop(0.32, 'rgba(255,255,255,0.35)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A fracture: dark jagged lines splitting out from the center, for a cracked light.
export function makeCrackTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const m = size / 2;
  g.strokeStyle = 'rgba(0,0,0,1)';
  g.lineCap = 'round';
  g.lineJoin = 'miter';
  const arms = 6;
  for (let a = 0; a < arms; a++) {
    let ang = (a / arms) * Math.PI * 2 + Math.random() * 0.6;
    let x = m, y = m, r = 0;
    g.lineWidth = size * 0.035;
    g.beginPath(); g.moveTo(x, y);
    while (r < m * 0.92) {
      const step = size * (0.06 + Math.random() * 0.07);
      ang += (Math.random() - 0.5) * 0.9;
      x += Math.cos(ang) * step; y += Math.sin(ang) * step; r = Math.hypot(x - m, y - m);
      g.lineTo(x, y);
      g.lineWidth *= 0.8;
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
