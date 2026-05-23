import { readAdminConfig } from '../config/adminConfig';
import { readEnabledConfigRows } from '../config/configReader';
import { appendLogs } from '../sheets/logs';
import { ensureTemplateSheets } from '../sheets/template';
import { getTokenData } from '../auth/tokenStore';
import { runConfigRows } from './engine';
import type { ConfigRow } from '../types/sync';

export const TRIGGER_HANDLER = 'scheduledSync';

function triggerTickKey(interval: string): string {
  return `trigger_tick_${interval.toLowerCase()}`;
}

function isIntervalDue(interval: string, windowMs: number): boolean {
  const props = PropertiesService.getDocumentProperties();
  const key = triggerTickKey(interval);
  const last = Number(props.getProperty(key) ?? '0');
  if (Date.now() - last < windowMs) {
    return false;
  }
  props.setProperty(key, String(Date.now()));
  return true;
}

export function getDueIntervals(): Set<string> {
  const due = new Set<string>(['hourly']);

  if (isIntervalDue('daily', 24 * 60 * 60 * 1000)) {
    due.add('daily');
  }
  if (isIntervalDue('weekly', 7 * 24 * 60 * 60 * 1000)) {
    due.add('weekly');
  }

  return due;
}

export function filterConfigsByDueIntervals(configs: ConfigRow[], dueIntervals: Set<string>): ConfigRow[] {
  return configs.filter((config) => dueIntervals.has(config.interval.toLowerCase()));
}

export function isAuthExpired(): boolean {
  const admin = readAdminConfig();
  const token = getTokenData();
  if (!token) {
    return true;
  }
  const expireMs = admin.tokenExpireDays * 24 * 60 * 60 * 1000;
  return Date.now() - token.lastLoginAt > expireMs;
}

export function installScheduleTrigger(): void {
  removeScheduleTrigger();
  ScriptApp.newTrigger(TRIGGER_HANDLER).timeBased().everyHours(1).create();
}

export function removeScheduleTrigger(): void {
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (trigger.getHandlerFunction() === TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

export function hasScheduleTrigger(): boolean {
  return ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === TRIGGER_HANDLER);
}

export function runScheduledSync(): void {
  ensureTemplateSheets();

  if (isAuthExpired()) {
    removeScheduleTrigger();
    appendLogs([
      {
        sheetName: '(trigger)',
        status: 'ERROR',
        rows: 0,
        message: '認証期限切れ。Trigger を停止しました。Salesforce → Login を実行してください。',
      },
    ]);
    return;
  }

  const token = getTokenData();
  if (!token?.refreshToken) {
    removeScheduleTrigger();
    appendLogs([
      {
        sheetName: '(trigger)',
        status: 'ERROR',
        rows: 0,
        message: '未ログイン。Trigger を停止しました。',
      },
    ]);
    return;
  }

  const admin = readAdminConfig();
  const dueIntervals = getDueIntervals();
  const configs = filterConfigsByDueIntervals(readEnabledConfigRows(), dueIntervals);
  if (configs.length === 0) {
    return;
  }

  const results = runConfigRows(configs, admin);
  appendLogs(
    results.map((result) => ({
      sheetName: result.sheetName,
      status: result.status,
      rows: result.rows,
      message: `[trigger] ${result.message}`,
    })),
  );
}

export function getScheduleStatusMessage(): string {
  if (!hasScheduleTrigger()) {
    return '定期 Sync: 未設定';
  }
  return '定期 Sync: 有効 (毎時チェック / daily・weekly は内部判定)';
}
