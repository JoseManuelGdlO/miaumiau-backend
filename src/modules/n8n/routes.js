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

module.exports = router;
