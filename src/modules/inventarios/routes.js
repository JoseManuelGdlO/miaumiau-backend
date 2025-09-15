const express = require('express');
const router = express.Router();
const inventarioController = require('./controller');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateInventario = [
  body('nombre')
    .isLength({ min: 2, max: 200 })
    .withMessage('El nombre debe tener entre 2 y 200 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s0-9\-_\.]+$/)
    .withMessage('El nombre solo puede contener letras, números, espacios, guiones, guiones bajos y puntos'),
  
  body('sku')
    .isLength({ min: 3, max: 50 })
    .withMessage('El SKU debe tener entre 3 y 50 caracteres')
    .matches(/^[A-Z0-9\-_]+$/)
    .withMessage('El SKU solo puede contener letras mayúsculas, números, guiones y guiones bajos'),
  
  body('fkid_peso')
    .isInt({ min: 1 })
    .withMessage('El ID del peso debe ser un número entero positivo'),
  
  body('fkid_categoria')
    .isInt({ min: 1 })
    .withMessage('El ID de la categoría debe ser un número entero positivo'),
  
  body('fkid_ciudad')
    .isInt({ min: 1 })
    .withMessage('El ID de la ciudad debe ser un número entero positivo'),
  
  body('descripcion')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),
  
  body('stock_inicial')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El stock inicial debe ser un número entero no negativo'),
  
  body('stock_minimo')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El stock mínimo debe ser un número entero no negativo'),
  
  body('stock_maximo')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El stock máximo debe ser un número entero positivo'),
  
  body('costo_unitario')
    .isFloat({ min: 0 })
    .withMessage('El costo unitario debe ser un número positivo'),
  
  body('precio_venta')
    .isFloat({ min: 0 })
    .withMessage('El precio de venta debe ser un número positivo'),
  
  body('fkid_proveedor')
    .isInt({ min: 1 })
    .withMessage('El ID del proveedor debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateStockUpdate = [
  body('stock_inicial')
    .isInt({ min: 0 })
    .withMessage('El stock inicial debe ser un número entero no negativo'),
  
  handleValidationErrors
];

const validateQuery = [
  query('categoria')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID de la categoría debe ser un número entero positivo'),
  
  query('ciudad')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID de la ciudad debe ser un número entero positivo'),
  
  query('proveedor')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del proveedor debe ser un número entero positivo'),
  
  query('peso')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del peso debe ser un número entero positivo'),
  
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  query('low_stock')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro low_stock debe ser true o false'),
  
  query('search')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('La búsqueda debe tener entre 2 y 100 caracteres'),
  
  query('min_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio mínimo debe ser un número positivo'),
  
  query('max_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio máximo debe ser un número positivo'),
  
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

const validateCategoryId = [
  param('categoriaId')
    .isInt({ min: 1 })
    .withMessage('El ID de la categoría debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateCityId = [
  param('ciudadId')
    .isInt({ min: 1 })
    .withMessage('El ID de la ciudad debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateProviderId = [
  param('proveedorId')
    .isInt({ min: 1 })
    .withMessage('El ID del proveedor debe ser un número entero positivo'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información)
router.get('/stats', inventarioController.getInventarioStats);
router.get('/low-stock', inventarioController.getLowStockInventarios);

// Rutas protegidas - Solo administradores y moderadores pueden gestionar inventarios
router.get('/', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateQuery, 
  inventarioController.getAllInventarios
);

router.get('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateId, 
  inventarioController.getInventarioById
);

router.post('/', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateInventario, 
  inventarioController.createInventario
);

router.put('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  validateInventario, 
  inventarioController.updateInventario
);

router.delete('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  inventarioController.deleteInventario
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  inventarioController.restoreInventario
);

router.patch('/:id/stock', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  validateStockUpdate, 
  inventarioController.updateStock
);

// Rutas para consultas específicas
router.get('/categoria/:categoriaId', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateCategoryId, 
  inventarioController.getInventariosByCategory
);

router.get('/ciudad/:ciudadId', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateCityId, 
  inventarioController.getInventariosByCity
);

router.get('/proveedor/:proveedorId', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateProviderId, 
  inventarioController.getInventariosByProvider
);

router.get('/search/term', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateSearch, 
  inventarioController.searchInventarios
);

module.exports = router;
