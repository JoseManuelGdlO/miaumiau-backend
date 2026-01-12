const express = require('express');
const router = express.Router();
const pagosController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones para generar link de Stripe
const validateGenerarLinkStripe = [
  body('telefono')
    .notEmpty()
    .withMessage('El teléfono es requerido')
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres')
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('El teléfono solo puede contener números, espacios, guiones, paréntesis y +'),
  
  body('productos')
    .isArray({ min: 1 })
    .withMessage('Los productos son requeridos y deben ser un array con al menos un elemento'),
  
  body('productos.*.id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del producto debe ser un número entero positivo'),
  
  body('productos.*.nombre')
    .optional()
    .isLength({ min: 1, max: 200 })
    .withMessage('El nombre del producto debe tener entre 1 y 200 caracteres'),
  
  body('productos.*.precio')
    .isFloat({ min: 0 })
    .withMessage('El precio del producto debe ser un número positivo'),
  
  body('productos.*.cantidad')
    .isInt({ min: 1 })
    .withMessage('La cantidad del producto debe ser un número entero positivo'),
  
  body('promocion_aplicada')
    .optional()
    .isObject()
    .withMessage('La promoción aplicada debe ser un objeto'),
  
  body('promocion_aplicada.valido')
    .optional()
    .isBoolean()
    .withMessage('El campo valido de la promoción debe ser un booleano'),
  
  body('promocion_aplicada.tipo_promocion')
    .optional()
    .isIn(['porcentaje', 'monto_fijo'])
    .withMessage('El tipo de promoción debe ser "porcentaje" o "monto_fijo"'),
  
  body('promocion_aplicada.valor_descuento')
    .optional()
    .custom((value) => {
      const numValue = parseFloat(value);
      return !isNaN(numValue) && numValue >= 0;
    })
    .withMessage('El valor de descuento debe ser un número positivo'),
  
  handleValidationErrors
];

// Ruta para generar link de pago de Stripe
router.post('/generar-link-stripe',
  authenticateToken,
  requireSuperAdminOrPermission('ver_pedidos'), // Usar permiso existente o crear uno nuevo
  validateGenerarLinkStripe,
  pagosController.generarLinkStripe
);

module.exports = router;
