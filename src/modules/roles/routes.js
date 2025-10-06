const express = require('express');
const router = express.Router();
const roleController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateRole = [
  body('nombre')
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-z_]+$/)
    .withMessage('El nombre solo puede contener letras minúsculas y guiones bajos'),
  
  body('descripcion')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Los permisos deben ser un array'),
  
  body('permissions.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Cada permiso debe ser un ID válido'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validatePermissionId = [
  body('permission_id')
    .isInt({ min: 1 })
    .withMessage('El ID del permiso debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateQuery = [
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  query('include_permissions')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro include_permissions debe ser true o false'),
  
  handleValidationErrors
];

// Rutas protegidas - Solo administradores pueden gestionar roles
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_roles'), 
  validateQuery, 
  roleController.getAllRoles
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_roles'), 
  validateId, 
  roleController.getRoleById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_roles'), 
  validateRole, 
  roleController.createRole
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_roles'), 
  validateId, 
  validateRole, 
  roleController.updateRole
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_roles'), 
  validateId, 
  roleController.deleteRole
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_roles'), 
  validateId, 
  roleController.restoreRole
);

// Rutas para gestión de permisos en roles
router.post('/:id/permissions', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_roles'), 
  validateId, 
  validatePermissionId, 
  roleController.assignPermission
);

router.delete('/:id/permissions/:permission_id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_roles'), 
  validateId, 
  param('permission_id').isInt({ min: 1 }).withMessage('El ID del permiso debe ser un número entero positivo'),
  handleValidationErrors,
  roleController.removePermission
);

router.get('/:id/permissions', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_roles'), 
  validateId, 
  roleController.getRolePermissions
);

module.exports = router;
