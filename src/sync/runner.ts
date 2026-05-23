import { readAdminConfig } from '../config/adminConfig';
import { readEnabledConfigRows } from '../config/configReader';
import { appendLogs } from '../sheets/logs';
import { ensureTemplateSheets } from '../sheets/template';
import { runConfigRows } from './engine';
import type { SyncSummary } from '../types/sync';
import { getTokenData, hasValidAccessToken } from '../auth/tokenStore';

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

  const results = runConfigRows(configs, admin);

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
