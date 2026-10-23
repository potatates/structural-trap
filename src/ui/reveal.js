// ─────────────────────────────────────────────────────────────────────────────
// THE REVEAL: what the player built, seen whole for the first time.
//
// When a run ends, the world falls dark and every light the player ever placed
// returns as a ghost where it once stood, including the ones that fell. The
// cracked base glows, and a wave runs up every thread from it, turning each
// light it reaches the same bruised color: everything you built rested on it.
// Then a few quiet lines, and a touch to begin again.
//
// Essay link: the structural trap. A belief held at the core is not one belief
// among many; every later belief was fitted onto it, so all of them carry its flaw.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function createReveal(camera, structure, log, save = () => {}) {
  const R = CONFIG.reveal;
  const canvas = document.getElementById('reveal');
  const textEl = document.getElementById('revealText');
  const statsEl = document.getElementById('revealStats');
  const g = canvas.getContext('2d');
  const amber = hex(CONFIG.structure.color), bruise = hex(CONFIG.structure.crackColor);
  let running = false;

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // a soft glowing dot: a crisp core inside a gentle halo
  function dot(x, y, r, color, alpha, hollow) {
    g.globalAlpha = alpha;
    const grad = g.createRadialGradient(x, y, 0, x, y, r * 3.2);
    grad.addColorStop(0, color); grad.addColorStop(0.25, color + '88'); grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r * 3.2, 0, Math.PI * 2); g.fill();
    if (hollow) {
      // lights that fell or were pulled come back as rings: they were here, and are gone
      g.strokeStyle = color; g.lineWidth = 1.4;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    } else {
      g.fillStyle = '#fff6ea';
      g.beginPath(); g.arc(x, y, r * 0.45, 0, Math.PI * 2); g.fill();
    }
  }

  function start(reason) {
    if (running) return;
    running = true;
    size();
    window.addEventListener('resize', size);
    canvas.classList.add('on');

    // the last generation: the base that cracked and everything built on it
    const H = structure.history;
    const crackedBase = H.findLast((h) => h.isBase && h.cracked);
    const gen = crackedBase ? crackedBase.gen : (H.length ? H[H.length - 1].gen : 0);
    const all = H.filter((h) => h.gen === gen);
    const byId = new Map(all.map((h) => [h.id, h]));
    // how many threads from the base each light is (the wave reaches it then)
    for (const h of all) {
      h.depth = h.isBase ? 0 : Math.min(...h.supports.map((id) => (byId.get(id)?.depth ?? 99) + 1));
    }
    const maxDepth = Math.max(0, ...all.map((h) => h.depth));
    // the ghosts stand exactly where your lights stood, projected through the
    // camera every frame so they stay on the real (fading) structure
    const pts = new Map();
    const v = new THREE.Vector3();
    const project = () => {
      for (const h of all) {
        v.copy(h.pos).project(camera);
        pts.set(h.id, [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]);
      }
    };

    const ev = log.events;
    const ended = [...ev].reverse().find((e) => e.type === 'phase' && e.phase === 'ended');
    const began = ev.find((e) => e.type === 'run_started');
    const stats = {
      total: H.length,
      onBase: all.length,
      fell: H.filter((h) => h.fate !== 'stood').length,
      letGo: H.filter((h) => h.fate === 'pulled').length,
      cracks: H.filter((h) => h.cracked).length,
      livedWith: H.filter((h) => h.cracked && h.fate === 'stood').length,
      heldOn: ended ? ended.afterBase : 0,
      runTime: log.now() - (began ? began.t : 0),
    };
    stats.fellWith = stats.fell - stats.letGo;
    log.add('reveal', { reason, ...stats, depth: maxDepth });

    const waveStart = R.ghostsIn + R.basePause;
    const waveEnd = waveStart + (maxDepth + 1) * R.waveStep;
    const t0 = performance.now();

    function frame() {
      const t = (performance.now() - t0) / 1000;
      project();
      g.clearRect(0, 0, innerWidth, innerHeight);
      const appear = Math.min(1, t / R.ghostsIn);
      const reached = (h) => t > waveStart + h.depth * R.waveStep;
      const mix = (h) => Math.min(1, Math.max(0, (t - (waveStart + h.depth * R.waveStep)) / R.waveStep));

      // threads first, then lights on top
      g.lineWidth = 1;
      for (const h of all) {
        const [x, y] = pts.get(h.id);
        for (const id of h.supports) {
          const s = byId.get(id); if (!s) continue;
          const [sx, sy] = pts.get(id);
          const lit = reached(h);
          g.globalAlpha = appear * (lit ? 0.75 : 0.3);
          g.strokeStyle = lit ? bruise : amber;
          g.beginPath(); g.moveTo(sx, sy);
          // the wave climbs the thread from the light below to the one above
          const f = lit ? 1 : Math.max(0, Math.min(1, (t - (waveStart + s.depth * R.waveStep)) / R.waveStep));
          if (f > 0 && !lit) {
            g.lineTo(sx + (x - sx) * f, sy + (y - sy) * f); g.stroke();
            g.globalAlpha = appear * 0.3; g.strokeStyle = amber;
            g.beginPath(); g.moveTo(sx + (x - sx) * f, sy + (y - sy) * f);
          }
          g.lineTo(x, y); g.stroke();
        }
      }
      for (const h of all) {
        const [x, y] = pts.get(h.id);
        const m = mix(h);
        const color = m > 0.5 ? bruise : amber;
        const pulse = h.isBase && t > R.ghostsIn ? 1 + 0.25 * Math.sin(t * 4) : 1;
        dot(x, y, (h.isBase ? 4.5 : 3) * pulse, color, appear * (h.fate === 'stood' ? 0.95 : 0.6), h.fate !== 'stood');
      }
      g.globalAlpha = 1;
      if (running) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // the lines, one at a time, once the wave has reached everything
    const T = CONFIG.text.reveal;
    const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
    const fill = (s) => s.replace('{total}', stats.total).replace('{onBase}', stats.onBase).replace('{letGo}', stats.letGo).replace('{fell}', stats.fell);
    const lines = [
      fill(T.count),
      fill(stats.onBase === stats.total ? T.allOnBase : T.someOnBase),
      fill(reason === 'pulled_base' ? T.pulled : T.dark),
      T.closing,
    ].filter(Boolean);
    lines.forEach((line, i) => {
      setTimeout(() => {
        const el = document.createElement('p');
        el.textContent = line;
        textEl.appendChild(el);
        requestAnimationFrame(() => el.classList.add('on'));
      }, (waveEnd + R.linesAfter + i * R.lineGap) * 1000);
    });
    // then the fuller record of the run, row by row
    const S = CONFIG.text.stats;
    const rows = [
      [S.gathered, stats.total],
      [S.cracks, stats.cracks],
      [S.livedWith, stats.livedWith],
      [S.letGo, stats.letGo],
      [S.fellWith, stats.fellWith],
      [S.heldOn, clock(stats.heldOn)],
      [S.runTime, clock(stats.runTime)],
    ];
    const statsAt = waveEnd + R.linesAfter + lines.length * R.lineGap;
    rows.forEach(([label, value], i) => {
      setTimeout(() => {
        const row = document.createElement('div');
        row.innerHTML = '<span></span><b></b>';
        row.firstChild.textContent = label;
        row.lastChild.textContent = value;
        statsEl.appendChild(row);
        requestAnimationFrame(() => row.classList.add('on'));
      }, (statsAt + i * R.statGap) * 1000);
    });
    const showAgain = () => {
      const el = document.createElement('p');
      el.className = 'again';
      el.textContent = T.again;
      textEl.appendChild(el);
      requestAnimationFrame(() => el.classList.add('on'));
      const again = () => { log.add('replay'); save(); location.reload(); };
      setTimeout(() => {
        window.addEventListener('pointerdown', again, { once: true });
        window.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') again(); });
      }, 600);
    };
    // the questions, one after another, then the touch to begin again
    const ask = (k) => {
      const Q = (CONFIG.text.questions || [])[k];
      if (!Q) { showAgain(); return; }
      const box = document.createElement('div');
      box.className = 'question';
      const p = document.createElement('p');
      p.textContent = Q.ask;
      box.appendChild(p);
      const asked = log.now();
      Q.answers.forEach((answer, i) => {
        const b = document.createElement('button');
        b.textContent = answer;
        b.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          if (box.classList.contains('answered')) return;
          log.add('question', { id: Q.id, answer: i, text: answer, after: +(log.now() - asked).toFixed(1) });
          save();
          box.classList.add('answered');
          b.classList.add('chosen');
          // the next question takes this one's place, so the column stays short
          setTimeout(() => {
            if (k + 1 < CONFIG.text.questions.length) box.remove();
            ask(k + 1);
          }, 700);
        });
        box.appendChild(b);
      });
      textEl.appendChild(box);
      requestAnimationFrame(() => box.classList.add('on'));
    };
    setTimeout(() => ask(0), (statsAt + rows.length * R.statGap + R.againAfter) * 1000);
  }

  return { start, get running() { return running; } };
}
