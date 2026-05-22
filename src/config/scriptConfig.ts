export interface ScriptConfig {
  clientId: string;
  loginUrl: string;
}

export type RedirectUriResult =
  | { uri: string; source: 'SF_CALLBACK_URL' }
  | { error: string };

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function normalizeRedirectUri(url: string): string {
  return normalizeBaseUrl(url);
}

/**
 * OAuth authorize/token base URL.
 * - Developer Edition / Production: https://login.salesforce.com
 * - Sandbox: https://test.salesforce.com
 * Do NOT use the instance URL (https://xxx.my.salesforce.com).
 */
export function getScriptConfig(): ScriptConfig {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('SF_CLIENT_ID') ?? '';
  const loginUrl = normalizeBaseUrl(
    props.getProperty('SF_LOGIN_URL') ?? 'https://login.salesforce.com',
  );

  return { clientId, loginUrl };
}

export function isLikelyInstanceUrl(loginUrl: string): boolean {
  return /\.my\.salesforce\.com$/i.test(loginUrl);
}

/** Informational only. ScriptApp.getService().getUrl() may point to an older deployment. */
export function getWebAppRedirectUri(): string | null {
  const serviceUrl = ScriptApp.getService()?.getUrl();
  return serviceUrl ? normalizeRedirectUri(serviceUrl) : null;
}

export function getConfiguredCallbackUrl(): string | null {
  const configured = PropertiesService.getScriptProperties().getProperty('SF_CALLBACK_URL');
  return configured ? normalizeRedirectUri(configured) : null;
}

export function getRedirectUriWarnings(uri: string): string[] {
  const warnings: string[] = [];

  if (uri.includes('/usercallback')) {
    warnings.push(
      'usercallback URL は Spreadsheet 連携では使えません。Web App の /exec URL に設定してください。',
    );
  }

  if (uri.endsWith('/dev')) {
    warnings.push('テスト用 /dev URL です。本番デプロイの /exec URL を設定してください。');
  }

  const webAppUri = getWebAppRedirectUri();
  if (webAppUri && webAppUri !== uri) {
    warnings.push(
      `ScriptApp 自動検出 URL (${webAppUri}) と異なります。SF_CALLBACK_URL が正しい設定です。`,
    );
  }

  return warnings;
}

/**
 * SF_CALLBACK_URL is required because ScriptApp.getService().getUrl() often returns
 * an older Web App deployment after redeploying.
 */
export function resolveRedirectUri(): RedirectUriResult {
  const configured = getConfiguredCallbackUrl();
  if (configured) {
    return { uri: configured, source: 'SF_CALLBACK_URL' };
  }

  return {
    error:
      'SF_CALLBACK_URL が未設定です。デプロイ管理の Web App URL を Script Properties に設定してください。',
  };
}

export function getRedirectUri(): string {
  const resolved = resolveRedirectUri();
  if ('error' in resolved) {
    throw new Error(resolved.error);
  }
  return resolved.uri;
}
