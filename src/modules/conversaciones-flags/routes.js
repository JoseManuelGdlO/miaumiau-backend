const express = require('express');
const router = express.Router();
const flagController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateFlag = [
  body('nombre')
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('El color debe ser un código hexadecimal válido (ej: #3B82F6)'),
  
  body('descripcion')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  
  body('activo')
    .optional()
    .isBoolean()
    .withMessage('El campo activo debe ser un booleano'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateConversacionId = [
  param('conversacionId')
    .isInt({ min: 1 })
    .withMessage('El ID de conversación debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero mayor a 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser un número entre 1 y 100'),
  
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  query('activo')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activo debe ser true o false'),
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('La búsqueda debe tener entre 1 y 100 caracteres'),
  
  handleValidationErrors
];

// Rutas protegidas
router.get('/',
  authenticateToken,
  requireSuperAdminOrPermission('ver_conversaciones'),
  validateQuery,
  flagController.getAllFlags
);

router.get('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('ver_conversaciones'),
  validateId,
  flagController.getFlagById
);

router.post('/',
  authenticateToken,
  requireSuperAdminOrPermission('ver_conversaciones'),
  validateFlag,
  flagController.createFlag
);

router.put('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('ver_conversaciones'),
  validateId,
  validateFlag,
  flagController.updateFlag
);

router.delete('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('ver_conversaciones'),
  validateId,
  flagController.deleteFlag
);

router.patch('/:id/restore',
  authenticateToken,
  requireSuperAdminOrPermission('ver_conversaciones'),
  validateId,
  flagController.restoreFlag
);

router.post('/:id/asignar/:conversacionId',
  authenticateToken,
  requireSuperAdminOrPermission('ver_conversaciones'),
  validateId,
  validateConversacionId,
  flagController.assignFlagToConversation
);

router.delete('/:id/asignar/:conversacionId',
  authenticateToken,
  requireSuperAdminOrPermission('ver_conversaciones'),
  validateId,
  validateConversacionId,
  flagController.removeFlagFromConversation
);

module.exports = router;
