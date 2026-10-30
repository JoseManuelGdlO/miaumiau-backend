const express = require('express');
const request = require('supertest');
const { createMetaPublicRouter } = require('./publicRoutes');
const { createInviteToken, pendingColumns } = require('../../services/cityWhatsappInvite');
const { memoryRepo } = require('../../services/cityWhatsappService');

beforeEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = 'llave-de-prueba';
  process.env.META_APP_ID = 'app';
  process.env.META_APP_SECRET = 'secret';
  process.env.META_EMBEDDED_SIGNUP_CONFIG_ID = 'cfg';
});

function appFor(repo, completeSignup) {
  const app = express();
  app.use(express.json());
  app.use('/api/public/meta', createMetaPublicRouter({
    repo,
    cityNameFor: async () => 'Durango',
    completeSignup
  }));
  return app;
}

test('el link pendiente devuelve la config y el signup responde 201', async () => {
  const repo = memoryRepo();
  const invite = createInviteToken();
  await repo.create({ city_id: 4, ...pendingColumns(invite), phone_number_id: null });
  const connectedInvite = createInviteToken();
  await repo.create({ city_id: 5, ...pendingColumns(connectedInvite), phone_number_id: 'phone-5' });
  const expiredInvite = createInviteToken(Date.parse('2000-01-01T00:00:00Z'));
  await repo.create({ city_id: 6, ...pendingColumns(expiredInvite), phone_number_id: null });

  const app = appFor(repo, async () => ({
    displayPhoneNumber: '+52 618 111 1111',
    coexistenceEnabled: true,
    phoneNumberId: 'phone-9',
    wabaId: 'waba-9'
  }));

  const missing = await request(app).get('/api/public/meta/invite/no-existe');
  expect(missing.status).toBe(404);
  expect(missing.body.error).toBe('El link de vinculación no es válido.');

  const pending = await request(app).get(`/api/public/meta/invite/${invite.token}`);
  expect(pending.status).toBe(200);
  expect(pending.body.ok).toBe(true);
  expect(pending.body.cityName).toBe('Durango');
  expect(pending.body.config.featureType).toBe('whatsapp_business_app_onboarding');
  expect(JSON.stringify(pending.body)).not.toContain('invite_token_encrypted');

  const used = await request(app).get(`/api/public/meta/invite/${connectedInvite.token}`);
  expect(used.status).toBe(410);

  const expired = await request(app).get(`/api/public/meta/invite/${expiredInvite.token}`);
  expect(expired.status).toBe(410);
  expect(expired.body.error).toBe('Este link ya venció. Pide uno nuevo a quien administra la ciudad.');

  const signup = await request(app).post('/api/public/meta/signup').send({ token: invite.token, code: 'c' });
  expect(signup.status).toBe(201);
  expect(signup.body).toMatchObject({ ok: true, phoneNumberId: 'phone-9', wabaId: 'waba-9' });
});
