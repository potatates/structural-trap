/**
 * The Structural Trap: run collector (Google Apps Script).
 *
 * Paste this into a Google Sheet's Extensions > Apps Script, then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Copy the web app URL into CONFIG.study.endpoint in src/config.js.
 *
 * Each finished run adds (or updates) one row on the "runs" sheet: the summary
 * columns, then the full event log as JSON in the last column.
 */
const COLUMNS = ['id', 'participant', 'startedAt', 'version', 'stage', 'receivedAt',
  'ending', 'minutes', 'lightsPlaced', 'smallCracks', 'cracksLetGo', 'cracksKept',
  'secondsToLetGo', 'healthyLightsPulled', 'pullAttempts', 'pullsAbandoned', 'lightsFell',
  'baseCrackedAtMinute', 'pulledBase', 'heldOnAfterBase', 'hintShownAtMinute', 'answer', 'events'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(e.postData.contents);
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = book.getSheetByName('runs') || book.insertSheet('runs');
    if (sheet.getLastRow() === 0) sheet.appendRow(COLUMNS);
    const s = data.summary || {};
    const row = COLUMNS.map((c) => {
      if (c === 'stage') return data.stage;
      if (c === 'receivedAt') return new Date().toISOString();
      if (c === 'events') return JSON.stringify(data.events || []).slice(0, 49000); // a cell holds 50,000 characters
      if (c in data && c !== 'summary') return data[c];
      return s[c] === undefined || s[c] === null ? '' : s[c];
    });
    // one row per run: a later send (e.g. after the question) replaces the earlier one
    const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map((r) => r[0]) : [];
    const at = ids.indexOf(data.id);
    if (at >= 0) sheet.getRange(at + 2, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}
