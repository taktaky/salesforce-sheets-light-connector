export interface TokenData {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  expiresAt: number;
  lastLoginAt: number;
}

export interface SalesforceTokenResponse {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
  issued_at?: string;
  token_type?: string;
}
