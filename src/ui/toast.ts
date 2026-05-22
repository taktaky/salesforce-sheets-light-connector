export function showToast(message: string, title = 'Salesforce', timeoutSeconds = 5): void {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, title, timeoutSeconds);
}
