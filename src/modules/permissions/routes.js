const express = require('express');
const router = express.Router();
const permissionController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validatePermission = [
  body('nombre')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-z_]+$/)
    .withMessage('El nombre solo puede contener letras minúsculas y guiones bajos'),
  
  body('categoria')
    .isLength({ min: 2, max: 50 })
    .withMessage('La categoría debe tener entre 2 y 50 caracteres')
    .matches(/^[a-z_]+$/)
    .withMessage('La categoría solo puede contener letras minúsculas y guiones bajos'),
  
  body('descripcion')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),
  
  body('tipo')
    .isIn(['lectura', 'escritura', 'eliminacion', 'administracion', 'especial'])
    .withMessage('El tipo debe ser uno de: lectura, escritura, eliminacion, administracion, especial'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateQuery = [
  query('categoria')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('La categoría debe tener entre 2 y 50 caracteres'),
  
  query('tipo')
    .optional()
    .isIn(['lectura', 'escritura', 'eliminacion', 'administracion', 'especial'])
    .withMessage('El tipo debe ser uno de: lectura, escritura, eliminacion, administracion, especial'),
  
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información)
router.get('/categories', permissionController.getCategories);
router.get('/types', permissionController.getTypes);


// Rutas protegidas - Super admin o usuarios con permisos específicos
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_permisos'), 
  validateQuery, 
  permissionController.getAllPermissions
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_permisos'), 
  validateId, 
  permissionController.getPermissionById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('crear_permisos'), 
  validatePermission, 
  permissionController.createPermission
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('editar_permisos'), 
  validateId, 
  validatePermission, 
  permissionController.updatePermission
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('eliminar_permisos'), 
  validateId, 
  permissionController.deletePermission
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireSuperAdminOrPermission('editar_permisos'), 
  validateId, 
  permissionController.restorePermission
);

module.exports = router;
