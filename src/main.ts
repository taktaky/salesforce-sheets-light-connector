import { getLoginStatusMessage, handleAuthCallback, showOAuthSetup, startLogin } from './auth/oauth';
import { formatSyncSummary, runSync } from './sync/runner';
import { ensureTemplateSheets } from './sheets/template';
import { showToast } from './ui/toast';

export function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('Salesforce')
    .addItem('Login', 'login')
    .addItem('Sync Now', 'syncNow')
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

export function syncNow(): void {
  try {
    if (getLoginStatusMessage() === 'Salesforce 未ログイン') {
      showToast('先に Salesforce → Login を実行してください。', 'Salesforce Sync', 8);
      return;
    }

    const summary = runSync();
    showToast(formatSyncSummary(summary), 'Salesforce Sync', 10);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showToast(message, 'Salesforce Sync Error', 10);
  }
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
