const SPREADSHEET_ID = '1IIzqDQ4_tBPvvjX6zYBLXiKZliJs36wC7x8SvoeNo2s';
const CHECKIN_LOG_SHEET = 'CheckIn Log';
const SUGGESTIONS_SHEET = 'Who is coming';
const SUGGESTION_NAME_COLUMN = 1;
const SUGGESTION_BATCH_COLUMN = 2;

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'health';

  if (action === 'suggestions') {
    const nameBatchPairs = getNameBatchPairs_(SUGGESTIONS_SHEET);

    return jsonResponse({
      ok: true,
      names: getSuggestions(SUGGESTIONS_SHEET, SUGGESTION_NAME_COLUMN, 2),
      batches: getSuggestions(SUGGESTIONS_SHEET, SUGGESTION_BATCH_COLUMN, 3),
      nameBatchPairs: nameBatchPairs,
    });
  }

  if (action === 'debugSuggestions') {
    return jsonResponse(debugSuggestions_());
  }

  return jsonResponse({ ok: true, service: 'exxcheckin-api' });
}

function doPost(e) {
  try {
    const action = getAction_(e);

    if (action === 'checkin') {
      return handleCheckin_(e);
    }

    if (action === 'feedback') {
      return handleFeedback_(e);
    }

    return jsonResponse({ ok: false, error: 'Unsupported action' });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function handleCheckin_(e) {
  const checkinId = cleanText_(getParam_(e, 'checkinId'), 80);
  const name = cleanText_(getParam_(e, 'name'), 100);
  const batch = cleanText_(getParam_(e, 'batch'), 100);
  const clientTimestamp = cleanText_(getParam_(e, 'clientTimestamp'), 60);

  if (!checkinId || !name || !batch) {
    return jsonResponse({ ok: false, error: 'checkinId, name, and batch are required' });
  }

  const sheet = getSheet_(CHECKIN_LOG_SHEET);
  ensureHeader_(sheet);

  const serverTimestamp = new Date().toISOString();
  sheet.appendRow([
    checkinId,
    name,
    batch,
    serverTimestamp,
    '',
    '',
    'checkin_qr',
    clientTimestamp,
  ]);

  return jsonResponse({ ok: true, serverTimestamp: serverTimestamp });
}

function handleFeedback_(e) {
  const checkinId = cleanText_(getParam_(e, 'checkinId'), 80);
  const feedback = cleanText_(getParam_(e, 'feedback'), 1000);

  if (!checkinId || !feedback) {
    return jsonResponse({ ok: false, error: 'checkinId and feedback are required' });
  }

  const sheet = getSheet_(CHECKIN_LOG_SHEET);
  ensureHeader_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ ok: false, error: 'No check-in records found' });
  }

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  let targetRow = -1;

  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === checkinId) {
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow === -1) {
    return jsonResponse({ ok: false, error: 'Check-in record not found' });
  }

  sheet.getRange(targetRow, 5).setValue(feedback);
  sheet.getRange(targetRow, 6).setValue(new Date().toISOString());

  return jsonResponse({ ok: true });
}

function getSuggestions(sheetName, sourceColumn, fallbackColumn) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sourceSheet = findSheetByName_(ss, sheetName);

  if (sourceSheet) {
    const lastRow = sourceSheet.getLastRow();
    if (lastRow < 2) return [];

    const values = sourceSheet.getRange(2, sourceColumn, lastRow - 1, 1).getValues();
    return uniqueValues_(values);
  }

  const logSheet = getSheet_(CHECKIN_LOG_SHEET);
  const lastRowLog = logSheet.getLastRow();
  if (lastRowLog < 2) return [];

  const valuesFromLog = logSheet
    .getRange(2, fallbackColumn, lastRowLog - 1, 1)
    .getValues();
  return uniqueValues_(valuesFromLog);
}

function uniqueValues_(rows) {
  const seen = {};
  const result = [];

  for (var i = 0; i < rows.length; i++) {
    const value = cleanText_(rows[i][0], 100);
    if (!value) continue;
    if (seen[value]) continue;
    seen[value] = true;
    result.push(value);
  }

  return result;
}

function getNameBatchPairs_(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sourceSheet = findSheetByName_(ss, sheetName);

  if (!sourceSheet) return [];

  const lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sourceSheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const seen = {};
  const pairs = [];

  for (var i = 0; i < values.length; i++) {
    const name = cleanText_(values[i][0], 100);
    const batch = cleanText_(values[i][1], 100);

    if (!name || !batch) continue;

    const key = normalizeSheetName_(name) + '|' + normalizeSheetName_(batch);
    if (seen[key]) continue;

    seen[key] = true;
    pairs.push({ name: name, batch: batch });
  }

  pairs.sort(function (left, right) {
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return pairs;
}

function getSheet_(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = findSheetByName_(ss, sheetName);

  if (!sheet) {
    throw new Error('Missing sheet: ' + sheetName);
  }

  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;

  sheet.appendRow([
    'checkinId',
    'name',
    'batch',
    'checkinTimestamp',
    'feedback',
    'feedbackTimestamp',
    'source',
    'clientTimestamp',
  ]);
}

function getAction_(e) {
  return cleanText_(getParam_(e, 'action'), 30).toLowerCase();
}

function getParam_(e, key) {
  if (!e || !e.parameter) return '';
  return e.parameter[key] || '';
}

function cleanText_(value, maxLen) {
  const text = String(value || '').trim();
  return text.substring(0, maxLen);
}

function findSheetByName_(spreadsheet, targetName) {
  const normalizedTarget = normalizeSheetName_(targetName);
  const sheets = spreadsheet.getSheets();

  for (var i = 0; i < sheets.length; i++) {
    if (normalizeSheetName_(sheets[i].getName()) === normalizedTarget) {
      return sheets[i];
    }
  }

  for (var j = 0; j < sheets.length; j++) {
    const normalizedSheetName = normalizeSheetName_(sheets[j].getName());
    if (normalizedSheetName.indexOf(normalizedTarget) !== -1 || normalizedTarget.indexOf(normalizedSheetName) !== -1) {
      return sheets[j];
    }
  }

  return null;
}

function normalizeSheetName_(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function debugSuggestions_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sourceSheet = findSheetByName_(ss, SUGGESTIONS_SHEET);
  const checkinSheet = findSheetByName_(ss, CHECKIN_LOG_SHEET);

  return {
    ok: true,
    requestedSuggestionsSheet: SUGGESTIONS_SHEET,
    availableSheets: ss.getSheets().map(function (sheet) {
      return sheet.getName();
    }),
    matchedSuggestionsSheet: sourceSheet ? sourceSheet.getName() : null,
    suggestionsSheetLastRow: sourceSheet ? sourceSheet.getLastRow() : null,
    suggestionsNameSample: sourceSheet
      ? sourceSheet.getRange(1, SUGGESTION_NAME_COLUMN, Math.min(sourceSheet.getLastRow(), 6), 1).getValues()
      : [],
    suggestionsBatchSample: sourceSheet
      ? sourceSheet.getRange(1, SUGGESTION_BATCH_COLUMN, Math.min(sourceSheet.getLastRow(), 6), 1).getValues()
      : [],
    checkinLogLastRow: checkinSheet ? checkinSheet.getLastRow() : null,
    checkinNameFallbackSample: checkinSheet
      ? checkinSheet.getRange(1, 2, Math.min(checkinSheet.getLastRow(), 6), 1).getValues()
      : [],
    checkinBatchFallbackSample: checkinSheet
      ? checkinSheet.getRange(1, 3, Math.min(checkinSheet.getLastRow(), 6), 1).getValues()
      : [],
  };
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
