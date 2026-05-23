import { querySoql } from '../salesforce/query';
import { applyIncrementalFilter, markSyncCompleted } from './incremental';
import type { AdminConfig, ConfigRow, SyncResult } from '../types/sync';
import { validateSoql } from '../validation/soqlValidator';
import { upsertRecords } from '../sheets/upsert';

export function syncConfigRow(config: ConfigRow, admin: AdminConfig): SyncResult {
  if (!config.sheetName) {
    throw new Error(`Config 行 ${config.rowNumber}: sheet_name が空です。`);
  }

  validateSoql(config.soql, admin);

  let soql = config.soql;
  if (config.mode === 'incremental') {
    if (!admin.enableIncremental) {
      throw new Error(`Config 行 ${config.rowNumber}: 差分同期が AdminConfig で無効です。`);
    }
    soql = applyIncrementalFilter(soql, config.sheetName);
  }

  const records = querySoql(soql, admin);
  const rows = upsertRecords(config.sheetName, records);

  if (config.mode === 'incremental') {
    markSyncCompleted(config.sheetName);
  }

  return {
    sheetName: config.sheetName,
    status: 'SUCCESS',
    rows,
    message: `${rows} rows synced (${config.mode})`,
  };
}

export function runConfigRows(configs: ConfigRow[], admin: AdminConfig): SyncResult[] {
  const results: SyncResult[] = [];

  for (const config of configs) {
    try {
      results.push(syncConfigRow(config, admin));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        sheetName: config.sheetName || `row ${config.rowNumber}`,
        status: 'ERROR',
        rows: 0,
        message,
      });
    }
  }

  return results;
}
