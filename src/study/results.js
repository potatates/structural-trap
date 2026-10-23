// The results page: every saved run on this computer, as summary cards and a table.
import { loadRuns, mergeRuns, exportAll } from './store.js';
import { summarize, COLUMNS, cracksByLoad } from './summary.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const avg = (xs) => { const v = xs.filter((x) => typeof x === 'number'); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'; };

function split(title, counts, total, bruise = []) {
  const rows = Object.entries(counts).map(([name, n]) =>
    `<div class="row"><span class="name">${esc(name)}</span><span class="track"><span class="fill ${bruise.includes(name) ? 'b' : ''}" style="width:${total ? (n / total) * 100 : 0}%"></span></span><span class="n">${n}</span></div>`).join('');
  return `<div class="card"><h2>${esc(title)}</h2><div class="split">${rows}</div></div>`;
}

// a card of rates: each row is "a of n" with a bar for the share
function rates(title, list, note = '', wide = false) {
  const rows = list.map(([name, a, n]) =>
    `<div class="row"><span class="name">${esc(name)}</span><span class="track"><span class="fill" style="width:${n ? (a / n) * 100 : 0}%"></span></span><span class="n">${n ? Math.round((a / n) * 100) + '%' : '–'} <small>(${a} of ${n})</small></span></div>`).join('');
  return `<div class="card${wide ? ' wide' : ''}"><h2>${esc(title)}</h2><div class="split">${rows}</div>${note ? `<div class="sub" style="margin:8px 0 0">${esc(note)}</div>` : ''}</div>`;
}

function render() {
  const runs = loadRuns();
  const rows = runs.map((r) => summarize(r)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const finished = rows.filter((r) => r.ending !== 'unfinished');
  $('sub').textContent = `${rows.length} runs saved · ${finished.length} reached the ending`;

  const endings = { 'pulled the base': 0, 'held on until dark': 0, unfinished: 0 };
  for (const r of rows) endings[r.ending === 'pulled_base' ? 'pulled the base' : r.ending === 'went_dark' ? 'held on until dark' : 'unfinished']++;
  const answers = {};
  for (const r of finished) if (r.answer) answers[r.answer] = (answers[r.answer] || 0) + 1;
  const firsts = {};
  for (const r of finished) if (r.firstTime) firsts[r.firstTime] = (firsts[r.firstTime] || 0) + 1;
  const early = rows.filter((r) => r.variant === 'early' && r.earlyBaseLetGo !== null);
  const late = finished.filter((r) => r.variant === 'late');
  const allCracks = runs.flatMap((r) => cracksByLoad(r));
  const loads = [['nothing on it', (n) => n === 0], ['1 to 2 lights', (n) => n >= 1 && n <= 2], ['3 to 5 lights', (n) => n >= 3 && n <= 5], ['6 or more', (n) => n >= 6]];
  const letGo = finished.reduce((a, r) => a + r.cracksLetGo, 0);
  const kept = finished.reduce((a, r) => a + r.cracksKept, 0);

  $('cards').innerHTML = [
    `<div class="card"><h2>Players</h2><div class="big">${rows.length}</div></div>`,
    split('How runs ended', endings, rows.length, ['held on until dark']),
    split('Small cracks', { 'let go': letGo, 'lived with': kept }, letGo + kept, ['lived with']),
    `<div class="card"><h2>Hesitation</h2><div class="big">${avg(finished.map((r) => r.secondsToLetGo))}s</div><div class="sub" style="margin:6px 0 0">average time a crack was lived with before being let go · ${finished.reduce((a, r) => a + r.pullsAbandoned, 0)} pulls abandoned</div></div>`,
    `<div class="card"><h2>After the base cracked</h2><div class="big">${avg(finished.map((r) => r.heldOnAfterBase))}s</div><div class="sub" style="margin:6px 0 0">average time players held on</div></div>`,
    split('Did they know?', answers, Object.values(answers).reduce((a, b) => a + b, 0)),
    split('First time playing?', firsts, Object.values(firsts).reduce((a, b) => a + b, 0)),
    // the comparison: the same cracked base, let go of when little rests on it vs when everything does
    rates('Letting go of the cracked base', [
      ['early version (little rests on it)', early.filter((r) => r.earlyBaseLetGo).length, early.length],
      ['late version (everything rests on it)', late.filter((r) => r.pulledBase).length, late.length],
    ], 'early: base let go when it cracked after a few lights · late: base pulled after it cracked late, among players who reached the end', true),
    rates('Letting go of a small crack, by how much rested on it', loads.map(([name, f]) => {
      const c = allCracks.filter((x) => f(x.resting));
      return [name, c.filter((x) => x.letGo).length, c.length];
    }), 'each small crack counted once: let go (pulled) or lived with to the end', true),
  ].join('');

  $('table').innerHTML = rows.length
    ? `<table><thead><tr>${COLUMNS.map(([, h]) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${COLUMNS.map(([k]) => `<td>${esc(r[k] === true ? 'yes' : r[k] === false ? 'no' : r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : '<div class="empty">No runs saved in this browser yet. Play the game here, or import an exported file.</div>';
}

// a CSV downloaded from the Google Sheet the online game sends runs to
// (tools/collect.gs): one row per run, the full event log in the last column
function fromSheet(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  const col = (name) => head.indexOf(name);
  return body.filter((r) => r[col('id')]).map((r) => {
    let events = [];
    try { events = JSON.parse(r[col('events')]); } catch { /* cut off at the cell limit */ }
    return { id: r[col('id')], variant: col('variant') >= 0 ? r[col('variant')] : undefined, participant: r[col('participant')], startedAt: r[col('startedAt')], version: r[col('version')], events, fromSheet: true };
  });
}

$('export').addEventListener('click', () => exportAll());
$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const text = await file.text();
    const added = mergeRuns(text.trim().startsWith('[') ? JSON.parse(text) : fromSheet(text));
    alert(`${added} new runs added.`);
  } catch { alert('That file could not be read.'); }
  e.target.value = '';
  render();
});
render();
