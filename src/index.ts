function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('Salesforce')
    .addItem('Login', 'login')
    .addItem('Sync Now', 'syncNow')
    .addToUi();
}

function login(): void {
  Logger.log('login');
}

function syncNow(): void {
  Logger.log('sync');
}

const gas = globalThis as unknown as Record<string, () => void>;

gas.onOpen = onOpen;
gas.login = login;
gas.syncNow = syncNow;
