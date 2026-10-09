const { PushSubscription } = require('../../models');

const { Logger } = require('../../utils/logger');

const log = new Logger('Push');

class PushController {
  async getPushPublicKey(req, res, next) {
    try {
      const key = process.env.VAPID_PUBLIC_KEY;

      if (!key) {
        return res.status(503).json({
          success: false,
          message: 'Web push no configurado (faltan VAPID_* en el servidor)',
        });
      }

      res.status(200).json({
        success: true,
        publicKey: key,
      });
    } catch (error) {
      log.error('getPushPublicKey falló', { message: error.message });
      next(error);
    }
  }

  async postSubscribe(req, res, next) {
    try {
      const { endpoint, keys } = req.body;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        log.warn('postSubscribe rechazado', { status: 400, reason: "endpoint y keys (p256dh, auth) son obligatorios" });
        return res.status(400).json({
          success: false,
          message: 'endpoint y keys (p256dh, auth) son obligatorios',
        });
      }

      const userAgent =
        typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

      const existing = await PushSubscription.findOne({ where: { endpoint } });

      if (existing) {
        await existing.update({
          user_id: req.user.id,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: userAgent,
        });

        return res.status(200).json({
          success: true,
          id: existing.id,
        });
      }

      const row = await PushSubscription.create({
        user_id: req.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent,
      });

      log.info('postSubscribe', { id: row.id });
      res.status(201).json({
        success: true,
        id: row.id,
      });
    } catch (error) {
      log.error('postSubscribe falló', { message: error.message });
      next(error);
    }
  }

  async postUnsubscribe(req, res, next) {
    try {
      const { endpoint } = req.body;

      if (!endpoint) {
        log.warn('postUnsubscribe rechazado', { status: 400, reason: "endpoint es obligatorio" });
        return res.status(400).json({
          success: false,
          message: 'endpoint es obligatorio',
        });
      }

      await PushSubscription.destroy({
        where: {
          endpoint,
          user_id: req.user.id,
        },
      });

      res.status(200).json({ success: true });
    } catch (error) {
      log.error('postUnsubscribe falló', { message: error.message });
      next(error);
    }
  }
}

module.exports = new PushController();
