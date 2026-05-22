const CONFIG_SHEET = 'Config';
const ADMIN_SHEET = 'AdminConfig';
const LOGS_SHEET = 'Logs';

const CONFIG_HEADERS = ['enabled', 'sheet_name', 'soql', 'interval', 'mode', 'memo'];
const ADMIN_HEADERS = ['key', 'value'];
const LOG_HEADERS = ['time', 'sheet', 'status', 'rows', 'message'];

const DEFAULT_ADMIN_ROWS: Array<[string, string]> = [
  ['MAX_LIMIT', '5000'],
  ['MAX_TIMEOUT_SEC', '30'],
  ['MAX_ROWS_PER_SYNC', '10000'],
  ['VALIDATION_LEVEL', 'STRICT'],
  ['ENABLE_INCREMENTAL', 'TRUE'],
  ['ENABLE_DRY_RUN', 'TRUE'],
  ['TOKEN_EXPIRE_DAYS', '30'],
  ['ALLOW_ORDER_BY', 'FALSE'],
  ['ALLOW_RELATIONSHIP', 'FALSE'],
];

const EXAMPLE_CONFIG_ROW = [
  'TRUE',
  'Accounts',
  'SELECT Id, Name FROM Account LIMIT 10',
  'manual',
  'full',
  'Example row - edit soql before sync',
];

function getOrCreateSheet(name: string): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(name) ?? spreadsheet.insertSheet(name);
}

export function ensureTemplateSheets(): void {
  const config = getOrCreateSheet(CONFIG_SHEET);
  if (config.getLastRow() === 0) {
    config.getRange(1, 1, 1, CONFIG_HEADERS.length).setValues([CONFIG_HEADERS]);
    config.getRange(2, 1, 1, EXAMPLE_CONFIG_ROW.length).setValues([EXAMPLE_CONFIG_ROW]);
    config.setFrozenRows(1);
  }

  const admin = getOrCreateSheet(ADMIN_SHEET);
  if (admin.getLastRow() === 0) {
    admin.getRange(1, 1, 1, ADMIN_HEADERS.length).setValues([ADMIN_HEADERS]);
    admin.getRange(2, 1, DEFAULT_ADMIN_ROWS.length, ADMIN_HEADERS.length).setValues(DEFAULT_ADMIN_ROWS);
    admin.setFrozenRows(1);
  }

  const logs = getOrCreateSheet(LOGS_SHEET);
  if (logs.getLastRow() === 0) {
    logs.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
    logs.setFrozenRows(1);
  }
}

export function hasConfigSheet(): boolean {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET) !== null;
}
