import type { AdminConfig } from '../types/sync';

const FORBIDDEN = /\b(UPDATE|DELETE|INSERT|UPSERT|MERGE|OFFSET)\b/i;
const LIMIT_PATTERN = /\bLIMIT\s+(\d+)\b/i;
const ORDER_BY_PATTERN = /\bORDER\s+BY\b/i;

export function validateSoql(soql: string, admin: AdminConfig): void {
  const trimmed = soql.trim();
  if (!trimmed) {
    throw new Error('SOQL が空です。');
  }

  if (!/^SELECT\b/i.test(trimmed)) {
    throw new Error('SELECT 文のみ許可されています。');
  }

  if (FORBIDDEN.test(trimmed)) {
    throw new Error('UPDATE / DELETE / INSERT / UPSERT / MERGE / OFFSET は禁止されています。');
  }

  if (trimmed.includes(';')) {
    throw new Error('複数文は禁止されています。');
  }

  const limitMatch = trimmed.match(LIMIT_PATTERN);
  if (!limitMatch) {
    throw new Error('LIMIT 句が必須です。');
  }

  const limitValue = Number(limitMatch[1]);
  if (!Number.isFinite(limitValue) || limitValue <= 0) {
    throw new Error('LIMIT 値が不正です。');
  }

  if (limitValue > admin.maxLimit) {
    throw new Error(`LIMIT ${limitValue} が MAX_LIMIT (${admin.maxLimit}) を超えています。`);
  }

  if (!admin.allowOrderBy && ORDER_BY_PATTERN.test(trimmed)) {
    throw new Error('ORDER BY は AdminConfig で許可されていません。');
  }

  if (!admin.allowRelationship && hasRelationshipField(trimmed)) {
    throw new Error('Relationship Query は AdminConfig で許可されていません。');
  }
}

function hasRelationshipField(soql: string): boolean {
  const selectMatch = soql.match(/\bSELECT\b([\s\S]*?)\bFROM\b/i);
  if (!selectMatch) {
    return false;
  }

  const selectClause = selectMatch[1];
  return selectClause.split(',').some((field) => {
    const token = field.trim();
    return /^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_.]*$/.test(token);
  });
}

export function extractLimit(soql: string): number {
  const match = soql.trim().match(LIMIT_PATTERN);
  return match ? Number(match[1]) : 0;
}
