import {
  getGoogleAuthorizationUrl,
  isGoogleAuthorizationRequired,
  warmUpExternalRequestScope,
} from './googleAuth';
import {
  getRedirectUri,
  getRedirectUriWarnings,
  getScriptConfig,
  getWebAppRedirectUri,
  isLikelyInstanceUrl,
  resolveRedirectUri,
} from '../config/scriptConfig';
import type { SalesforceTokenResponse } from '../types/oauth';
import { showToast } from '../ui/toast';
import { generateCodeChallenge, generateCodeVerifier } from './pkce';
import {
  consumeCodeVerifier,
  getTokenData,
  hasValidAccessToken,
  saveCodeVerifier,
  saveTokens,
} from './tokenStore';

const OAUTH_SCOPE = 'api refresh_token';

function buildAuthorizationUrl(): string {
  const config = getScriptConfig();
  const codeVerifier = generateCodeVerifier();
  saveCodeVerifier(codeVerifier);

  const params = {
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: getRedirectUri(),
    scope: OAUTH_SCOPE,
    code_challenge: generateCodeChallenge(codeVerifier),
    code_challenge_method: 'S256',
  };

  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return `${config.loginUrl}/services/oauth2/authorize?${query}`;
}

function requestTokens(payload: Record<string, string>): SalesforceTokenResponse {
  const config = getScriptConfig();
  const body = Object.entries(payload)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const response = UrlFetchApp.fetch(`${config.loginUrl}/services/oauth2/token`, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: body,
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(`Token request failed (${status}): ${text}`);
  }

  return JSON.parse(text) as SalesforceTokenResponse;
}

function exchangeAuthorizationCode(code: string): void {
  const config = getScriptConfig();
  const codeVerifier = consumeCodeVerifier();

  if (!codeVerifier) {
    throw new Error('OAuth session expired. Please run Login again.');
  }

  const tokenResponse = requestTokens({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    redirect_uri: getRedirectUri(),
    code_verifier: codeVerifier,
  });

  saveTokens({
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    instanceUrl: tokenResponse.instance_url,
    issuedAtMs: tokenResponse.issued_at ? Number(tokenResponse.issued_at) : Date.now(),
  });
}

export function refreshAccessToken(): void {
  const token = getTokenData();
  const config = getScriptConfig();

  if (!token?.refreshToken) {
    throw new Error('Not logged in. Please run Login first.');
  }

  const tokenResponse = requestTokens({
    grant_type: 'refresh_token',
    refresh_token: token.refreshToken,
    client_id: config.clientId,
  });

  saveTokens({
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token ?? token.refreshToken,
    instanceUrl: tokenResponse.instance_url ?? token.instanceUrl,
    issuedAtMs: tokenResponse.issued_at ? Number(tokenResponse.issued_at) : Date.now(),
  });
}

export function ensureAccessToken(): string {
  if (hasValidAccessToken()) {
    const token = getTokenData();
    if (!token) {
      throw new Error('Not logged in. Please run Login first.');
    }
    return token.accessToken;
  }

  refreshAccessToken();
  const token = getTokenData();
  if (!token) {
    throw new Error('Not logged in. Please run Login first.');
  }
  return token.accessToken;
}

function createGoogleAuthDialogHtml(authUrl: string): GoogleAppsScript.HTML.HtmlOutput {
  const safeUrl = escapeHtml(authUrl);

  return HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;padding:16px;line-height:1.5;">
    <p>Salesforce 連携の前に、Google 側の権限許可が必要です。</p>
    <p>
      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
         style="display:inline-block;padding:10px 16px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:4px;">
        Google 権限を許可
      </a>
    </p>
    <p style="font-size:12px;color:#666;">
      許可後、このダイアログを閉じて、もう一度 <strong>Salesforce → Login</strong> をクリックしてください。
    </p>
  </body>
</html>
  `)
    .setWidth(480)
    .setHeight(240);
}

function createLoginDialogHtml(
  authUrl: string,
  redirectUri: string,
  warnings: string[],
): GoogleAppsScript.HTML.HtmlOutput {
  const safeUrl = escapeHtml(authUrl);
  const safeRedirectUri = escapeHtml(redirectUri);
  const warningHtml = warnings
    .map((warning) => `<p style="color:#b06000;font-size:12px;">${escapeHtml(warning)}</p>`)
    .join('');

  return HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;padding:16px;line-height:1.5;">
    <p>Salesforce の認可画面を開いてログインしてください。</p>
    ${warningHtml}
    <p>
      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
         style="display:inline-block;padding:10px 16px;background:#0176d3;color:#fff;text-decoration:none;border-radius:4px;">
        Salesforce でログイン
      </a>
    </p>
    <p style="font-size:11px;color:#666;">Callback URL（Salesforce と完全一致）:</p>
    <p style="word-break:break-all;font-size:11px;background:#f5f5f5;padding:6px;border-radius:4px;"><code>${safeRedirectUri}</code></p>
    <p style="font-size:12px;color:#666;">
      認可が完了したらこのダイアログを閉じ、Spreadsheet に戻ってください。
    </p>
  </body>
</html>
  `)
    .setWidth(520)
    .setHeight(340);
}

