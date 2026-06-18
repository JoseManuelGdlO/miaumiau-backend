const express = require('express');
const router = express.Router();
const pushController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

const validateSubscribe = [
  body('endpoint')
    .trim()
    .isURL()
    .withMessage('endpoint debe ser una URL válida'),
  body('keys.p256dh')
    .trim()
    .notEmpty()
    .withMessage('keys.p256dh es obligatorio'),
  body('keys.auth')
    .trim()
    .notEmpty()
    .withMessage('keys.auth es obligatorio'),
  handleValidationErrors,
];

const validateUnsubscribe = [
  body('endpoint')
    .trim()
    .isURL()
    .withMessage('endpoint debe ser una URL válida'),
  handleValidationErrors,
];

router.get(
  '/public-key',
  authenticateToken,
  requireSuperAdminOrPermission('ver_notificaciones'),
  pushController.getPushPublicKey
);

router.post(
  '/subscribe',
  authenticateToken,
  requireSuperAdminOrPermission('ver_notificaciones'),
  validateSubscribe,
  pushController.postSubscribe
);

router.post(
  '/unsubscribe',
  authenticateToken,
  requireSuperAdminOrPermission('ver_notificaciones'),
  validateUnsubscribe,
  pushController.postUnsubscribe
);

module.exports = router;
