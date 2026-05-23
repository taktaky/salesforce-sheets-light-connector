import { readAdminConfig } from '../config/adminConfig';
import { readEnabledConfigRows } from '../config/configReader';
import { probeSoql } from '../salesforce/query';
import { ensureTemplateSheets } from '../sheets/template';
import { applyIncrementalFilter } from './incremental';
import type { AdminConfig, ConfigRow, DryRunResult, DryRunSummary } from '../types/sync';
import { extractLimit, validateSoql } from '../validation/soqlValidator';
import { getTokenData, hasValidAccessToken } from '../auth/tokenStore';
import { appendDryRunResults } from '../sheets/dryRunSheet';

function buildWarnings(probe: { totalSize: number; executionTimeMs: number }, admin: AdminConfig): string {
  const warnings: string[] = [];

  if (probe.totalSize > admin.maxRowsPerSync) {
    warnings.push('Too many rows');
  }

  const slowThresholdMs = admin.maxTimeoutSec * 1000 * 0.8;
  if (probe.executionTimeMs >= slowThresholdMs) {
    warnings.push('Slow query');
  }

  return warnings.join('; ');
}

function dryRunConfigRow(config: ConfigRow, admin: AdminConfig): DryRunResult {
  const base: DryRunResult = {
    sheetName: config.sheetName || `row ${config.rowNumber}`,
    queryValid: false,
    limit: 0,
    estimatedRows: 0,
    executionTimeMs: 0,
    fields: 0,
    warnings: '',
    errors: '',
  };

  try {
    if (!config.sheetName) {
      throw new Error(`Config 行 ${config.rowNumber}: sheet_name が空です。`);
    }

    validateSoql(config.soql, admin);
    base.limit = extractLimit(config.soql);
    base.queryValid = true;

    let soql = config.soql;
    if (config.mode === 'incremental') {
      if (!admin.enableIncremental) {
        throw new Error(`Config 行 ${config.rowNumber}: 差分同期が AdminConfig で無効です。`);
      }
      soql = applyIncrementalFilter(soql, config.sheetName);
    }

    const probe = probeSoql(soql, admin);
    base.estimatedRows = probe.totalSize;
    base.executionTimeMs = probe.executionTimeMs;
    base.fields = probe.fields;
    base.warnings = buildWarnings(probe, admin);
    return base;
  } catch (err) {
    base.errors = err instanceof Error ? err.message : String(err);
    return base;
  }
}

export function runDryRun(): DryRunSummary {
  if (!hasValidAccessToken() && !getTokenData()?.refreshToken) {
    throw new Error('Salesforce 未ログインです。Salesforce → Login を実行してください。');
  }

  ensureTemplateSheets();

  const admin = readAdminConfig();
  if (!admin.enableDryRun) {
    throw new Error('Dry Run が AdminConfig で無効です (ENABLE_DRY_RUN=FALSE)。');
  }

  const configs = readEnabledConfigRows();
  if (configs.length === 0) {
    throw new Error('enabled=TRUE の Config 行がありません。');
  }

  const results = configs.map((config) => dryRunConfigRow(config, admin));
  appendDryRunResults(results);

  return { results };
}

export function formatDryRunSummary(summary: DryRunSummary): string {
  const valid = summary.results.filter((result) => result.queryValid && !result.errors).length;
  const invalid = summary.results.length - valid;
  if (invalid === 0) {
    return `Dry Run 完了: ${valid} 件 OK`;
  }
  return `Dry Run 完了: ${valid} OK, ${invalid} エラー`;
}
