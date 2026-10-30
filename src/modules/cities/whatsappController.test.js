const { memoryRepo, issueCityProfile, completeEmbeddedSignup } = require('../../services/cityWhatsappService');
const { createWhatsappHandlers, presentCity, removeProfileOnDelete } = require('./whatsappController');

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = 'llave-de-prueba';
  process.env.PUBLIC_BASE_URL = 'https://api.ejemplo.mx';
});

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

function graph() {
  return {
    exchangeEmbeddedSignupCode: async () => ({ accessToken: 'tok' }),
    subscribeWabaApp: async () => ({}),
    ensurePlatformCanManageWaba: async () => ({ skipped: true }),
    listWabaPhoneNumbers: async () => [{ id: 'phone-1', display_phone_number: '+52 1' }],
    getPhoneNumberDetails: async () => ({ id: 'phone-1', display_phone_number: '+52 1', is_on_biz_app: false, platform_type: 'CLOUD_API' }),
    initiateCoexistenceSync: async () => ({}),
    unsubscribeWabaApp: async () => ({})
  };
}

test('la ciudad pública no lleva el token y el alta sí lleva el link', async () => {
  const repo = memoryRepo();
  const issued = await issueCityProfile({ repo, cityId: 8 });
  const city = presentCity({ id: 8, nombre: 'Durango', invite_token_encrypted: 'no-va' }, issued.profile);
  expect(city.whatsapp.inviteStatus).toBe('pending');
  expect(JSON.stringify(city)).not.toContain(issued.profile.invite_token_encrypted);
  const handlers = createWhatsappHandlers({ repo, graph: graph() });
  const res = fakeRes();
  await handlers.show({ params: { id: '8' }, get: () => 'api.ejemplo.mx', protocol: 'https' }, res, () => {});
  expect(res.statusCode).toBe(200);
  expect(res.body.data.whatsapp.inviteUrl).toBe(`https://api.ejemplo.mx/vincular/${issued.invite.token}`);
});

test('regenerar conectada es 409, desconectar sin número es 404 y la baja igual borra', async () => {
  const repo = memoryRepo();
  const issued = await issueCityProfile({ repo, cityId: 8 });
  await completeEmbeddedSignup({
    repo,
    graph: graph(),
    token: issued.invite.token,
    code: 'c',
    wabaId: 'w',
    phoneNumberId: 'phone-1',
    event: 'FINISH'
  });
  const handlers = createWhatsappHandlers({ repo, graph: graph() });
  const blocked = fakeRes();
  await handlers.regenerate({ params: { id: '8' } }, blocked, () => {});
  expect(blocked.statusCode).toBe(409);
  expect((await repo.findByCityId(8)).phone_number_id).toBe('phone-1');

  const calls = [];
  await removeProfileOnDelete({
    profile: await repo.findByCityId(8),
    graph: { unsubscribeWabaApp: async () => { calls.push('off'); throw new Error('meta'); } },
    destroy: async () => { calls.push('destroy'); }
  });
  expect(calls).toEqual(['off', 'destroy']);

  await repo.update((await repo.findByCityId(8)).id, { phone_number_id: null });
  const missing = fakeRes();
  await handlers.disconnect({ params: { id: '8' } }, missing, () => {});
  expect(missing.statusCode).toBe(404);
});
