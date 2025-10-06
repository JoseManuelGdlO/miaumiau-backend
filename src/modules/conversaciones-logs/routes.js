const express = require('express');
const router = express.Router();
const conversacionLogController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateLog = [
  body('fkid_conversacion')
    .isInt({ min: 1 })
    .withMessage('El ID de la conversación debe ser un número entero positivo'),
  
  body('data')
    .isObject()
    .withMessage('El campo data debe ser un objeto JSON válido')
    .notEmpty()
    .withMessage('El campo data no puede estar vacío'),
  
  body('tipo_log')
    .optional()
    .isIn(['inicio', 'mensaje', 'transferencia', 'escalacion', 'cierre', 'error', 'sistema'])
    .withMessage('El tipo de log debe ser: inicio, mensaje, transferencia, escalacion, cierre, error o sistema'),
  
  body('nivel')
    .optional()
    .isIn(['info', 'warning', 'error', 'debug'])
    .withMessage('El nivel debe ser: info, warning, error o debug'),
  
  body('descripcion')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateQuery = [
  query('fkid_conversacion')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID de la conversación debe ser un número entero positivo'),
  
  query('tipo_log')
    .optional()
    .isIn(['inicio', 'mensaje', 'transferencia', 'escalacion', 'cierre', 'error', 'sistema'])
    .withMessage('El tipo de log debe ser: inicio, mensaje, transferencia, escalacion, cierre, error o sistema'),
  
  query('nivel')
    .optional()
    .isIn(['info', 'warning', 'error', 'debug'])
    .withMessage('El nivel debe ser: info, warning, error o debug'),
  
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  query('search_key')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('La clave de búsqueda debe tener entre 1 y 50 caracteres'),
  
  query('search_value')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('El valor de búsqueda debe tener entre 1 y 100 caracteres'),
  
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
  query('search_key')
    .isLength({ min: 1, max: 50 })
    .withMessage('La clave de búsqueda debe tener entre 1 y 50 caracteres'),
  
  query('search_value')
    .isLength({ min: 1, max: 100 })
    .withMessage('El valor de búsqueda debe tener entre 1 y 100 caracteres'),
  
  handleValidationErrors
];

const validateConversacionId = [
  param('conversacionId')
    .isInt({ min: 1 })
    .withMessage('El ID de la conversación debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateTipo = [
  param('tipo')
    .isIn(['inicio', 'mensaje', 'transferencia', 'escalacion', 'cierre', 'error', 'sistema'])
    .withMessage('El tipo de log debe ser: inicio, mensaje, transferencia, escalacion, cierre, error o sistema'),
  
  handleValidationErrors
];

const validateNivel = [
  param('nivel')
    .isIn(['info', 'warning', 'error', 'debug'])
    .withMessage('El nivel debe ser: info, warning, error o debug'),
  
  handleValidationErrors
];

const validateFecha = [
  param('fecha')
    .isISO8601()
    .withMessage('La fecha debe ser una fecha válida'),
  
  handleValidationErrors
];

const validateDataUpdate = [
  body('data')
    .isObject()
    .withMessage('El campo data debe ser un objeto JSON válido'),
  
  handleValidationErrors
];

const validateDataAdd = [
  body('key')
    .isLength({ min: 1, max: 50 })
    .withMessage('La clave debe tener entre 1 y 50 caracteres'),
  
  body('value')
    .notEmpty()
    .withMessage('El valor no puede estar vacío'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información)
router.get('/stats', conversacionLogController.getLogStats);
router.get('/recent', conversacionLogController.getRecentLogs);
router.get('/errors', conversacionLogController.getErrorLogs);
router.get('/warnings', conversacionLogController.getWarningLogs);

// Rutas protegidas - Solo administradores y moderadores pueden gestionar logs
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateQuery, 
  conversacionLogController.getAllLogs
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateId, 
  conversacionLogController.getLogById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateLog, 
  conversacionLogController.createLog
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateId, 
  validateLog, 
  conversacionLogController.updateLog
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateId, 
  conversacionLogController.deleteLog
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateId, 
  conversacionLogController.restoreLog
);

router.patch('/:id/data', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateId, 
  validateDataUpdate, 
  conversacionLogController.updateLogData
);

router.patch('/:id/data/add', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateId, 
  validateDataAdd, 
  conversacionLogController.addToLogData
);

// Rutas para consultas específicas
router.get('/conversacion/:conversacionId', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateConversacionId, 
  conversacionLogController.getLogsByConversacion
);

router.get('/type/:tipo', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateTipo, 
  conversacionLogController.getLogsByType
);

router.get('/level/:nivel', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateNivel, 
  conversacionLogController.getLogsByLevel
);

router.get('/date/:fecha', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateFecha, 
  conversacionLogController.getLogsByDate
);

router.get('/search/data', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateSearch, 
  conversacionLogController.searchInData
);

router.get('/hour/:fecha', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_logs'), 
  validateFecha, 
  conversacionLogController.getLogsByHour
);

module.exports = router;
