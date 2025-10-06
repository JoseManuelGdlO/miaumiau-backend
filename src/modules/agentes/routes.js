const express = require('express');
const router = express.Router();
const agenteController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateAgente = [
  body('nombre')
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  
  body('contexto')
    .notEmpty()
    .withMessage('El contexto es requerido'),
  
  body('system_prompt')
    .notEmpty()
    .withMessage('El system prompt es requerido'),
  
  body('especialidad')
    .optional()
    .isLength({ max: 200 })
    .withMessage('La especialidad no puede exceder 200 caracteres'),
  
  body('personalidad')
    .optional()
    .isObject()
    .withMessage('La personalidad debe ser un objeto JSON válido'),
  
  body('configuracion')
    .optional()
    .isObject()
    .withMessage('La configuración debe ser un objeto JSON válido'),
  
  body('orden_prioridad')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El orden de prioridad debe ser un número entero mayor o igual a 0'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID inválido'),
  
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
  
  query('estado')
    .optional()
    .isIn(['activo', 'inactivo', 'mantenimiento'])
    .withMessage('Estado inválido'),
  
  handleValidationErrors
];

const validateEstado = [
  body('estado')
    .isIn(['activo', 'inactivo', 'mantenimiento'])
    .withMessage('Estado inválido'),
  
  handleValidationErrors
];

const validateRendimiento = [
  body('rendimiento')
    .isFloat({ min: 0, max: 5 })
    .withMessage('El rendimiento debe estar entre 0 y 5'),
  
  body('feedback')
    .optional()
    .isString()
    .withMessage('El feedback debe ser una cadena de texto'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información básica)
router.get('/activos', agenteController.getAgentesActivos);
router.get('/estadisticas', agenteController.getEstadisticas);

// Rutas protegidas - Super admin o usuarios con permisos específicos
router.get('/',
  authenticateToken,
  requireSuperAdminOrPermission('ver_agentes'),
  validateQuery,
  agenteController.getAllAgentes
);

router.get('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('ver_agentes'),
  validateId,
  agenteController.getAgenteById
);

router.post('/',
  authenticateToken,
  requireSuperAdminOrPermission('crear_agentes'),
  validateAgente,
  agenteController.createAgente
);

router.put('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('editar_agentes'),
  validateId,
  validateAgente,
  agenteController.updateAgente
);

router.delete('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('eliminar_agentes'),
  validateId,
  agenteController.deleteAgente
);

router.patch('/:id/restore',
  authenticateToken,
  requireSuperAdminOrPermission('editar_agentes'),
  validateId,
  agenteController.restoreAgente
);

router.patch('/:id/estado',
  authenticateToken,
  requireSuperAdminOrPermission('activar_desactivar_agentes'),
  validateId,
  validateEstado,
  agenteController.changeEstado
);

router.get('/especialidad/:especialidad',
  authenticateToken,
  requireSuperAdminOrPermission('ver_agentes'),
  agenteController.getAgentesByEspecialidad
);

router.get('/:id/conversaciones',
  authenticateToken,
  requireSuperAdminOrPermission('ver_estadisticas_agentes'),
  validateId,
  agenteController.getConversacionesAgente
);

router.patch('/conversaciones/:id/rendimiento',
  authenticateToken,
  requireSuperAdminOrPermission('ver_estadisticas_agentes'),
  validateRendimiento,
  agenteController.updateRendimiento
);

module.exports = router;
