const express = require('express');
const router = express.Router();
const n8nController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

const validateTelefonoQuery = [
  query('telefono')
    .trim()
    .notEmpty()
    .withMessage('El teléfono es obligatorio')
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres'),

  handleValidationErrors,
];

const validateAlertaModificacionPedido = [
  body('telefono')
    .trim()
    .notEmpty()
    .withMessage('El teléfono es obligatorio')
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres'),

  body('fkid_conversacion')
    .isInt({ min: 1 })
    .withMessage('fkid_conversacion debe ser un número entero positivo'),

  body('texto_boton')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('texto_boton no puede exceder 255 caracteres'),

  body('mensaje_usuario')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('mensaje_usuario no puede exceder 2000 caracteres'),

  body('pedido_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('pedido_id debe ser un número entero positivo'),

  handleValidationErrors,
];

const validateWhatsAppImagen = [
  body('fkid_conversacion')
    .isInt({ min: 1 })
    .withMessage('fkid_conversacion debe ser un número entero positivo'),

  body('media_id')
    .trim()
    .notEmpty()
    .withMessage('media_id es obligatorio')
    .isLength({ max: 255 })
    .withMessage('media_id no puede exceder 255 caracteres'),

  body('mime_type')
    .optional()
    .trim()
    .isIn(['image/jpeg', 'image/png', 'image/webp'])
    .withMessage('mime_type debe ser image/jpeg, image/png o image/webp'),

  body('mensaje')
    .trim()
    .notEmpty()
    .withMessage('mensaje es obligatorio')
    .isLength({ min: 1, max: 5000 })
    .withMessage('mensaje debe tener entre 1 y 5000 caracteres'),

  body('whatsapp_message_id')
    .trim()
    .notEmpty()
    .withMessage('whatsapp_message_id es obligatorio')
    .isLength({ max: 255 })
    .withMessage('whatsapp_message_id no puede exceder 255 caracteres'),

  body('caption')
    .optional()
    .trim()
    .isLength({ max: 1024 })
    .withMessage('caption no puede exceder 1024 caracteres'),

  handleValidationErrors,
];

router.get(
  '/pedido-activo',
  authenticateToken,
  requireSuperAdminOrPermission('ver_pedidos'),
  validateTelefonoQuery,
  n8nController.checkPedidoActivo
);

router.post(
  '/alerta-modificacion-pedido',
  authenticateToken,
  requireSuperAdminOrPermission('crear_notificaciones'),
  validateAlertaModificacionPedido,
  n8nController.crearAlertaModificacionPedido
);

router.post(
  '/whatsapp-imagen',
  authenticateToken,
  requireSuperAdminOrPermission('ver_conversaciones_chat'),
  validateWhatsAppImagen,
  n8nController.recibirImagenWhatsApp
);

module.exports = router;
