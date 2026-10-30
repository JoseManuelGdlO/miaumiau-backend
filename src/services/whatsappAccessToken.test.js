const { accessTokenForSend } = require('./whatsappAccessToken');
const { encryptCredentialsPayload } = require('../utils/credentialsCrypto');

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = 'llave-de-prueba';
  process.env.WHATSAPP_API_TOKEN = 'token-global';
});

test('una ciudad conectada usa su token', async () => {
  const token = await accessTokenForSend('phone-1', {
    findProfile: async () => ({
      phone_number_id: 'phone-1',
      access_token_encrypted: encryptCredentialsPayload({ accessToken: 'token-ciudad' })
    })
  });
  expect(token).toBe('token-ciudad');
});

test('sin perfil usa el token global', async () => {
  const token = await accessTokenForSend('desconocido', { findProfile: async () => null });
  expect(token).toBe('token-global');
});

test('sin perfil ni token global falla antes de enviar', async () => {
  delete process.env.WHATSAPP_API_TOKEN;
  await expect(accessTokenForSend('desconocido', { findProfile: async () => null }))
    .rejects.toThrow('Faltan variables de entorno de WhatsApp');
});

test('un token de ciudad ilegible no cae al global', async () => {
  await expect(accessTokenForSend('phone-1', {
    findProfile: async () => ({ phone_number_id: 'phone-1', access_token_encrypted: 'basura' })
  })).rejects.toThrow('No se pudo leer el token de WhatsApp de la ciudad.');
});
