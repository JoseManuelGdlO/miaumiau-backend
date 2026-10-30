const { httpError } = require('../utils/httpError');
const { encryptCredentialsPayload, decryptMetaAccessToken } = require('../utils/credentialsCrypto');
const {
  hashInviteToken,
  createInviteToken,
  assertInviteUsable,
  clearMetaFields,
  pendingColumns,
  inviteStatus
} = require('./cityWhatsappInvite');

function memoryRepo(seed = []) {
  let rows = seed.map((row) => ({ ...row }));
  let nextId = rows.reduce((max, row) => Math.max(max, row.id || 0), 0) + 1;
  const find = (pred) => rows.find(pred) || null;
  return {
    async findByInviteHash(hash) { return find((row) => row.invite_token_hash === hash); },
    async findByPhoneNumberId(phoneNumberId) { return find((row) => row.phone_number_id === phoneNumberId); },
    async findByCityId(cityId) { return find((row) => row.city_id === cityId); },
    async create(row) {
      const created = { id: nextId++, coexistence_enabled: false, coexistence_sync_error: null, phone_number_id: null, ...row };
      rows.push(created);
      return created;
    },
    async update(id, patch) {
      const row = find((item) => item.id === id);
      if (!row) throw httpError(404, 'Perfil no encontrado');
      Object.assign(row, patch);
      return row;
    },
    async destroyByCityId(cityId) {
      rows = rows.filter((row) => row.city_id !== cityId);
    }
  };
}

async function issueCityProfile({ repo, cityId, now = Date.now(), transaction } = {}) {
  const invite = createInviteToken(now);
  const profile = await repo.create({
    city_id: cityId,
    ...pendingColumns(invite),
    waba_id: null,
    phone_number_id: null,
    business_id: null,
    display_phone: null,
    access_token_encrypted: null,
    coexistence_enabled: false,
    coexistence_sync_error: null
  }, transaction);
  return { profile, invite };
}

async function regenerateCityInvite({ repo, cityId, now = Date.now() } = {}) {
  const profile = await repo.findByCityId(cityId);
  if (!profile) throw httpError(404, 'Perfil no encontrado');
  if (inviteStatus(profile, now) === 'connected') {
    throw httpError(409, 'Esta ciudad ya tiene WhatsApp vinculado. Desconéctalo para generar un link nuevo.');
  }
  const invite = createInviteToken(now);
  const updated = await repo.update(profile.id, { ...clearMetaFields(), ...pendingColumns(invite) });
  return { profile: updated, invite };
}

async function disconnectCityWhatsapp({ repo, graph, cityId, now = Date.now() } = {}) {
  const profile = await repo.findByCityId(cityId);
  if (!profile || !profile.phone_number_id) throw httpError(404, 'No hay una conexión de Meta para desconectar.');
  let token = '';
  try {
    token = decryptMetaAccessToken(profile.access_token_encrypted);
  } catch (error) {
    console.warn('disconnect: no se pudo leer el token de Meta', error.message);
  }
  if (token && profile.waba_id && graph?.unsubscribeWabaApp) {
    try {
      await graph.unsubscribeWabaApp(profile.waba_id, token);
    } catch (error) {
      console.warn('disconnect: no se pudo desuscribir el WABA', error.message);
    }
  }
  const invite = createInviteToken(now);
  const updated = await repo.update(profile.id, { ...clearMetaFields(), ...pendingColumns(invite) });
  return { profile: updated, invite };
}

function pickPhone(phones, preferredId) {
  if (!phones.length) return null;
  if (preferredId) {
    const match = phones.find((row) => String(row.id) === String(preferredId));
    if (match) return match;
  }
  return phones[0];
}

