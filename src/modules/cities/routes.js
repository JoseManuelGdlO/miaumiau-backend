const express = require('express');
const router = express.Router();
const cityController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateCity = [
  body('nombre')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),
  
  body('departamento')
    .isLength({ min: 2, max: 100 })
    .withMessage('El departamento debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El departamento solo puede contener letras y espacios'),
  
  body('direccion_operaciones')
    .isLength({ min: 10, max: 500 })
    .withMessage('La dirección debe tener entre 10 y 500 caracteres'),
  
  body('estado_inicial')
    .optional()
    .isIn(['activa', 'inactiva', 'en_construccion', 'mantenimiento', 'suspendida'])
    .withMessage('El estado debe ser uno de: activa, inactiva, en_construccion, mantenimiento, suspendida'),
  
  body('numero_zonas_entrega')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('El número de zonas debe ser entre 1 y 50'),
  
  body('area_cobertura')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El área de cobertura debe ser un número positivo'),
  
  body('tiempo_promedio_entrega')
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage('El tiempo promedio debe ser entre 1 y 1440 minutos'),
  
  body('horario_atencion')
    .optional()
    .isLength({ max: 100 })
    .withMessage('El horario no puede exceder 100 caracteres'),
  
  body('manager')
    .optional()
    .isLength({ max: 100 })
    .withMessage('El nombre del manager no puede exceder 100 caracteres'),
  
  body('telefono')
    .optional()
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('El teléfono debe tener un formato válido'),
  
  body('email_contacto')
    .optional()
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
  
  body('notas_adicionales')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Las notas no pueden exceder 1000 caracteres'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateDepartment = [
  param('departamento')
    .isLength({ min: 2, max: 100 })
    .withMessage('El departamento debe tener entre 2 y 100 caracteres'),
  
  handleValidationErrors
];

const validateStatus = [
  param('estado')
    .isIn(['activa', 'inactiva', 'en_construccion', 'mantenimiento', 'suspendida'])
    .withMessage('El estado debe ser uno de: activa, inactiva, en_construccion, mantenimiento, suspendida'),
  
  handleValidationErrors
];

const validateQuery = [
  query('departamento')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El departamento debe tener entre 2 y 100 caracteres'),
  
  query('estado_inicial')
    .optional()
    .isIn(['activa', 'inactiva', 'en_construccion', 'mantenimiento', 'suspendida'])
    .withMessage('El estado debe ser uno de: activa, inactiva, en_construccion, mantenimiento, suspendida'),
  
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  query('search')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('La búsqueda debe tener entre 2 y 100 caracteres'),
  
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

// Rutas públicas (solo para obtener información)
router.get('/departments', cityController.getDepartments);
router.get('/statuses', cityController.getStatuses);
router.get('/stats', cityController.getCityStats);
router.get('/active', cityController.getActiveCities);

// Rutas protegidas - Solo administradores y moderadores pueden gestionar ciudades
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_ciudades'), 
  validateQuery, 
  cityController.getAllCities
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_ciudades'), 
  validateId, 
  cityController.getCityById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_ciudades'), 
  validateCity, 
  cityController.createCity
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_ciudades'), 
  validateId, 
  validateCity, 
  cityController.updateCity
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_ciudades'), 
  validateId, 
  cityController.deleteCity
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_ciudades'), 
  validateId, 
  cityController.restoreCity
);

router.patch('/:id/activate', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_ciudades'), 
  validateId, 
  cityController.activateCity
);

router.patch('/:id/deactivate', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_ciudades'), 
  validateId, 
  cityController.deactivateCity
);

// Rutas para consultas específicas
router.get('/department/:departamento', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_ciudades'), 
  validateDepartment, 
  cityController.getCitiesByDepartment
);

router.get('/status/:estado', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_ciudades'), 
  validateStatus, 
  cityController.getCitiesByStatus
);

module.exports = router;
