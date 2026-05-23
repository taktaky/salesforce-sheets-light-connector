declare const Sfc: {
  onOpen(): void;
  login(): void;
  syncNow(): void;
  dryRun(): void;
  enableSchedule(): void;
  disableSchedule(): void;
  scheduledSync(): void;
  showOAuthSetupMenu(): void;
  setupSheets(): void;
  authCallback(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput;
};
