const express = require('express');
const siteSettingsController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { uploadQr } = require('../../utils/uploadImages');

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

protectedRouter.post(
  '/qr-image',
  authenticateToken,
  requireSuperAdminOrPermission('configurar_qr'),
  (req, res, next) => {
    uploadQr.single('imagen')(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.code === 'LIMIT_FILE_SIZE'
            ? 'La imagen no debe superar 5 MB'
            : (err.message || 'Error al subir la imagen'),
        });
      }
      if (req.fileValidationError) {
        return res.status(400).json({
          success: false,
          message: req.fileValidationError,
        });
      }
      next();
    });
  },
  siteSettingsController.uploadQrImage
);

protectedRouter.put(
  '/maintenance-placeholder',
  authenticateToken,
  requireSuperAdminOrPermission('configurar_sistema'),
  siteSettingsController.updateMaintenancePlaceholder
);

protectedRouter.put(
  '/qr-actions',
  authenticateToken,
  requireSuperAdminOrPermission('configurar_qr'),
  siteSettingsController.updateQrActions
);

module.exports = {
  publicSiteSettingsRoutes: publicRouter,
  siteSettingsRoutes: protectedRouter,
};
