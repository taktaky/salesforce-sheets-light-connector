const LOGS_SHEET = 'Logs';
const LOG_HEADERS = ['time', 'sheet', 'status', 'rows', 'message'] as const;

function ensureLogsSheet(): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(LOGS_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(LOGS_SHEET);
    sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS.slice()]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

export function appendLog(params: {
  sheetName: string;
  status: 'SUCCESS' | 'ERROR';
  rows: number;
  message: string;
}): void {
  const sheet = ensureLogsSheet();
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, LOG_HEADERS.length).setValues([
    [new Date(), params.sheetName, params.status, params.rows, params.message],
  ]);
}

export function appendLogs(
  entries: Array<{
    sheetName: string;
    status: 'SUCCESS' | 'ERROR';
    rows: number;
    message: string;
  }>,
): void {
  if (entries.length === 0) {
    return;
  }

  const sheet = ensureLogsSheet();
  const startRow = sheet.getLastRow() + 1;
  const values = entries.map((entry) => [
    new Date(),
    entry.sheetName,
    entry.status,
    entry.rows,
    entry.message,
  ]);
  sheet.getRange(startRow, 1, values.length, LOG_HEADERS.length).setValues(values);
}
