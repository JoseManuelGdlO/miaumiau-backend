const { memoryRepo, issueCityProfile, completeEmbeddedSignup, regenerateCityInvite, disconnectCityWhatsapp, resolveWhatsAppAccessToken, backfillProfiles } = require('./cityWhatsappService');
const { hashInviteToken } = require('./cityWhatsappInvite');

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = 'llave-de-prueba';
});

function graph(overrides = {}) {
  return {
    exchangeEmbeddedSignupCode: async () => ({ accessToken: 'tok-ciudad' }),
    subscribeWabaApp: async () => ({}),
    ensurePlatformCanManageWaba: async () => ({ skipped: true }),
    listWabaPhoneNumbers: async () => [{ id: 'phone-1', display_phone_number: '+52 618 111 1111' }],
    getPhoneNumberDetails: async () => ({
      id: 'phone-1',
      display_phone_number: '+52 618 111 1111',
      is_on_biz_app: true,
      platform_type: 'CLOUD_API'
    }),
    initiateCoexistenceSync: async () => ({}),
    unsubscribeWabaApp: async () => ({}),
    ...overrides
  };
}

test('el alta deja un perfil pendiente y el signup guarda el número', async () => {
  const repo = memoryRepo();
  const issued = await issueCityProfile({ repo, cityId: 7, now: Date.parse('2026-10-29T00:00:00Z') });
  const result = await completeEmbeddedSignup({
    repo,
    graph: graph(),
    token: issued.invite.token,
    code: 'code-1',
    wabaId: 'waba-1',
    phoneNumberId: 'phone-1',
    businessId: 'biz-1',
    event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
  });
  expect(result.profile.phone_number_id).toBe('phone-1');
  expect(result.profile.access_token_encrypted).not.toContain('tok-ciudad');
  expect(result.coexistenceEnabled).toBe(true);
  expect(result.profile.coexistence_sync_error).toBeNull();
});

test('un número repetido no pisa la otra ciudad', async () => {
  const repo = memoryRepo();
  await issueCityProfile({ repo, cityId: 1 });
  const second = await issueCityProfile({ repo, cityId: 2 });
  await repo.update((await repo.findByCityId(1)).id, { phone_number_id: 'phone-1', access_token_encrypted: 'x' });
  await expect(completeEmbeddedSignup({
    repo,
    graph: graph(),
    token: second.invite.token,
    code: 'code-1',
    wabaId: 'waba-2',
    phoneNumberId: 'phone-1',
    event: 'FINISH'
  })).rejects.toMatchObject({ status: 409 });
  expect((await repo.findByCityId(2)).phone_number_id).toBeNull();
});

test('si la sync falla, la conexión queda y el error se guarda', async () => {
  const repo = memoryRepo();
  const issued = await issueCityProfile({ repo, cityId: 3 });
  const result = await completeEmbeddedSignup({
    repo,
    graph: graph({ initiateCoexistenceSync: async () => { throw new Error('sync caída'); } }),
    token: issued.invite.token,
    code: 'code-1',
    wabaId: 'waba-3',
    phoneNumberId: 'phone-3',
    event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
  });
  expect(result.profile.phone_number_id).toBe('phone-3');
  expect(result.profile.coexistence_sync_error).toBe('sync caída');
});

test('regenerar conectada es 409 y desconectar entrega otro link', async () => {
  const repo = memoryRepo();
  const issued = await issueCityProfile({ repo, cityId: 4 });
  await completeEmbeddedSignup({
    repo,
    graph: graph(),
    token: issued.invite.token,
    code: 'c',
    wabaId: 'w',
    phoneNumberId: 'phone-4',
    event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
  });
  await expect(regenerateCityInvite({ repo, cityId: 4 })).rejects.toMatchObject({ status: 409 });
  const disconnected = await disconnectCityWhatsapp({ repo, graph: graph(), cityId: 4 });
  expect(disconnected.profile.phone_number_id).toBeNull();
  expect(disconnected.invite.token).not.toBe(issued.invite.token);
  expect(hashInviteToken(disconnected.invite.token)).toBe(disconnected.profile.invite_token_hash);
  await expect(disconnectCityWhatsapp({ repo, graph: graph(), cityId: 4 })).rejects.toMatchObject({ status: 404 });
});

test('el token de envío sale de la ciudad o del global', () => {
  expect(resolveWhatsAppAccessToken({
    phoneNumberId: 'phone-9',
    profile: { phone_number_id: 'phone-9', access_token_encrypted: null },
    globalToken: 'global'
  })).toEqual({ token: '', source: 'city-unreadable' });
  expect(resolveWhatsAppAccessToken({
    phoneNumberId: 'otro',
    profile: null,
    globalToken: 'global'
  })).toEqual({ token: 'global', source: 'global' });
});

test('la migración crea un perfil por ciudad que no tiene', () => {
  const rows = backfillProfiles({ cityIds: [1, 2, 2], existingCityIds: [2], now: Date.parse('2026-10-29T00:00:00Z') });
  expect(rows.map((row) => row.city_id)).toEqual([1]);
  expect(rows[0].phone_number_id).toBeNull();
  expect(rows[0].invite_token_hash).toHaveLength(64);
});
