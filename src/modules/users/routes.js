const express = require('express');
const router = express.Router();
const usersController = require('./controller');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateUser = [
  body('nombre_completo')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre completo debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),
  
  body('correo_electronico')
    .isEmail()
    .withMessage('Debe ser un correo electrónico válido')
    .normalizeEmail(),
  
  body('contrasena')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  
  body('rol_id')
    .isInt({ min: 1 })
    .withMessage('El ID del rol debe ser un número entero positivo'),
  
  body('ciudad_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID de la ciudad debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateUserUpdate = [
  body('nombre_completo')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre completo debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),
  
  body('correo_electronico')
    .optional()
    .isEmail()
    .withMessage('Debe ser un correo electrónico válido')
    .normalizeEmail(),
  
  body('rol_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del rol debe ser un número entero positivo'),
  
  body('ciudad_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID de la ciudad debe ser un número entero positivo'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser un valor booleano'),
  
  handleValidationErrors
];

const validatePasswordChange = [
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('La nueva contraseña debe tener al menos 6 caracteres'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateQuery = [
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  query('rol_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del rol debe ser un número entero positivo'),
  
  query('ciudad_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID de la ciudad debe ser un número entero positivo'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero positivo'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser un número entre 1 y 100'),
  
  handleValidationErrors
];

// Rutas protegidas - Solo administradores pueden gestionar usuarios
router.get('/', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateQuery, 
  usersController.getAllUsers
);

router.get('/stats', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  usersController.getUserStats
);

router.get('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']),
  validateId, 
  usersController.getUserById
);

router.post('/', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateUser, 
  usersController.createUser
);

router.put('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  validateUserUpdate, 
  usersController.updateUser
);

router.delete('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  usersController.deleteUser
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  usersController.restoreUser
);

router.patch('/:id/change-password', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  validatePasswordChange, 
  usersController.changeUserPassword
);

module.exports = router;
