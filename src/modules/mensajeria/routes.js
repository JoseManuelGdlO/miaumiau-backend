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
router.get('/webhook/whatsapp', mensajeriaController.handleWhatsAppWebhook);
router.post('/webhook/whatsapp', mensajeriaController.handleWhatsAppWebhook);

module.exports = router;
