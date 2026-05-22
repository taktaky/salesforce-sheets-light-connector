import type { TokenData } from '../types/oauth';

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  INSTANCE_URL: 'instance_url',
  EXPIRES_AT: 'expires_at',
  LAST_LOGIN_AT: 'last_login_at',
  CODE_VERIFIER: 'oauth_code_verifier',
} as const;

const ACCESS_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

function userProps(): GoogleAppsScript.Properties.Properties {
  return PropertiesService.getUserProperties();
}

export function saveTokens(params: {
  accessToken: string;
  refreshToken?: string;
  instanceUrl: string;
  issuedAtMs?: number;
}): void {
  const props = userProps();
  const now = Date.now();
  const issuedAt = params.issuedAtMs ?? now;

  props.setProperty(KEYS.ACCESS_TOKEN, params.accessToken);
  props.setProperty(KEYS.INSTANCE_URL, params.instanceUrl);
  props.setProperty(KEYS.EXPIRES_AT, String(issuedAt + ACCESS_TOKEN_TTL_MS));
  props.setProperty(KEYS.LAST_LOGIN_AT, String(now));

  if (params.refreshToken) {
    props.setProperty(KEYS.REFRESH_TOKEN, params.refreshToken);
  }
}

export function getTokenData(): TokenData | null {
  const props = userProps();
  const accessToken = props.getProperty(KEYS.ACCESS_TOKEN);
  const refreshToken = props.getProperty(KEYS.REFRESH_TOKEN);
  const instanceUrl = props.getProperty(KEYS.INSTANCE_URL);
  const expiresAt = props.getProperty(KEYS.EXPIRES_AT);
  const lastLoginAt = props.getProperty(KEYS.LAST_LOGIN_AT);

  if (!accessToken || !refreshToken || !instanceUrl || !expiresAt || !lastLoginAt) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    instanceUrl,
    expiresAt: Number(expiresAt),
    lastLoginAt: Number(lastLoginAt),
  };
}

export function hasValidAccessToken(): boolean {
  const token = getTokenData();
  if (!token) {
    return false;
  }
  return token.expiresAt > Date.now() + 60_000;
}

export function clearTokens(): void {
  const props = userProps();
  props.deleteProperty(KEYS.ACCESS_TOKEN);
  props.deleteProperty(KEYS.REFRESH_TOKEN);
  props.deleteProperty(KEYS.INSTANCE_URL);
  props.deleteProperty(KEYS.EXPIRES_AT);
  props.deleteProperty(KEYS.LAST_LOGIN_AT);
}

export function saveCodeVerifier(codeVerifier: string): void {
  userProps().setProperty(KEYS.CODE_VERIFIER, codeVerifier);
}

export function consumeCodeVerifier(): string | null {
  const props = userProps();
  const codeVerifier = props.getProperty(KEYS.CODE_VERIFIER);
  props.deleteProperty(KEYS.CODE_VERIFIER);
  return codeVerifier;
}
