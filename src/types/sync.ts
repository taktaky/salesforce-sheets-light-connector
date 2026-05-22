export interface ConfigRow {
  enabled: boolean;
  sheetName: string;
  soql: string;
  interval: string;
  mode: 'full' | 'incremental';
  memo: string;
  rowNumber: number;
}

export interface AdminConfig {
  maxLimit: number;
  maxTimeoutSec: number;
  maxRowsPerSync: number;
  validationLevel: 'STRICT' | 'RELAXED';
  enableIncremental: boolean;
  enableDryRun: boolean;
  tokenExpireDays: number;
  allowOrderBy: boolean;
  allowRelationship: boolean;
}

export interface SyncResult {
  sheetName: string;
  status: 'SUCCESS' | 'ERROR';
  rows: number;
  message: string;
}

export interface SyncSummary {
  succeeded: number;
  failed: number;
  totalRows: number;
  results: SyncResult[];
}

export interface SalesforceQueryResponse {
  totalSize: number;
  done: boolean;
  records: Record<string, unknown>[];
  nextRecordsUrl?: string;
}
