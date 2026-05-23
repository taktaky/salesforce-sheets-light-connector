import { getSalesforceSession } from '../auth/oauth';
import type { AdminConfig, QueryProbeResult, SalesforceQueryResponse } from '../types/sync';
import { getApiVersion } from '../sync/incremental';

function buildQueryUrl(instanceUrl: string, soql: string): string {
  return `${instanceUrl}/services/data/${getApiVersion()}/query?q=${encodeURIComponent(soql)}`;
}

function resolveNextUrl(instanceUrl: string, nextRecordsUrl: string): string {
  return nextRecordsUrl.startsWith('http') ? nextRecordsUrl : `${instanceUrl}${nextRecordsUrl}`;
}

function sleep(ms: number): void {
  Utilities.sleep(ms);
}

function fetchPage(url: string, accessToken: string): SalesforceQueryResponse {
  let attempt = 0;
  while (true) {
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: `Bearer ${accessToken}` },
      muteHttpExceptions: true,
    });

    const status = response.getResponseCode();
    const body = response.getContentText();

    if (status === 429 || status >= 500) {
      attempt += 1;
      if (attempt > 4) {
        throw new Error(`Salesforce API error (${status}): ${body}`);
      }
      sleep(500 * 2 ** (attempt - 1));
      continue;
    }

    if (status < 200 || status >= 300) {
      throw new Error(`Salesforce API error (${status}): ${body}`);
    }

    return JSON.parse(body) as SalesforceQueryResponse;
  }
}

function flattenRecord(record: Record<string, unknown>): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'attributes') {
      continue;
    }
    flat[key] = formatCellValue(value);
  }
  return flat;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function querySoql(soql: string, admin: AdminConfig): Record<string, string>[] {
  const { accessToken, instanceUrl } = getSalesforceSession();
  const startedAt = Date.now();
  const timeoutMs = admin.maxTimeoutSec * 1000;

  const records: Record<string, string>[] = [];
  let url: string | null = buildQueryUrl(instanceUrl, soql);

  while (url) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Query timeout (${admin.maxTimeoutSec}s) を超えました。`);
    }

    const page: SalesforceQueryResponse = fetchPage(url, accessToken);
    for (const record of page.records) {
      records.push(flattenRecord(record));
      if (records.length > admin.maxRowsPerSync) {
        throw new Error(`MAX_ROWS_PER_SYNC (${admin.maxRowsPerSync}) を超えました。`);
      }
    }

    url = page.done || !page.nextRecordsUrl ? null : resolveNextUrl(instanceUrl, page.nextRecordsUrl);
  }

  return records;
}

export function probeSoql(soql: string, admin: AdminConfig): QueryProbeResult {
  const { accessToken, instanceUrl } = getSalesforceSession();
  const startedAt = Date.now();
  const page = fetchPage(buildQueryUrl(instanceUrl, soql), accessToken);

  const firstRecord = page.records[0];
  let fields = 0;
  if (firstRecord) {
    fields = Object.keys(firstRecord).filter((key) => key !== 'attributes').length;
  }

  const executionTimeMs = Date.now() - startedAt;
  if (executionTimeMs > admin.maxTimeoutSec * 1000) {
    throw new Error(`Query timeout (${admin.maxTimeoutSec}s) を超えました。`);
  }

  return {
    totalSize: page.totalSize,
    fields,
    executionTimeMs,
  };
}