function createSetupDialogHtml(): GoogleAppsScript.HTML.HtmlOutput {
  const resolved = resolveRedirectUri();
  const webAppUri = getWebAppRedirectUri();

  if ('error' in resolved) {
    return HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;padding:16px;line-height:1.6;font-size:13px;">
    <p><strong>SF_CALLBACK_URL の設定が必要です</strong></p>
    <ol>
      <li>Apps Script エディタ → <strong>デプロイ</strong> → <strong>デプロイを管理</strong></li>
      <li>ウェブアプリの <strong>Web App URL</strong>（/exec）をコピー</li>
      <li><strong>プロジェクトの設定</strong> → <strong>スクリプト プロパティ</strong></li>
      <li><code>SF_CALLBACK_URL</code> = コピーした URL</li>
      <li>Salesforce Connected App の Callback URL にも<strong>同じ URL</strong>を設定</li>
    </ol>
    <p style="color:#b06000;">
      未設定のままだと ScriptApp が古いデプロイ URL を使い、redirect_uri_mismatch になります。
    </p>
  </body>
</html>
    `)
      .setWidth(560)
      .setHeight(380);
  }

  const safeUrl = escapeHtml(resolved.uri);
  const warnings = getRedirectUriWarnings(resolved.uri);
  const warningHtml = warnings
    .map((warning) => `<p style="color:#b06000;font-size:12px;">${escapeHtml(warning)}</p>`)
    .join('');
  const webAppHtml = webAppUri
    ? `<p style="font-size:12px;color:#666;">参考: ScriptApp 自動検出 = <code>${escapeHtml(webAppUri)}</code>（使用しません）</p>`
    : '';

  return HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;padding:16px;line-height:1.6;font-size:13px;">
    <p><strong>Salesforce Connected App → Callback URL</strong> に次をそのまま設定:</p>
    <p style="word-break:break-all;background:#e8f4e8;padding:8px;border-radius:4px;font-size:12px;"><code>${safeUrl}</code></p>
    <p style="font-size:12px;color:#666;">取得元: Script Properties (SF_CALLBACK_URL)</p>
    ${webAppHtml}
    ${warningHtml}
    <p style="font-size:12px;color:#666;">
      再デプロイ後は SF_CALLBACK_URL と Salesforce の両方を同じ URL に更新してください。
    </p>
  </body>
</html>
  `)
    .setWidth(580)
    .setHeight(360);
}

export function showOAuthSetup(): void {
  SpreadsheetApp.getUi().showModalDialog(createSetupDialogHtml(), 'OAuth Callback URL');
}

export function startLogin(): void {
  const config = getScriptConfig();

  if (!config.clientId) {
    showToast('SF_CLIENT_ID が Script Properties に未設定です。', 'Salesforce');
    return;
  }

  const redirect = resolveRedirectUri();
  if ('error' in redirect) {
    showOAuthSetup();
    return;
  }

  if (hasValidAccessToken()) {
    showToast('Salesforce にログイン済みです。', 'Salesforce');
    return;
  }

  if (isGoogleAuthorizationRequired()) {
    SpreadsheetApp.getUi().showModalDialog(
      createGoogleAuthDialogHtml(getGoogleAuthorizationUrl()),
      'Google Authorization',
    );
    return;
  }

  warmUpExternalRequestScope();

  const warnings = [
    ...getRedirectUriWarnings(redirect.uri),
    ...(isLikelyInstanceUrl(config.loginUrl)
      ? [
          'SF_LOGIN_URL がインスタンス URL の可能性があります。Developer Edition では https://login.salesforce.com を設定してください。',
        ]
      : []),
  ];

  const authUrl = buildAuthorizationUrl();
  SpreadsheetApp.getUi().showModalDialog(
    createLoginDialogHtml(authUrl, redirect.uri, warnings),
    'Salesforce Login',
  );
}

export function handleAuthCallback(
  request: GoogleAppsScript.Events.DoGet,
): GoogleAppsScript.HTML.HtmlOutput {
  const error = request.parameter.error;
  if (error) {
    return HtmlService.createHtmlOutput(
      `<p>認証に失敗しました: ${escapeHtml(String(error))}</p>`,
    ).setTitle('Salesforce Authorization');
  }

  const code = request.parameter.code;
  if (!code) {
    return HtmlService.createHtmlOutput('<p>認可コードがありません。</p>').setTitle(
      'Salesforce Authorization',
    );
  }

  try {
    exchangeAuthorizationCode(String(code));
    return HtmlService.createHtmlOutput(
      '<p>ログインに成功しました。このウィンドウを閉じて Spreadsheet に戻ってください。</p>',
    ).setTitle('Salesforce Authorization');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return HtmlService.createHtmlOutput(
      `<p>認証処理でエラーが発生しました: ${escapeHtml(message)}</p>`,
    ).setTitle('Salesforce Authorization');
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getLoginStatusMessage(): string {
  const token = getTokenData();
  if (!token) {
    return 'Salesforce 未ログイン';
  }

  if (hasValidAccessToken()) {
    return 'Salesforce ログイン済み';
  }

  return 'Salesforce トークン期限切れ（再ログインが必要）';
}

export function getSalesforceSession(): { accessToken: string; instanceUrl: string } {
  const accessToken = ensureAccessToken();
  const token = getTokenData();
  if (!token) {
    throw new Error('Not logged in. Please run Login first.');
  }
  return { accessToken, instanceUrl: token.instanceUrl };
}
