const express = require('express');
const { CityWhatsappProfile } = require('../../models');
const {
  hashInviteToken,
  assertInviteUsable,
  describeWhatsapp
} = require('../../services/cityWhatsappInvite');
const { publicMetaSignupConfig } = require('../../services/metaConfig');
const { completeEmbeddedSignup } = require('../../services/cityWhatsappService');
const { createCityWhatsappRepository } = require('../../services/cityWhatsappRepository');
const metaGraphClient = require('../../services/metaGraphClient');
const { sendHttpError } = require('../../utils/httpError');

function createMetaPublicRouter({
  repo,
  graph = metaGraphClient,
  cityNameFor,
  completeSignup = completeEmbeddedSignup
} = {}) {
  const router = express.Router();

  router.get('/invite/:token', async (req, res) => {
    try {
      const profile = await repo.findByInviteHash(hashInviteToken(req.params.token));
      assertInviteUsable(profile);
      const config = publicMetaSignupConfig();
      const cityName = cityNameFor
        ? await cityNameFor(profile)
        : `Ciudad ${profile.city_id}`;

      return res.json({
        ok: true,
        cityName,
        status: 'pending',
        configured: config.configured,
        config,
        ...describeWhatsapp(profile)
      });
    } catch (error) {
      return sendHttpError(res, error);
    }
  });

  router.post('/signup', async (req, res) => {
    try {
      const {
        token,
        code,
        wabaId,
        phoneNumberId,
        businessId,
        event
      } = req.body || {};
      const { profile, ...result } = await completeSignup({
        repo,
        graph,
        token,
        code,
        wabaId,
        phoneNumberId,
        businessId,
        event
      });
      return res.status(201).json({ ok: true, ...result });
    } catch (error) {
      return sendHttpError(res, error);
    }
  });

  return router;
}

const metaPublicRoutes = createMetaPublicRouter({
  repo: createCityWhatsappRepository(CityWhatsappProfile),
  graph: metaGraphClient
});

module.exports = { createMetaPublicRouter, metaPublicRoutes };
