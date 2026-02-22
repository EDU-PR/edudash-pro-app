import {
  loadServiceAccount,
  normalizePrivateKey,
  resolveFirebaseProjectId,
} from '../supabase/functions/send-fcm-call/auth-utils';

describe('send-fcm-call auth utils', () => {
  const validEscapedPrivateKey =
    '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcw\\n-----END PRIVATE KEY-----';

  it('normalizes escaped newline private keys', () => {
    const normalized = normalizePrivateKey(validEscapedPrivateKey);
    expect(normalized).toContain('-----BEGIN PRIVATE KEY-----\n');
    expect(normalized).toContain('\n-----END PRIVATE KEY-----');
    expect(normalized).not.toContain('\\n');
  });

  it('loads service account from JSON env and validates private key', () => {
    const jsonValue = JSON.stringify({
      project_id: 'from-service-account',
      client_email: 'svc@example.iam.gserviceaccount.com',
      private_key: validEscapedPrivateKey,
    });

    const result = loadServiceAccount((key) =>
      key === 'GOOGLE_SERVICE_ACCOUNT_KEY' ? jsonValue : undefined,
    );

    expect(result.errorCode).toBeUndefined();
    expect(result.serviceAccount?.project_id).toBe('from-service-account');
    expect(result.serviceAccount?.private_key).toContain('\n');
  });

  it('loads service account from base64 env payload', () => {
    const jsonValue = JSON.stringify({
      project_id: 'from-b64',
      client_email: 'svc@example.iam.gserviceaccount.com',
      private_key: validEscapedPrivateKey,
    });
    const encoded = Buffer.from(jsonValue, 'utf8').toString('base64');

    const result = loadServiceAccount((key) =>
      key === 'GOOGLE_SERVICE_ACCOUNT_KEY_B64' ? encoded : undefined,
    );

    expect(result.errorCode).toBeUndefined();
    expect(result.serviceAccount?.project_id).toBe('from-b64');
  });

  it('returns PRIVATE_KEY_INVALID when service account key format is invalid', () => {
    const jsonValue = JSON.stringify({
      project_id: 'broken-project',
      client_email: 'svc@example.iam.gserviceaccount.com',
      private_key: 'not-a-pem-key',
    });

    const result = loadServiceAccount((key) =>
      key === 'GOOGLE_SERVICE_ACCOUNT_KEY' ? jsonValue : undefined,
    );

    expect(result.serviceAccount).toBeNull();
    expect(result.errorCode).toBe('PRIVATE_KEY_INVALID');
  });

  it('resolves Firebase project id with env precedence over service account', () => {
    const serviceAccount = { project_id: 'service-project' };
    const resolved = resolveFirebaseProjectId(serviceAccount, (key) =>
      key === 'FIREBASE_PROJECT_ID' ? 'env-project' : undefined,
    );
    expect(resolved).toBe('env-project');
  });
});
