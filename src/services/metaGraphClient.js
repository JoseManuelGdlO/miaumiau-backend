const { httpError } = require('../utils/httpError');
const { metaEnv } = require('./metaConfig');

function graphBase() {
  return `https://graph.facebook.com/${metaEnv().graphVersion}`;
}

async function graphRequest({ method = 'GET', path, token, query = {}, body } = {}) {
  const url = new URL(`${graphBase()}/${String(path || '').replace(/^\/+/, '')}`);
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body)
    });
  } catch (error) {
    throw httpError(502, 'No se pudo contactar la API de Meta.');
  }
  const text = await res.text();
  const payload = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = payload?.error?.message || 'Error de Graph API';
    throw httpError(res.status >= 400 && res.status < 600 ? res.status : 502, message);
  }
  return payload;
}

function isBenignWabaLinkError(error) {
  return /\balready\b|\bduplicate\b|\blinked\b|\bshared\b/i.test(String(error?.message || ''));
}

async function exchangeEmbeddedSignupCode(code) {
  const { appId, appSecret } = metaEnv();
  if (!appId || !appSecret) throw httpError(500, 'Faltan META_APP_ID o META_APP_SECRET en el servidor.');
  const payload = await graphRequest({
    method: 'GET',
    path: 'oauth/access_token',
    query: { client_id: appId, client_secret: appSecret, code: String(code || '').trim() }
  });
  const accessToken = String(payload.access_token || '').trim();
  if (!accessToken) throw httpError(502, 'Meta no devolvió un access token intercambiable.');
  return { accessToken };
}

async function subscribeWabaApp(wabaId, token) {
  return graphRequest({ method: 'POST', path: `${wabaId}/subscribed_apps`, token });
}

async function unsubscribeWabaApp(wabaId, token) {
  return graphRequest({ method: 'DELETE', path: `${wabaId}/subscribed_apps`, token });
}

async function listWabaPhoneNumbers(wabaId, token) {
  const payload = await graphRequest({
    method: 'GET',
    path: `${wabaId}/phone_numbers`,
    token,
    query: { fields: 'id,display_phone_number,verified_name,quality_rating,is_on_biz_app,platform_type' }
  });
  return Array.isArray(payload.data) ? payload.data : [];
}

async function getPhoneNumberDetails(phoneNumberId, token) {
  return graphRequest({
    method: 'GET',
    path: phoneNumberId,
    token,
    query: { fields: 'id,display_phone_number,verified_name,quality_rating,is_on_biz_app,platform_type' }
  });
}

async function initiateCoexistenceSync({ phoneNumberId, token, syncType }) {
  return graphRequest({
    method: 'POST',
    path: `${phoneNumberId}/smb_app_data`,
    token,
    body: { messaging_product: 'whatsapp', sync_type: syncType }
  });
}

async function ensurePlatformCanManageWaba({ wabaId, plannerAccessToken } = {}) {
  const env = metaEnv();
  if (!env.accessToken) return { skipped: true, reason: 'no_platform_token', shared: false, assigned: false };
  const token = String(plannerAccessToken || env.accessToken).trim();
  let shared = false;
  if (env.businessId) {
    try {
      await graphRequest({
        method: 'POST',
        path: `${env.businessId}/client_whatsapp_business_accounts`,
        token,
        query: { waba_id: wabaId }
      });
      shared = true;
    } catch (error) {
      if (!isBenignWabaLinkError(error)) console.warn('OBO: no se pudo vincular el WABA', error.message);
      else shared = true;
    }
  }
  let assigned = false;
  if (env.systemUserId) {
    try {
      await graphRequest({
        method: 'POST',
        path: `${wabaId}/assigned_users`,
        token,
        query: { user: env.systemUserId, tasks: JSON.stringify(['MANAGE']) }
      });
      assigned = true;
    } catch (error) {
      if (!isBenignWabaLinkError(error)) console.warn('OBO: no se pudo asignar el system user', error.message);
      else assigned = true;
    }
  }
  return { skipped: false, shared, assigned };
}

module.exports = {
  exchangeEmbeddedSignupCode,
  subscribeWabaApp,
  unsubscribeWabaApp,
  listWabaPhoneNumbers,
  getPhoneNumberDetails,
  initiateCoexistenceSync,
  ensurePlatformCanManageWaba
};
