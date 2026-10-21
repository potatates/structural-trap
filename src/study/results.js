// The results page: every saved run on this computer, as summary cards and a table.
import { loadRuns, mergeRuns, exportAll } from './store.js';
import { summarize, COLUMNS } from './summary.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const avg = (xs) => { const v = xs.filter((x) => typeof x === 'number'); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '–'; };

function split(title, counts, total, bruise = []) {
  const rows = Object.entries(counts).map(([name, n]) =>
    `<div class="row"><span class="name">${esc(name)}</span><span class="track"><span class="fill ${bruise.includes(name) ? 'b' : ''}" style="width:${total ? (n / total) * 100 : 0}%"></span></span><span class="n">${n}</span></div>`).join('');
  return `<div class="card"><h2>${esc(title)}</h2><div class="split">${rows}</div></div>`;
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
  const letGo = finished.reduce((a, r) => a + r.cracksLetGo, 0);
  const kept = finished.reduce((a, r) => a + r.cracksKept, 0);

  $('cards').innerHTML = [
    `<div class="card"><h2>Players</h2><div class="big">${rows.length}</div></div>`,
    split('How runs ended', endings, rows.length, ['held on until dark']),
    split('Small cracks', { 'let go': letGo, 'lived with': kept }, letGo + kept, ['lived with']),
    `<div class="card"><h2>Hesitation</h2><div class="big">${avg(finished.map((r) => r.secondsToLetGo))}s</div><div class="sub" style="margin:6px 0 0">average time a crack was lived with before being let go · ${finished.reduce((a, r) => a + r.pullsAbandoned, 0)} pulls abandoned</div></div>`,
    `<div class="card"><h2>After the base cracked</h2><div class="big">${avg(finished.map((r) => r.heldOnAfterBase))}s</div><div class="sub" style="margin:6px 0 0">average time players held on</div></div>`,
    split('Did they know?', answers, Object.values(answers).reduce((a, b) => a + b, 0)),
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
    return { id: r[col('id')], participant: r[col('participant')], startedAt: r[col('startedAt')], version: r[col('version')], events, fromSheet: true };
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
