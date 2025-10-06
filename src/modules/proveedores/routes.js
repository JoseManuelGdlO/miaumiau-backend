const express = require('express');
const router = express.Router();
const proveedorController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateProveedor = [
  body('nombre')
    .isLength({ min: 2, max: 150 })
    .withMessage('El nombre debe tener entre 2 y 150 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s0-9\-_\.]+$/)
    .withMessage('El nombre solo puede contener letras, números, espacios, guiones, guiones bajos y puntos'),
  
  body('descripcion')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),
  
  body('correo')
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
  
  body('telefono')
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres')
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('El teléfono debe tener un formato válido'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateEmail = [
  param('correo')
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
  
  handleValidationErrors
];

const validatePhone = [
  param('telefono')
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres')
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('El teléfono debe tener un formato válido'),
  
  handleValidationErrors
];

const validateQuery = [
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

const validateSearch = [
  query('search')
    .isLength({ min: 2, max: 100 })
    .withMessage('La búsqueda debe tener entre 2 y 100 caracteres'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información)
router.get('/stats', proveedorController.getProveedorStats);
router.get('/active', proveedorController.getActiveProveedores);

// Rutas protegidas - Solo administradores y moderadores pueden gestionar proveedores
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_proveedores'), 
  validateQuery, 
  proveedorController.getAllProveedores
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_proveedores'), 
  validateId, 
  proveedorController.getProveedorById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_proveedores'), 
  validateProveedor, 
  proveedorController.createProveedor
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_proveedores'), 
  validateId, 
  validateProveedor, 
  proveedorController.updateProveedor
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_proveedores'), 
  validateId, 
  proveedorController.deleteProveedor
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_proveedores'), 
  validateId, 
  proveedorController.restoreProveedor
);

router.patch('/:id/activate', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_proveedores'), 
  validateId, 
  proveedorController.activateProveedor
);

router.patch('/:id/deactivate', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_proveedores'), 
  validateId, 
  proveedorController.deactivateProveedor
);

// Rutas para consultas específicas
router.get('/search/term', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_proveedores'), 
  validateSearch, 
  proveedorController.searchProveedores
);

router.get('/email/:correo', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_proveedores'), 
  validateEmail, 
  proveedorController.getProveedorByEmail
);

router.get('/phone/:telefono', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_proveedores'), 
  validatePhone, 
  proveedorController.getProveedorByPhone
);

module.exports = router;
