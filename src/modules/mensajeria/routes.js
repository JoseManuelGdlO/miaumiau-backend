const express = require('express');
const { body } = require('express-validator');
const mensajeriaController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { handleValidationErrors } = require('../../utils/validation');

const router = express.Router();

const validateSendMessage = [
  body('conversacionId')
    .isInt({ min: 1 })
    .withMessage('El ID de la conversación debe ser un número entero positivo'),
  body('mensaje')
    .isLength({ min: 1, max: 5000 })
    .withMessage('El mensaje debe tener entre 1 y 5000 caracteres')
    .notEmpty()
    .withMessage('El mensaje no puede estar vacío'),
  handleValidationErrors
];

const validateUpdateStatus = [
  body('messageId')
    .notEmpty()
    .withMessage('messageId es requerido')
    .isString()
    .withMessage('messageId debe ser un string'),
  body('status')
    .notEmpty()
    .withMessage('status es requerido')
    .isIn(['sent', 'delivered', 'read', 'failed', 'pending'])
    .withMessage('status debe ser uno de: sent, delivered, read, failed, pending'),
  body('timestamp')
    .optional()
    .isNumeric()
    .withMessage('timestamp debe ser un número'),
  handleValidationErrors
];

const validateUpdateMultipleStatuses = [
  body('updates')
    .isArray({ min: 1 })
    .withMessage('updates debe ser un array no vacío'),
  body('updates.*.messageId')
    .notEmpty()
    .withMessage('messageId es requerido en cada actualización'),
  body('updates.*.status')
    .notEmpty()
    .withMessage('status es requerido en cada actualización')
    .isIn(['sent', 'delivered', 'read', 'failed', 'pending'])
    .withMessage('status debe ser uno de: sent, delivered, read, failed, pending'),
  handleValidationErrors
];

router.post(
  '/send-whatsapp',
  authenticateToken,
  requireSuperAdminOrPermission('enviar_conversaciones_chat'),
  validateSendMessage,
  mensajeriaController.sendWhatsAppMessage
);

// Webhook de WhatsApp (sin autenticación, usa verify token)
// GET para verificación inicial de Meta/Facebook
// POST para recibir actualizaciones de estado
// NOTA: Este endpoint puede no usarse si n8n maneja el webhook directamente
router.get('/webhook/whatsapp', mensajeriaController.handleWhatsAppWebhook);
router.post('/webhook/whatsapp', mensajeriaController.handleWhatsAppWebhook);

// Endpoint para que n8n actualice estados de mensajes
// Requiere autenticación para seguridad
router.post(
  '/update-message-status',
  authenticateToken,
  validateUpdateStatus,
  mensajeriaController.updateMessageStatus
);

// Endpoint para actualizar múltiples estados a la vez (útil para n8n)
router.post(
  '/update-multiple-message-statuses',
  authenticateToken,
  validateUpdateMultipleStatuses,
  mensajeriaController.updateMultipleMessageStatuses
);

module.exports = router;
