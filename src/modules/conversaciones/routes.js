const express = require('express');
const router = express.Router();
const conversacionController = require('./controller');
const { authenticateToken, requireRole } = require('../../middleware/auth');
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
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateQuery, 
  conversacionController.getAllConversaciones
);

router.get('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateId, 
  conversacionController.getConversacionById
);

router.post('/', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateConversacion, 
  conversacionController.createConversacion
);

router.put('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  validateConversacion, 
  conversacionController.updateConversacion
);

router.delete('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  conversacionController.deleteConversacion
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  conversacionController.restoreConversacion
);

router.patch('/:id/status', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateId, 
  validateStatusChange, 
  conversacionController.changeStatus
);

router.patch('/:id/assign', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateId, 
  validateClientAssignment, 
  conversacionController.assignToClient
);

// Rutas para consultas específicas
router.get('/status/:status', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateStatusParam, 
  conversacionController.getConversacionesByStatus
);

router.get('/client/:clientId', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateClientId, 
  conversacionController.getConversacionesByClient
);

router.get('/search/term', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateSearch, 
  conversacionController.searchConversaciones
);

module.exports = router;
