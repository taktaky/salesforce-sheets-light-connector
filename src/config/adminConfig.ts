import type { AdminConfig } from '../types/sync';

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  maxLimit: 5000,
  maxTimeoutSec: 30,
  maxRowsPerSync: 10000,
  validationLevel: 'STRICT',
  enableIncremental: true,
  enableDryRun: true,
  tokenExpireDays: 30,
  allowOrderBy: false,
  allowRelationship: false,
};

const ADMIN_SHEET = 'AdminConfig';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') {
    return fallback;
  }
  const normalized = value.trim().toUpperCase();
  return normalized === 'TRUE' || normalized === '1' || normalized === 'YES' || normalized === 'Y';
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readAdminConfig(): AdminConfig {
  const defaults = DEFAULT_ADMIN_CONFIG;
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(ADMIN_SHEET);
  if (!sheet) {
    return defaults;
  }

  const values = sheet.getDataRange().getValues();
  const map = new Map<string, string>();

  for (const row of values) {
    const key = String(row[0] ?? '').trim();
    const val = String(row[1] ?? '').trim();
    if (key) {
      map.set(key.toUpperCase(), val);
    }
  }

  const validationLevel = map.get('VALIDATION_LEVEL')?.toUpperCase() === 'RELAXED' ? 'RELAXED' : 'STRICT';

  return {
    maxLimit: parseNumber(map.get('MAX_LIMIT'), defaults.maxLimit),
    maxTimeoutSec: parseNumber(map.get('MAX_TIMEOUT_SEC'), defaults.maxTimeoutSec),
    maxRowsPerSync: parseNumber(map.get('MAX_ROWS_PER_SYNC'), defaults.maxRowsPerSync),
    validationLevel,
    enableIncremental: parseBool(map.get('ENABLE_INCREMENTAL'), defaults.enableIncremental),
    enableDryRun: parseBool(map.get('ENABLE_DRY_RUN'), defaults.enableDryRun),
    tokenExpireDays: parseNumber(map.get('TOKEN_EXPIRE_DAYS'), defaults.tokenExpireDays),
    allowOrderBy: parseBool(map.get('ALLOW_ORDER_BY'), defaults.allowOrderBy),
    allowRelationship: parseBool(map.get('ALLOW_RELATIONSHIP'), defaults.allowRelationship),
  };
}
