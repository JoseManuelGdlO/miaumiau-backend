const crypto = require('crypto');
const { httpError } = require('./httpError');

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;

function assertEncryptionKey() {
  if (!String(process.env.CREDENTIALS_ENCRYPTION_KEY || '').trim()) {
    throw httpError(503, 'Falta CREDENTIALS_ENCRYPTION_KEY');
  }
}

function getKey() {
  assertEncryptionKey();
  return crypto.createHash('sha256').update(String(process.env.CREDENTIALS_ENCRYPTION_KEY)).digest();
}

function encryptCredentialsPayload(payload) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv, { authTagLength: 16 });
  const enc = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return JSON.stringify({
    v: 1,
    iv: iv.toString('base64'),
    data: enc.toString('base64'),
    tag: cipher.getAuthTag().toString('base64')
  });
}

function decryptCredentialsPayload(stored) {
  const parsed = JSON.parse(stored);
  if (parsed.v !== 1 || !parsed.iv || !parsed.data || !parsed.tag) {
    throw new Error('Paquete de cifrado inválido');
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(parsed.iv, 'base64'), { authTagLength: 16 });
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(parsed.data, 'base64')), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

function decryptMetaAccessToken(stored) {
  if (!stored) return '';
  let payload;
  try {
    payload = decryptCredentialsPayload(stored);
  } catch (error) {
    if (error.message === 'Paquete de cifrado inválido' || error instanceof SyntaxError) {
      throw new Error('Paquete de cifrado inválido');
    }
    throw error;
  }
  return String(payload.accessToken || payload.token || '').trim();
}

module.exports = {
  assertEncryptionKey,
  encryptCredentialsPayload,
  decryptCredentialsPayload,
  decryptMetaAccessToken
};
