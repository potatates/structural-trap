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
  const baseCrack = cracks.find((e) => e.isBase);
  const pulls = of('light_pulled');
  const pulledCracks = pulls.filter((e) => e.wasCracked && !e.isBase);
  const kept = of('crack_kept');
  const ended = of('run_ended')[0];
  const endPhase = of('phase').find((e) => e.phase === 'ended');
  const question = of('question')[0];
  const hint = of('hint_let_go')[0];
  const last = ev.length ? ev[ev.length - 1].t : 0;
  return {
    participant: run.participant,
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
    pulledBase: pulls.some((e) => e.isBase && e.wasCracked),
    heldOnAfterBase: endPhase && baseCrack ? endPhase.afterBase : null,
    hintShownAtMinute: hint ? +(hint.t / 60).toFixed(1) : null,
    answer: question ? question.text : null,
  };
}

// column order and plain-language headers for the table and the CSV
export const COLUMNS = [
  ['participant', 'player'], ['date', 'date'], ['ending', 'ending'], ['minutes', 'minutes'],
  ['lightsPlaced', 'lights placed'], ['smallCracks', 'cracks'], ['cracksLetGo', 'cracks let go'],
  ['cracksKept', 'cracks kept'], ['secondsToLetGo', 'avg seconds before letting go'],
  ['healthyLightsPulled', 'healthy lights pulled'], ['pullAttempts', 'pull attempts'],
  ['pullsAbandoned', 'pulls abandoned'], ['lightsFell', 'lights that fell'],
  ['baseCrackedAtMinute', 'base cracked (min)'], ['pulledBase', 'pulled the base'],
  ['heldOnAfterBase', 'held on after base (s)'], ['hintShownAtMinute', 'let-go hint (min)'],
  ['answer', 'answer'],
];

export function toCSV(rows) {
  const cell = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [COLUMNS.map(([, h]) => cell(h)).join(','), ...rows.map((r) => COLUMNS.map(([k]) => cell(r[k])).join(','))].join('\n');
}
