import { getLoginStatusMessage, handleAuthCallback, showOAuthSetup, startLogin } from './auth/oauth';
import { formatDryRunSummary, runDryRun } from './sync/dryRun';
import { formatSyncSummary, runSync } from './sync/runner';
import {
  getScheduleStatusMessage,
  hasScheduleTrigger,
  installScheduleTrigger,
  removeScheduleTrigger,
  runScheduledSync,
} from './sync/trigger';
import { ensureTemplateSheets } from './sheets/template';
import { showToast } from './ui/toast';

export function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('Salesforce')
    .addItem('Login', 'login')
    .addItem('Sync Now', 'syncNow')
    .addItem('Dry Run', 'dryRun')
    .addSeparator()
    .addItem('Enable Schedule', 'enableSchedule')
    .addItem('Disable Schedule', 'disableSchedule')
    .addSeparator()
    .addItem('Setup Sheets', 'setupSheets')
    .addItem('OAuth Setup', 'showOAuthSetup')
    .addToUi();
}

export function login(): void {
  try {
    startLogin();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showToast(message, 'Salesforce Login Error', 8);
  }
}

function requireLogin(): boolean {
  if (getLoginStatusMessage() === 'Salesforce 未ログイン') {
    showToast('先に Salesforce → Login を実行してください。', 'Salesforce', 8);
    return false;
  }
  return true;
}

export function syncNow(): void {
  try {
    if (!requireLogin()) {
      return;
    }

    const summary = runSync();
    showToast(formatSyncSummary(summary), 'Salesforce Sync', 10);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showToast(message, 'Salesforce Sync Error', 10);
  }
}

export function dryRun(): void {
  try {
    if (!requireLogin()) {
      return;
    }

    const summary = runDryRun();
    showToast(`${formatDryRunSummary(summary)}。DryRun シートを確認してください。`, 'Salesforce Dry Run', 10);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showToast(message, 'Salesforce Dry Run Error', 10);
  }
}

export function enableSchedule(): void {
  try {
    if (!requireLogin()) {
      return;
    }

    if (hasScheduleTrigger()) {
      showToast(getScheduleStatusMessage(), 'Salesforce Schedule', 8);
      return;
    }

    installScheduleTrigger();
    showToast(`${getScheduleStatusMessage()}`, 'Salesforce Schedule', 8);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showToast(message, 'Salesforce Schedule Error', 10);
  }
}

export function disableSchedule(): void {
  try {
    removeScheduleTrigger();
    showToast('定期 Sync を無効にしました。', 'Salesforce Schedule', 8);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showToast(message, 'Salesforce Schedule Error', 10);
  }
}

export function scheduledSync(): void {
  runScheduledSync();
}

export function showOAuthSetupMenu(): void {
  showOAuthSetup();
}

export function setupSheets(): void {
  ensureTemplateSheets();
  showToast('Config / AdminConfig / Logs シートを用意しました。', 'Salesforce', 6);
}

export function authCallback(
  request: GoogleAppsScript.Events.DoGet,
): GoogleAppsScript.HTML.HtmlOutput {
  return handleAuthCallback(request);
}
