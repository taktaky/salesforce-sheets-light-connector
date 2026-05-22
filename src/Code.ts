function onOpen(): void {
  Sfc.onOpen();
}

function login(): void {
  Sfc.login();
}

function syncNow(): void {
  Sfc.syncNow();
}

function showOAuthSetup(): void {
  Sfc.showOAuthSetupMenu();
}

function setupSheets(): void {
  Sfc.setupSheets();
}

function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  return Sfc.authCallback(e);
}

function authCallback(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  return Sfc.authCallback(e);
}
