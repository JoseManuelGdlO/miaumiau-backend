const { encryptCredentialsPayload, decryptCredentialsPayload, decryptMetaAccessToken, assertEncryptionKey } = require('./credentialsCrypto');

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = 'llave-de-prueba';
});

test('el token cifrado se lee de vuelta y no queda en claro', () => {
  const stored = encryptCredentialsPayload({ accessToken: 'meta-token-1' });
  expect(stored).not.toContain('meta-token-1');
  expect(decryptCredentialsPayload(stored)).toEqual({ accessToken: 'meta-token-1' });
  expect(decryptMetaAccessToken(stored)).toBe('meta-token-1');
});

test('un paquete inválido no se trata como token en claro', () => {
  expect(() => decryptMetaAccessToken('no-es-json')).toThrow('Paquete de cifrado inválido');
});

test('sin llave no se cifra', () => {
  delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  expect(() => assertEncryptionKey()).toThrow('Falta CREDENTIALS_ENCRYPTION_KEY');
  try {
    assertEncryptionKey();
  } catch (error) {
    expect(error.status).toBe(503);
  }
});
