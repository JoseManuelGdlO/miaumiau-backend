// FIREBASE_SERVICE_ACCOUNT = JSON de cuenta de servicio. google-services.json va en jmgo-delivery-buddy/mobile/android/app/
const { getHub } = require('../realtime');
const { Logger } = require('../../utils/logger');

const log = new Logger('PushNativo');

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function getModels(deps = {}) {
  return deps.models || require('../../models');
}

function credencialFirebase() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) return null;
  if (raw.startsWith('{')) {
    try {
      return JSON.parse(raw);
    } catch {
      log.warn('FIREBASE_SERVICE_ACCOUNT no es JSON');
      return null;
    }
  }
  const fs = require('fs');
  const path = require('path');
  const file = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    log.warn('FIREBASE_SERVICE_ACCOUNT no se pudo leer', { message: error.message });
    return null;
  }
}

function messaging() {
  const cred = credencialFirebase();
  if (!cred) return null;
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  return admin.messaging();
}

function tokenMuerto(err) {
  const code = err && err.code;
  return code === 'messaging/registration-token-not-registered'
    || code === 'messaging/invalid-registration-token';
}

function dataDe(aviso) {
  const raw = aviso && aviso.data;
  if (!raw || typeof raw !== 'object') return null;
  const data = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    data[key] = String(value);
  }
  return Object.keys(data).length ? data : null;
}

async function enviar(repartidorId, aviso, deps = {}) {
  if (!aviso || !aviso.titulo) return { sent: 0 };
  const push = deps.messaging || messaging();
  if (!push) return { sent: 0, skipped: 'no_firebase' };
  const db = getModels(deps);
  const rows = await db.RepartidorPushToken.findAll({ where: { fkid_repartidor: Number(repartidorId) } });
  const data = dataDe(aviso);
  let sent = 0;
  for (const row of rows) {
    try {
      const payload = {
        token: row.token,
        notification: { title: aviso.titulo, body: String(aviso.mensaje || aviso.titulo) },
        android: { priority: 'high' },
      };
      if (data) payload.data = data;
      await push.send(payload);
      sent += 1;
    } catch (err) {
      if (tokenMuerto(err) && typeof row.destroy === 'function') await row.destroy();
      else log.warn('fcm', { message: err.message });
    }
  }
  return { sent };
}

async function guardarToken(deps = {}) {
  const token = String(deps.token || '').trim();
  if (token.length < 20) fail(422, 'Token inválido');
  const db = getModels(deps);
  const existente = await db.RepartidorPushToken.findOne({ where: { token } });
  const plataforma = String(deps.plataforma || 'android');
  if (existente) {
    await existente.update({ fkid_repartidor: deps.repartidorId, plataforma });
    return { ok: true };
  }
  await db.RepartidorPushToken.create({
    fkid_repartidor: deps.repartidorId,
    token,
    plataforma,
  });
  return { ok: true };
}

async function borrarToken(deps = {}) {
  const db = getModels(deps);
  const token = String(deps.token || '').trim();
  const where = { fkid_repartidor: deps.repartidorId };
  if (token) where.token = token;
  await db.RepartidorPushToken.destroy({ where });
  return { ok: true };
}

function avisar(repartidorId, event, aviso, deps = {}) {
  let ws = 0;
  const notify = deps.notify || ((id, payload) => getHub().notify(id, payload));
  if (repartidorId != null && repartidorId !== '') {
    try {
      ws = notify(Number(repartidorId), event) || 0;
    } catch (error) {
      log.warn('ws', { message: error.message });
    }
  }
  if (aviso && aviso.titulo) {
    const send = deps.enviar || enviar;
    void Promise.resolve(send(repartidorId, aviso, deps)).catch((error) => {
      log.warn('fcm', { message: error.message });
    });
  }
  return ws;
}

module.exports = { guardarToken, borrarToken, avisar, enviar };