async function completeEmbeddedSignup({
  repo, graph, token, code, wabaId, phoneNumberId, businessId, event, now = Date.now()
} = {}) {
  const exchangeCode = String(code || '').trim();
  if (!exchangeCode) throw httpError(400, 'Falta el código de Embedded Signup.');
  const inviteToken = String(token || '').trim();
  if (!inviteToken) throw httpError(400, 'Falta el token de vinculación.');
  const profile = await repo.findByInviteHash(hashInviteToken(inviteToken));
  assertInviteUsable(profile, now);

  const { accessToken } = await graph.exchangeEmbeddedSignupCode(exchangeCode);
  const resolvedWabaId = String(wabaId || '').trim();
  if (!resolvedWabaId) throw httpError(400, 'Meta no devolvió el WABA ID. Completa de nuevo el flujo.');

  await graph.subscribeWabaApp(resolvedWabaId, accessToken);
  await graph.ensurePlatformCanManageWaba({ wabaId: resolvedWabaId, plannerAccessToken: accessToken });

  const phones = await graph.listWabaPhoneNumbers(resolvedWabaId, accessToken);
  let phone = pickPhone(phones, phoneNumberId);
  if (!phone && phoneNumberId) phone = await graph.getPhoneNumberDetails(phoneNumberId, accessToken);
  if (!phone?.id) throw httpError(400, 'No se encontró un número de WhatsApp en la cuenta conectada.');

  let details = phone;
  try {
    details = await graph.getPhoneNumberDetails(phone.id, accessToken);
  } catch (error) {
    console.warn('embedded signup: no se pudieron leer detalles del número', error.message);
  }

  const coexistenceByEvent = String(event || '').toUpperCase() === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING';
  const coexistenceEnabled = coexistenceByEvent || (details.is_on_biz_app === true && details.platform_type === 'CLOUD_API');
  const resolvedPhoneNumberId = String(phone.id);

  let coexistenceSyncError = null;
  if (coexistenceEnabled) {
    try {
      await graph.initiateCoexistenceSync({ phoneNumberId: resolvedPhoneNumberId, token: accessToken, syncType: 'smb_app_state_sync' });
    } catch (error) {
      coexistenceSyncError = error.message;
      console.warn('embedded signup: sync de coexistence falló', error.message);
    }
  }

  const owner = await repo.findByPhoneNumberId(resolvedPhoneNumberId);
  if (owner && owner.id !== profile.id) throw httpError(409, 'Ese número de WhatsApp ya está vinculado a otra ciudad.');

  let updated;
  try {
    updated = await repo.update(profile.id, {
      waba_id: resolvedWabaId,
      phone_number_id: resolvedPhoneNumberId,
      business_id: businessId ? String(businessId) : null,
      display_phone: String(details.display_phone_number || phone.display_phone_number || '').trim() || null,
      access_token_encrypted: encryptCredentialsPayload({ accessToken }),
      coexistence_enabled: coexistenceEnabled,
      coexistence_sync_error: coexistenceSyncError,
      invite_used_at: new Date(now).toISOString()
    });
  } catch (error) {
    if (/duplicate|unique|ER_DUP_ENTRY/i.test(error.message)) {
      throw httpError(409, 'Ese número de WhatsApp ya está vinculado a otra ciudad.');
    }
    throw error;
  }

  return {
    profile: updated,
    displayPhoneNumber: updated.display_phone,
    coexistenceEnabled,
    phoneNumberId: resolvedPhoneNumberId,
    wabaId: resolvedWabaId
  };
}

function resolveWhatsAppAccessToken({ phoneNumberId, profile, globalToken } = {}) {
  const id = String(phoneNumberId || '').trim();
  if (profile && profile.phone_number_id && String(profile.phone_number_id) === id) {
    const token = decryptMetaAccessToken(profile.access_token_encrypted);
    if (!token) return { token: '', source: 'city-unreadable' };
    return { token, source: 'city' };
  }
  return { token: String(globalToken || ''), source: 'global' };
}

function backfillProfiles({ cityIds, existingCityIds, now = Date.now() } = {}) {
  const have = new Set(existingCityIds || []);
  const seen = new Set();
  const rows = [];
  for (const cityId of cityIds || []) {
    if (have.has(cityId) || seen.has(cityId)) continue;
    seen.add(cityId);
    const invite = createInviteToken(now);
    rows.push({
      city_id: cityId,
      ...pendingColumns(invite),
      waba_id: null,
      phone_number_id: null,
      business_id: null,
      display_phone: null,
      access_token_encrypted: null,
      coexistence_enabled: false,
      coexistence_sync_error: null,
      created_at: new Date(now),
      updated_at: new Date(now)
    });
  }
  return rows;
}

module.exports = {
  memoryRepo,
  issueCityProfile,
  regenerateCityInvite,
  disconnectCityWhatsapp,
  completeEmbeddedSignup,
  resolveWhatsAppAccessToken,
  backfillProfiles
};
