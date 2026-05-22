const API_VERSION = 'v59.0';

function lastSyncKey(sheetName: string): string {
  return `lastSync_${sheetName}`;
}

export function getLastSyncIso(sheetName: string): string | null {
  return PropertiesService.getDocumentProperties().getProperty(lastSyncKey(sheetName));
}

export function saveLastSyncIso(sheetName: string, iso: string): void {
  PropertiesService.getDocumentProperties().setProperty(lastSyncKey(sheetName), iso);
}

export function applyIncrementalFilter(soql: string, sheetName: string): string {
  const lastSync = getLastSyncIso(sheetName);
  if (!lastSync) {
    return soql;
  }

  const condition = `LastModifiedDate > ${lastSync}`;
  if (/\bWHERE\b/i.test(soql)) {
    return soql.replace(/\bWHERE\b/i, `WHERE ${condition} AND`);
  }

  return soql.replace(/\b(FROM\s+[A-Za-z0-9_]+)/i, `$1 WHERE ${condition}`);
}

export function markSyncCompleted(sheetName: string): void {
  saveLastSyncIso(sheetName, new Date().toISOString());
}

export function getApiVersion(): string {
  return API_VERSION;
}
