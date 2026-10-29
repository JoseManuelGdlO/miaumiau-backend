const crypto = require('crypto');
const { httpError } = require('../utils/httpError');
const { assertEncryptionKey, encryptCredentialsPayload, decryptCredentialsPayload } = require('../utils/credentialsCrypto');

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function hashInviteToken(token) {
  return crypto.createHash('sha256').update(String(token || '').trim()).digest('hex');
}

function createInviteToken(now = Date.now()) {
  assertEncryptionKey();
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashInviteToken(token), expiresAt: new Date(now + INVITE_TTL_MS).toISOString() };
}

function parseExpiry(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function inviteStatus(profile, now = Date.now()) {
  if (!profile || !profile.invite_token_hash) return profile?.phone_number_id ? 'connected' : 'none';
  if (profile.phone_number_id) return 'connected';
  const exp = parseExpiry(profile.invite_expires_at);
  if (Number.isFinite(exp) && exp < now) return 'expired';
  if (profile.invite_used_at) return 'used';
  return 'pending';
}

function describeWhatsapp(profile, now = Date.now()) {
  const status = inviteStatus(profile, now);
  return {
    connected: status === 'connected',
    inviteStatus: status,
    displayPhone: profile?.display_phone || null,
    coexistenceEnabled: Boolean(profile?.coexistence_enabled),
    expiresAt: profile?.invite_expires_at || null
  };
}

function assertInviteUsable(profile, now = Date.now()) {
  const status = inviteStatus(profile, now);
  if (!profile || status === 'none') throw httpError(404, 'El link de vinculación no es válido.');
  if (status === 'connected' || status === 'used') {
    throw httpError(410, 'Este número ya está vinculado. Pide un link nuevo si necesitas reconectar.');
  }
  if (status === 'expired') {
    throw httpError(410, 'Este link ya venció. Pide uno nuevo a quien administra la ciudad.');
  }
  return status;
}

function publicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const proto = req?.get?.('x-forwarded-proto') || req?.protocol || 'http';
  const host = req?.get?.('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

function inviteUrlFor(req, token) {
  return `${publicBaseUrl(req)}/vincular/${encodeURIComponent(token)}`;
}

function clearMetaFields() {
  return {
    waba_id: null,
    phone_number_id: null,
    business_id: null,
    display_phone: null,
    access_token_encrypted: null,
    coexistence_enabled: false,
    coexistence_sync_error: null
  };
}

function pendingColumns(invite) {
  return {
    invite_token_hash: invite.hash,
    invite_token_encrypted: encryptCredentialsPayload({ token: invite.token }),
    invite_expires_at: invite.expiresAt,
    invite_used_at: null
  };
}

function readInviteToken(profile) {
  const payload = decryptCredentialsPayload(profile.invite_token_encrypted);
  return String(payload.token || '').trim();
}

module.exports = {
  INVITE_TTL_MS,
  hashInviteToken,
  createInviteToken,
  inviteStatus,
  describeWhatsapp,
  assertInviteUsable,
  publicBaseUrl,
  inviteUrlFor,
  clearMetaFields,
  pendingColumns,
  readInviteToken
};
