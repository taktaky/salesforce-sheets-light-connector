export function isGoogleAuthorizationRequired(): boolean {
  const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  return authInfo.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED;
}

export function getGoogleAuthorizationUrl(): string {
  return ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL).getAuthorizationUrl();
}

/** Trigger external_request authorization in the Spreadsheet context before OAuth callback. */
export function warmUpExternalRequestScope(): void {
  UrlFetchApp.fetch('https://login.salesforce.com', {
    muteHttpExceptions: true,
    followRedirects: false,
  });
}
