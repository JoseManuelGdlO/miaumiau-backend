const express = require('express');
const router = express.Router();
const paqueteController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones para crear paquete (todos los campos requeridos)
const validatePaquete = [
  body('nombre')
    .isLength({ min: 2, max: 200 })
    .withMessage('El nombre debe tener entre 2 y 200 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s0-9\-_\.]+$/)
    .withMessage('El nombre solo puede contener letras, números, espacios, guiones, guiones bajos y puntos'),
  
  body('descripcion')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),
  
  body('precio')
    .isFloat({ min: 0 })
    .withMessage('El precio debe ser un número positivo'),
  
  body('descuento')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El descuento debe ser un número entre 0 y 100'),
  
  body('productos')
    .optional()
    .isArray({ min: 0 })
    .withMessage('Los productos deben ser un array'),
  
  body('productos.*.fkid_producto')
    .if(body('productos').isArray())
    .isInt({ min: 1 })
    .withMessage('El ID del producto debe ser un número entero positivo'),
  
  body('productos.*.cantidad')
    .if(body('productos').isArray())
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser un número entero positivo'),
  
  handleValidationErrors
];

// Validaciones para actualizar paquete (todos los campos opcionales)
const validateUpdatePaquete = [
  body('nombre')
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage('El nombre debe tener entre 2 y 200 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s0-9\-_\.]+$/)
    .withMessage('El nombre solo puede contener letras, números, espacios, guiones, guiones bajos y puntos'),
  
  body('descripcion')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),
  
  body('precio')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio debe ser un número positivo'),
  
  body('descuento')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El descuento debe ser un número entre 0 y 100'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active debe ser un valor booleano'),
  
  body('productos')
    .optional()
    .isArray({ min: 0 })
    .withMessage('Los productos deben ser un array'),
  
  body('productos.*.fkid_producto')
    .if(body('productos').isArray())
    .isInt({ min: 1 })
    .withMessage('El ID del producto debe ser un número entero positivo'),
  
  body('productos.*.cantidad')
    .if(body('productos').isArray())
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser un número entero positivo'),
  
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

const validateToggleStatus = [
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active debe ser un valor booleano'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información)
router.get('/stats', paqueteController.getPaqueteStats);
router.get('/activos', paqueteController.getPaquetesActivos);

// Rutas protegidas - Solo administradores y moderadores pueden gestionar paquetes
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_paquetes'), 
  validateQuery, 
  paqueteController.getAllPaquetes
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_paquetes'), 
  validateId, 
  paqueteController.getPaqueteById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('crear_paquetes'), 
  validatePaquete, 
  paqueteController.createPaquete
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('editar_paquetes'), 
  validateId, 
  validateUpdatePaquete, 
  paqueteController.updatePaquete
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('eliminar_paquetes'), 
  validateId, 
  paqueteController.deletePaquete
);

router.patch('/:id/toggle-status', 
  authenticateToken, 
  requireSuperAdminOrPermission('editar_paquetes'), 
  validateId, 
  validateToggleStatus, 
  paqueteController.togglePaqueteStatus
);

router.get('/search/term', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_paquetes'), 
  validateSearch, 
  paqueteController.searchPaquetes
);

module.exports = router;

