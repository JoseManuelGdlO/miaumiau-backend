const { PushSubscription } = require('../../models');

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
      next(error);
    }
  }

  async postSubscribe(req, res, next) {
    try {
      const { endpoint, keys } = req.body;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
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

      res.status(201).json({
        success: true,
        id: row.id,
      });
    } catch (error) {
      next(error);
    }
  }

  async postUnsubscribe(req, res, next) {
    try {
      const { endpoint } = req.body;

      if (!endpoint) {
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
      next(error);
    }
  }
}

module.exports = new PushController();
