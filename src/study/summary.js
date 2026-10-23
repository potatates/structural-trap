// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY: one row of study numbers from a run's event log.
//
// Shared by the game (which saves it with each run) and the results page.
// Everything here is derived from the raw events, so the raw log stays the
// source of truth and these columns can be changed later and recomputed.
// ─────────────────────────────────────────────────────────────────────────────

const mean = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null);

export function summarize(run) {
  const ev = run.events || [];
  const of = (type) => ev.filter((e) => e.type === type);
  const cracks = of('light_cracked');
  const small = cracks.filter((e) => !e.isBase);
  const baseCrack = cracks.find((e) => e.isBase && !e.early) || (of('late_on_kept_crack')[0] && { t: of('late_on_kept_crack')[0].t });
  const pulls = of('light_pulled');
  const pulledCracks = pulls.filter((e) => e.wasCracked && !e.isBase);
  const kept = of('crack_kept');
  const ended = of('run_ended')[0];
  const endPhase = of('phase').find((e) => e.phase === 'ended');
  const questions = of('question');
  const question = questions.find((e) => !e.id || e.id === 'knew');
  const first = questions.find((e) => e.id === 'first');
  const started = of('run_started')[0];
  // the early version's base crack, and whether it was let go
  const early = cracks.find((e) => e.isBase && e.early);
  // the late game starts at the 'base' phase; only a pull before then lets go of the early crack
  const latePhase = of('phase').find((e) => e.phase === 'base');
  const lateAt = latePhase ? latePhase.t : Infinity;
  const earlyPull = early ? pulls.find((e) => e.node === early.node && e.t < lateAt) : null;
  const hint = of('hint_let_go')[0];
  const last = ev.length ? ev[ev.length - 1].t : 0;
  return {
    participant: run.participant,
    variant: run.variant || (started && started.variant) || 'late',
    date: run.startedAt ? run.startedAt.slice(0, 16).replace('T', ' ') : '',
    ending: ended ? ended.reason : 'unfinished',
    minutes: +(last / 60).toFixed(1),
    lightsPlaced: of('light_placed').length,
    smallCracks: small.length,
    cracksLetGo: pulledCracks.length,
    cracksKept: kept.filter((e) => !e.isBase).length,
    // how long a crack was lived with before the player let it go (seconds)
    secondsToLetGo: mean(pulledCracks.map((e) => e.crackedFor)),
    healthyLightsPulled: pulls.filter((e) => !e.wasCracked).length,
    pullAttempts: of('pull_started').length,
    pullsAbandoned: of('pull_abandoned').length,
    lightsFell: pulls.reduce((a, e) => a + (e.fell || 0), 0),
    baseCrackedAtMinute: baseCrack ? +(baseCrack.t / 60).toFixed(1) : null,
    pulledBase: pulls.some((e) => e.isBase && e.wasCracked && e.t >= lateAt),
    heldOnAfterBase: endPhase && baseCrack ? endPhase.afterBase : null,
    hintShownAtMinute: hint ? +(hint.t / 60).toFixed(1) : null,
    answer: question ? question.text : null,
    firstTime: first ? first.text : null,
    earlyBaseCrackedAtMinute: early ? +(early.t / 60).toFixed(1) : null,
    earlyBaseLetGo: early ? !!earlyPull : null,
    secondsToLetGoEarlyBase: earlyPull ? earlyPull.crackedFor : null,
  };
}

// column order and plain-language headers for the table and the CSV
export const COLUMNS = [
  ['participant', 'player'], ['variant', 'version'], ['date', 'date'], ['ending', 'ending'], ['minutes', 'minutes'],
  ['lightsPlaced', 'lights placed'], ['smallCracks', 'cracks'], ['cracksLetGo', 'cracks let go'],
  ['cracksKept', 'cracks kept'], ['secondsToLetGo', 'avg seconds before letting go'],
  ['healthyLightsPulled', 'healthy lights pulled'], ['pullAttempts', 'pull attempts'],
  ['pullsAbandoned', 'pulls abandoned'], ['lightsFell', 'lights that fell'],
  ['baseCrackedAtMinute', 'base cracked (min)'], ['pulledBase', 'pulled the base'],
  ['heldOnAfterBase', 'held on after base (s)'], ['hintShownAtMinute', 'let-go hint (min)'],
  ['earlyBaseCrackedAtMinute', 'early base crack (min)'], ['earlyBaseLetGo', 'let go of early base'],
  ['secondsToLetGoEarlyBase', 'seconds before letting go of early base'],
  ['answer', 'knew it rested on the first light'], ['firstTime', 'first time playing'],
];

// For the chart of letting go by load: every small crack, how many lights rested
// on it when it cracked, and whether the player let it go (pulled it themselves)
// or lived with it to the end. Cracks that fell because something below them was
// pulled, or were still open when the player left early, are left out: no choice was made.
export function cracksByLoad(run) {
  const ev = run.events || [];
  const out = [];
  for (const c of ev.filter((e) => e.type === 'light_cracked' && !e.isBase)) {
    if (ev.some((e) => e.type === 'light_pulled' && e.node === c.node)) out.push({ resting: c.resting, letGo: true });
    else if (ev.some((e) => e.type === 'crack_kept' && e.node === c.node)) out.push({ resting: c.resting, letGo: false });
  }
  return out;
}

export function toCSV(rows) {
  const cell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [COLUMNS.map(([, h]) => cell(h)).join(','), ...rows.map((r) => COLUMNS.map(([k]) => cell(r[k])).join(','))].join('\n');
}
