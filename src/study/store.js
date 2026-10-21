// ─────────────────────────────────────────────────────────────────────────────
// STORE: every run is saved in this browser (localStorage), so a study session
// on one laptop collects all its players. Runs are saved as they happen (an
// unfinished run is kept too), and can be exported as JSON (raw events) and CSV
// (one summary row per run) for analysis.
// ─────────────────────────────────────────────────────────────────────────────

import { CONFIG } from '../config.js';
import { summarize, toCSV } from './summary.js';

const KEY = 'structural-trap-runs-v1';

export function loadRuns() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function saveRuns(runs) {
  try { localStorage.setItem(KEY, JSON.stringify(runs)); return true; } catch { return false; }
}

// Add runs from an exported file (e.g. from another laptop), skipping ones already here.
export function mergeRuns(incoming) {
  const runs = loadRuns();
  const ids = new Set(runs.map((r) => r.id));
  let added = 0;
  for (const r of incoming) if (r && r.id && !ids.has(r.id)) { runs.push(r); added++; }
  saveRuns(runs);
  return added;
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function exportAll() {
  const runs = loadRuns();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  download(`structural-trap-runs-${stamp}.json`, JSON.stringify(runs, null, 1), 'application/json');
  download(`structural-trap-summary-${stamp}.csv`, toCSV(runs.map((r) => r.summary || summarize(r))), 'text/csv');
  return runs.length;
}

// The run being played now. Participant comes from ?p=NAME in the URL, or is numbered automatically.
export function createRunRecord(log) {
  const params = new URLSearchParams(location.search);
  const existing = loadRuns();
  // on this laptop players are numbered; online every browser counts from 1, so they get a random code instead
  const participant = params.get('p') || (CONFIG.study.endpoint
    ? `W-${Math.random().toString(36).slice(2, 7)}`
    : `P${String(existing.length + 1).padStart(2, '0')}`);
  const run = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    participant,
    startedAt: new Date().toISOString(),
    version: CONFIG.study.version,
    events: log.events,
  };
  let started = false;
  function save() {
    if (!started) return;
    run.savedAt = new Date().toISOString();
    run.summary = summarize(run);
    const runs = loadRuns().filter((r) => r.id !== run.id);
    runs.push(run);
    saveRuns(runs);
  }
  // Remote collection: when CONFIG.study.endpoint is set (a Google Apps Script
  // web app, see tools/collect.gs), a run is also sent there when it ends and
  // when the player answers the question, so players elsewhere reach the study.
  let lastSent = '';
  function send(stage) {
    const url = CONFIG.study.endpoint;
    if (!url || !started) return;
    run.summary = summarize(run);
    const body = JSON.stringify({ stage, id: run.id, participant: run.participant, startedAt: run.startedAt, version: run.version, summary: run.summary, events: run.events });
    if (body === lastSent) return;
    lastSent = body;
    // text/plain keeps this a simple request (no preflight), which Apps Script accepts
    const payload = new Blob([body], { type: 'text/plain' });
    if (stage === 'leaving' && navigator.sendBeacon) { navigator.sendBeacon(url, payload); return; }
    fetch(url, { method: 'POST', mode: 'no-cors', body: payload, keepalive: true }).catch(() => {});
  }
  return {
    run,
    save,
    send,
    // saving begins only once the player has actually begun
    begin() { started = true; save(); },
  };
}
