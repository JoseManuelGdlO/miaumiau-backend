const express = require('express');
const siteSettingsController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');

const publicRouter = express.Router();
publicRouter.get('/site-settings', siteSettingsController.getPublic);

const protectedRouter = express.Router();

protectedRouter.put(
  '/hero-youtube-video-id',
  authenticateToken,
  requireSuperAdminOrPermission('configurar_sistema'),
  siteSettingsController.updateHeroYoutubeVideoId
);

protectedRouter.put(
  '/public-links',
  authenticateToken,
  requireSuperAdminOrPermission('configurar_sistema'),
  siteSettingsController.updatePublicLinks
);

module.exports = {
  publicSiteSettingsRoutes: publicRouter,
  siteSettingsRoutes: protectedRouter,
};
