const CODE_VERIFIER_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export function generateCodeVerifier(): string {
  let verifier = '';
  for (let i = 0; i < 64; i++) {
    verifier += CODE_VERIFIER_CHARS.charAt(Math.floor(Math.random() * CODE_VERIFIER_CHARS.length));
  }
  return verifier;
}

export function generateCodeChallenge(codeVerifier: string): string {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    codeVerifier,
    Utilities.Charset.UTF_8,
  );
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
}
