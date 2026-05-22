import { readAdminConfig } from '../config/adminConfig';
import { readEnabledConfigRows } from '../config/configReader';
import { querySoql } from '../salesforce/query';
import { appendLogs } from '../sheets/logs';
import { ensureTemplateSheets } from '../sheets/template';
import { upsertRecords } from '../sheets/upsert';
import { applyIncrementalFilter, markSyncCompleted } from './incremental';
import type { AdminConfig, ConfigRow, SyncResult, SyncSummary } from '../types/sync';
import { validateSoql } from '../validation/soqlValidator';
import { getTokenData, hasValidAccessToken } from '../auth/tokenStore';

function syncConfigRow(config: ConfigRow, admin: AdminConfig): SyncResult {
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

export function runSync(): SyncSummary {
  if (!hasValidAccessToken() && !getTokenData()?.refreshToken) {
    throw new Error('Salesforce 未ログインです。Salesforce → Login を実行してください。');
  }

  ensureTemplateSheets();

  const admin = readAdminConfig();
  const configs = readEnabledConfigRows();
  if (configs.length === 0) {
    throw new Error('enabled=TRUE の Config 行がありません。');
  }

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

  appendLogs(
    results.map((result) => ({
      sheetName: result.sheetName,
      status: result.status,
      rows: result.rows,
      message: result.message,
    })),
  );

  const succeeded = results.filter((result) => result.status === 'SUCCESS').length;
  const failed = results.length - succeeded;
  const totalRows = results.reduce((sum, result) => sum + result.rows, 0);

  return { succeeded, failed, totalRows, results };
}

export function formatSyncSummary(summary: SyncSummary): string {
  if (summary.failed === 0) {
    return `Sync 完了: ${summary.succeeded} 件成功 / ${summary.totalRows} rows`;
  }
  return `Sync 完了: ${summary.succeeded} 成功, ${summary.failed} 失敗 / ${summary.totalRows} rows`;
}
