const webpush = require('web-push');
const { PushSubscription } = require('../models');
const usersWithPermission = require('../utils/usersWithPermission');

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return true;

  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@miaumiau.com';

  if (!pub || !priv) return false;

  webpush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

async function sendPushToUsersWithPermission(permissionName, { title, body, url }) {
  if (!configureVapid()) {
    return { sent: 0, skipped: 'no_vapid' };
  }

  const users = await usersWithPermission(permissionName);
  const payload = JSON.stringify({ title, body, url });
  let sent = 0;

  for (const user of users) {
    const subs = await PushSubscription.findAll({
      where: { user_id: user.id },
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 86400 }
        );
        sent += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sub.destroy();
        } else {
          console.warn('[webpush]', err.message);
        }
      }
    }
  }

  return { sent };
}

const CONVERSATION_DETAIL_PATH = '/dashboard/conversations';
const NOTIFICATIONS_PATH = '/dashboard/notifications';

function resolvePushUrlFromDatos(datos) {
  if (!datos || typeof datos !== 'object') {
    return NOTIFICATIONS_PATH;
  }

  const accion = datos.accion;
  if (accion?.tipo === 'ir_conversacion') {
    const conversacionId = accion.conversacionId ?? datos.conversacionId ?? datos.conversationId;
    if (conversacionId != null) {
      return `${CONVERSATION_DETAIL_PATH}/${conversacionId}`;
    }

    if (accion.ruta) {
      const rutaMatch = String(accion.ruta).match(/\/(?:conversations|conversaciones)\/(\d+)/);
      if (rutaMatch) {
        return `${CONVERSATION_DETAIL_PATH}/${rutaMatch[1]}`;
      }
      if (String(accion.ruta).startsWith('/')) {
        return accion.ruta;
      }
    }
  }

  if (datos.actionUrl) {
    return datos.actionUrl;
  }

  const conversacionId = datos.conversacionId ?? datos.conversationId;
  if (conversacionId != null) {
    return `${CONVERSATION_DETAIL_PATH}/${conversacionId}`;
  }

  return NOTIFICATIONS_PATH;
}

async function sendPushForNotificacion(notificacion) {
  return sendPushToUsersWithPermission('ver_notificaciones', {
    title: notificacion.nombre,
    body: notificacion.descripcion || '',
    url: resolvePushUrlFromDatos(notificacion.datos),
  });
}

module.exports = {
  configureVapid,
  sendPushToUsersWithPermission,
  resolvePushUrlFromDatos,
  sendPushForNotificacion,
};
