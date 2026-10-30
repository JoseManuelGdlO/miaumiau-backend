const {
  createInviteToken,
  inviteStatus,
  describeWhatsapp,
  assertInviteUsable,
  inviteUrlFor,
  pendingColumns,
  readInviteToken,
  clearMetaFields,
  INVITE_TTL_MS
} = require('./cityWhatsappInvite');

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = 'llave-de-prueba';
});

const now = Date.parse('2026-10-29T12:00:00.000Z');

test('el link nace pendiente, vence a los 14 días y se puede leer', () => {
  const invite = createInviteToken(now);
  expect(Date.parse(invite.expiresAt) - now).toBe(INVITE_TTL_MS);
  const columns = pendingColumns(invite);
  expect(columns.invite_token_hash).toBe(invite.hash);
  expect(columns.invite_token_encrypted).not.toContain(invite.token);
  expect(readInviteToken(columns)).toBe(invite.token);
  const profile = { ...columns, phone_number_id: null, display_phone: null, coexistence_enabled: false };
  expect(inviteStatus(profile, now)).toBe('pending');
  expect(describeWhatsapp(profile, now).connected).toBe(false);
});

test('conectado gana a vencido, y vencido gana a usado', () => {
  expect(inviteStatus({ invite_token_hash: 'x', phone_number_id: '1', invite_expires_at: '2000-01-01' }, now)).toBe('connected');
  expect(inviteStatus({ invite_token_hash: 'x', phone_number_id: null, invite_expires_at: '2000-01-01', invite_used_at: '2000-01-02' }, now)).toBe('expired');
  expect(inviteStatus({ invite_token_hash: 'x', phone_number_id: null, invite_expires_at: '2099-01-01', invite_used_at: '2026-01-01' }, now)).toBe('used');
  expect(inviteStatus(null, now)).toBe('none');
});

test('un link usado o vencido no se puede abrir', () => {
  expect(() => assertInviteUsable(null, now)).toThrow('El link de vinculación no es válido.');
  expect(() => assertInviteUsable({ invite_token_hash: 'x', phone_number_id: '1' }, now)).toThrow('Este número ya está vinculado');

  const usedProfile = {
    invite_token_hash: 'x',
    phone_number_id: null,
    invite_expires_at: '2099-01-01',
    invite_used_at: '2026-01-01'
  };
  try {
    assertInviteUsable(usedProfile, now);
    throw new Error('assertInviteUsable should have thrown for used profile');
  } catch (error) {
    if (error.message === 'assertInviteUsable should have thrown for used profile') throw error;
    expect(error.status).toBe(410);
    expect(error.message).toBe('Este número ya está vinculado. Pide un link nuevo si necesitas reconectar.');
  }

  const expiredProfile = {
    invite_token_hash: 'x',
    invite_expires_at: '2000-01-01'
  };
  try {
    assertInviteUsable(expiredProfile, now);
    throw new Error('assertInviteUsable should have thrown for expired profile');
  } catch (error) {
    if (error.message === 'assertInviteUsable should have thrown for expired profile') throw error;
    expect(error.status).toBe(410);
    expect(error.message).toBe('Este link ya venció. Pide uno nuevo a quien administra la ciudad.');
  }
});

test('la url usa PUBLIC_BASE_URL', () => {
  process.env.PUBLIC_BASE_URL = 'https://api.ejemplo.mx/';
  expect(inviteUrlFor({}, 'abc')).toBe('https://api.ejemplo.mx/vincular/abc');
  expect(clearMetaFields()).toMatchObject({
    phone_number_id: null,
    access_token_encrypted: null,
    coexistence_enabled: false,
    coexistence_sync_error: null
  });
});
