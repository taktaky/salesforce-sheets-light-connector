import type { ConfigRow } from '../types/sync';

const CONFIG_SHEET = 'Config';

const HEADERS = ['enabled', 'sheet_name', 'soql', 'interval', 'mode', 'memo'] as const;

function parseEnabled(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized === 'TRUE' || normalized === '1' || normalized === 'YES' || normalized === 'Y';
}

function parseMode(value: unknown): 'full' | 'incremental' {
  return String(value ?? '').trim().toLowerCase() === 'incremental' ? 'incremental' : 'full';
}

function findHeaderIndexes(headerRow: unknown[]): Record<string, number> {
  const indexes: Record<string, number> = {};
  headerRow.forEach((cell, index) => {
    const key = String(cell ?? '').trim().toLowerCase();
    if (key) {
      indexes[key] = index;
    }
  });
  return indexes;
}

export function readConfigRows(): ConfigRow[] {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(CONFIG_SHEET);
  if (!sheet) {
    throw new Error('Config シートがありません。enabled, sheet_name, soql, interval, mode, memo 列を作成してください。');
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  const headerIndexes = findHeaderIndexes(values[0]);
  for (const header of HEADERS) {
    if (headerIndexes[header] === undefined) {
      throw new Error(`Config シートに ${header} 列がありません。`);
    }
  }

  const rows: ConfigRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const soql = String(row[headerIndexes.soql] ?? '').trim();
    const sheetName = String(row[headerIndexes.sheet_name] ?? '').trim();
    if (!soql && !sheetName) {
      continue;
    }

    rows.push({
      enabled: parseEnabled(row[headerIndexes.enabled]),
      sheetName,
      soql,
      interval: String(row[headerIndexes.interval] ?? 'manual').trim(),
      mode: parseMode(row[headerIndexes.mode]),
      memo: String(row[headerIndexes.memo] ?? '').trim(),
      rowNumber: i + 1,
    });
  }

  return rows;
}

export function readEnabledConfigRows(): ConfigRow[] {
  return readConfigRows().filter((row) => row.enabled);
}
