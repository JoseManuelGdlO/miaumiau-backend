const express = require('express');
const router = express.Router();
const conversacionController = require('./controller');
const flagController = require('../conversaciones-flags/controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateConversacion = [
  body('from')
    .isLength({ min: 2, max: 100 })
    .withMessage('El campo from debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s0-9\-_\.@]+$/)
    .withMessage('El campo from solo puede contener letras, números, espacios, guiones, guiones bajos, puntos y @'),
  
  body('status')
    .optional()
    .isIn(['activa', 'pausada', 'cerrada', 'en_espera'])
    .withMessage('El status debe ser: activa, pausada, cerrada o en_espera'),
  
  body('id_cliente')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del cliente debe ser un número entero positivo'),
  
  body('tipo_usuario')
    .optional()
    .isIn(['cliente', 'agente', 'bot', 'sistema'])
    .withMessage('El tipo de usuario debe ser: cliente, agente, bot o sistema'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateStatusChange = [
  body('status')
    .isIn(['activa', 'pausada', 'cerrada', 'en_espera'])
    .withMessage('El status debe ser: activa, pausada, cerrada o en_espera'),
  
  handleValidationErrors
];

const validateClientAssignment = [
  body('id_cliente')
    .isInt({ min: 1 })
    .withMessage('El ID del cliente debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateQuery = [
  query('status')
    .optional()
    .isIn(['activa', 'pausada', 'cerrada', 'en_espera'])
    .withMessage('El status debe ser: activa, pausada, cerrada o en_espera'),
  
  query('tipo_usuario')
    .optional()
    .isIn(['cliente', 'agente', 'bot', 'sistema'])
    .withMessage('El tipo de usuario debe ser: cliente, agente, bot o sistema'),
  
  query('id_cliente')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del cliente debe ser un número entero positivo'),
  
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  query('search')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('La búsqueda debe tener entre 2 y 100 caracteres'),
  
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('La fecha de inicio debe ser una fecha válida'),
  
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('La fecha de fin debe ser una fecha válida'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero positivo'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser entre 1 y 100'),
  
  query('flags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        const ids = value.split(',').map(id => id.trim());
        return ids.every(id => /^\d+$/.test(id));
      }
      return Array.isArray(value) && value.every(id => Number.isInteger(Number(id)));
    })
    .withMessage('El parámetro flags debe ser una lista de IDs separados por comas o un array'),
  
  handleValidationErrors
];

const validateSearch = [
  query('search')
    .isLength({ min: 2, max: 100 })
    .withMessage('La búsqueda debe tener entre 2 y 100 caracteres'),
  
  handleValidationErrors
];

const validateStatusParam = [
  param('status')
    .isIn(['activa', 'pausada', 'cerrada', 'en_espera'])
    .withMessage('El status debe ser: activa, pausada, cerrada o en_espera'),
  
  handleValidationErrors
];

const validateClientId = [
  param('clientId')
    .isInt({ min: 1 })
    .withMessage('El ID del cliente debe ser un número entero positivo'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información)
router.get('/stats', conversacionController.getConversacionStats);
router.get('/active', conversacionController.getActiveConversaciones);

// Rutas protegidas - Solo administradores y moderadores pueden gestionar conversaciones
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateQuery, 
  conversacionController.getAllConversaciones
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateId, 
  conversacionController.getConversacionById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateConversacion, 
  conversacionController.createConversacion
);

router.post('/find-or-create', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateConversacion, 
  conversacionController.findOrCreateConversacion
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateId, 
  validateConversacion, 
  conversacionController.updateConversacion
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateId, 
  conversacionController.deleteConversacion
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateId, 
  conversacionController.restoreConversacion
);

router.patch('/:id/status', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateId, 
  validateStatusChange, 
  conversacionController.changeStatus
);

router.patch('/:id/assign', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateId, 
  validateClientAssignment, 
  conversacionController.assignToClient
);

// Rutas para consultas específicas
router.get('/status/:status', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateStatusParam, 
  conversacionController.getConversacionesByStatus
);

router.get('/client/:clientId', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateClientId, 
  conversacionController.getConversacionesByClient
);

router.get('/search/term', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones'), 
  validateSearch, 
  conversacionController.searchConversaciones
);

router.get('/:id/flags',
  authenticateToken,
  requireSuperAdminOrPermission('ver_conversaciones'),
  validateId,
  flagController.getConversationFlags
);

module.exports = router;
