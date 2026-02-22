export interface FirebaseServiceAccount {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key?: string;
  client_email?: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
}

export type AuthErrorCode =
  | 'SERVICE_ACCOUNT_PARSE_FAILED'
  | 'PRIVATE_KEY_INVALID'
  | 'ACCESS_TOKEN_EXCHANGE_FAILED';

export interface ServiceAccountLoadResult {
  serviceAccount: FirebaseServiceAccount | null;
  errorCode?: AuthErrorCode;
  errorMessage?: string;
}

export interface AccessTokenResult {
  accessToken: string | null;
  errorCode?: AuthErrorCode;
  errorMessage?: string;
}

type EnvGetter = (key: string) => string | undefined;

function base64Decode(raw: string): string {
  if (typeof atob === 'function') return atob(raw);
  const bufferCtor = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(raw, 'base64').toString('utf8');
  }
  throw new Error('base64_decode_unavailable');
}

function base64UrlEncode(raw: string): string {
  if (typeof btoa === 'function') {
    return btoa(raw).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  const bufferCtor = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(raw, 'utf8').toString('base64url');
  }
  throw new Error('base64url_encode_unavailable');
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  if (typeof btoa === 'function') {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }
  const bufferCtor = (globalThis as { Buffer?: { from: (value: ArrayBuffer) => { toString: (encoding: string) => string } } }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(buffer).toString('base64url');
  }
  throw new Error('signature_base64url_unavailable');
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = base64Decode(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function normalizePrivateKey(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;

  const raw = value.trim().replace(/\r/g, '').replace(/\\n/g, '\n');
  const hasHeader = raw.includes('-----BEGIN PRIVATE KEY-----');
  const hasFooter = raw.includes('-----END PRIVATE KEY-----');
  if (!hasHeader || !hasFooter) return null;

  const normalized = raw
    .replace(/-----BEGIN PRIVATE KEY-----\s*/m, '-----BEGIN PRIVATE KEY-----\n')
    .replace(/\s*-----END PRIVATE KEY-----/m, '\n-----END PRIVATE KEY-----')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

  if (!normalized.includes('-----BEGIN PRIVATE KEY-----')) return null;
  if (!normalized.includes('-----END PRIVATE KEY-----')) return null;
  return normalized;
}

export function resolveFirebaseProjectId(
  serviceAccount: FirebaseServiceAccount | null,
  getEnv: EnvGetter,
): string {
  const explicit = String(getEnv('FIREBASE_PROJECT_ID') || '').trim();
  if (explicit) return explicit;

  const serviceProjectId = String(serviceAccount?.project_id || '').trim();
  if (serviceProjectId) return serviceProjectId;

  // Backward-compatible fallback.
  return 'edudashpro';
}

export function loadServiceAccount(getEnv: EnvGetter): ServiceAccountLoadResult {
  const keyJson = getEnv('GOOGLE_SERVICE_ACCOUNT_KEY');
  const keyB64 = getEnv('GOOGLE_SERVICE_ACCOUNT_KEY_B64');

  let parsed: FirebaseServiceAccount | null = null;
  try {
    if (keyJson && keyJson.trim().length > 0) {
      parsed = JSON.parse(keyJson.trim()) as FirebaseServiceAccount;
    } else if (keyB64 && keyB64.trim().length > 0) {
      const decoded = base64Decode(keyB64.trim());
      parsed = JSON.parse(decoded) as FirebaseServiceAccount;
    }
  } catch (error) {
    return {
      serviceAccount: null,
      errorCode: 'SERVICE_ACCOUNT_PARSE_FAILED',
      errorMessage: `service_account_parse_failed: ${String(error)}`,
    };
  }

  if (!parsed) {
    return {
      serviceAccount: null,
      errorCode: 'SERVICE_ACCOUNT_PARSE_FAILED',
      errorMessage: 'service_account_missing',
    };
  }

  const normalizedKey = normalizePrivateKey(parsed.private_key);
  if (!normalizedKey) {
    return {
      serviceAccount: null,
      errorCode: 'PRIVATE_KEY_INVALID',
      errorMessage: 'private_key_missing_or_invalid_format',
    };
  }

  parsed.private_key = normalizedKey;
  return { serviceAccount: parsed };
}

export async function buildSignedJwt(serviceAccount: FirebaseServiceAccount): Promise<AccessTokenResult> {
  const clientEmail = String(serviceAccount.client_email || '').trim();
  const privateKey = normalizePrivateKey(serviceAccount.private_key);
  if (!clientEmail || !privateKey) {
    return {
      accessToken: null,
      errorCode: 'PRIVATE_KEY_INVALID',
      errorMessage: 'missing_client_email_or_private_key',
    };
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const encodedHeader = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToDer(privateKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signingInput),
    );

    return { accessToken: `${signingInput}.${arrayBufferToBase64Url(signature)}` };
  } catch (error) {
    return {
      accessToken: null,
      errorCode: 'PRIVATE_KEY_INVALID',
      errorMessage: `jwt_sign_failed: ${String(error)}`,
    };
  }
}

export async function exchangeAccessToken(jwt: string): Promise<AccessTokenResult> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        accessToken: null,
        errorCode: 'ACCESS_TOKEN_EXCHANGE_FAILED',
        errorMessage: text || `http_${response.status}`,
      };
    }

    const data = await response.json();
    const token = String(data?.access_token || '');
    if (!token) {
      return {
        accessToken: null,
        errorCode: 'ACCESS_TOKEN_EXCHANGE_FAILED',
        errorMessage: 'missing_access_token_in_exchange_response',
      };
    }

    return { accessToken: token };
  } catch (error) {
    return {
      accessToken: null,
      errorCode: 'ACCESS_TOKEN_EXCHANGE_FAILED',
      errorMessage: String(error),
    };
  }
}
