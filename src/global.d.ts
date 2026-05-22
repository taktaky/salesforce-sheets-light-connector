declare const Sfc: {
  onOpen(): void;
  login(): void;
  syncNow(): void;
  showOAuthSetupMenu(): void;
  setupSheets(): void;
  authCallback(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput;
};
