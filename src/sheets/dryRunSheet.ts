import type { DryRunResult } from '../types/sync';

const DRY_RUN_SHEET = 'DryRun';
const HEADERS = [
  'time',
  'sheet_name',
  'query_valid',
  'limit',
  'estimated_rows',
  'execution_time_ms',
  'fields',
  'warnings',
  'errors',
];

function ensureDryRunSheet(): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(DRY_RUN_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(DRY_RUN_SHEET);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

export function appendDryRunResults(results: DryRunResult[]): void {
  if (results.length === 0) {
    return;
  }

  const sheet = ensureDryRunSheet();
  const startRow = sheet.getLastRow() + 1;
  const now = new Date();
  const values = results.map((result) => [
    now,
    result.sheetName,
    result.queryValid,
    result.limit,
    result.estimatedRows,
    result.executionTimeMs,
    result.fields,
    result.warnings,
    result.errors,
  ]);

  sheet.getRange(startRow, 1, values.length, HEADERS.length).setValues(values);
}
