const express = require('express');
const router = express.Router();
const categoriaProductoController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateCategoria = [
  body('nombre')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s0-9\-_]+$/)
    .withMessage('El nombre solo puede contener letras, números, espacios, guiones y guiones bajos'),
  
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
router.get('/stats', categoriaProductoController.getCategoriaStats);
router.get('/active', categoriaProductoController.getActiveCategorias);

// Rutas protegidas - Solo administradores y moderadores pueden gestionar categorías
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_categorias_producto'), 
  validateQuery, 
  categoriaProductoController.getAllCategorias
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_categorias_producto'), 
  validateId, 
  categoriaProductoController.getCategoriaById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_categorias_producto'), 
  validateCategoria, 
  categoriaProductoController.createCategoria
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_categorias_producto'), 
  validateId, 
  validateCategoria, 
  categoriaProductoController.updateCategoria
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_categorias_producto'), 
  validateId, 
  categoriaProductoController.deleteCategoria
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_categorias_producto'), 
  validateId, 
  categoriaProductoController.restoreCategoria
);

router.patch('/:id/activate', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_categorias_producto'), 
  validateId, 
  categoriaProductoController.activateCategoria
);

router.patch('/:id/deactivate', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_categorias_producto'), 
  validateId, 
  categoriaProductoController.deactivateCategoria
);

// Rutas para consultas específicas
router.get('/search/term', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_categorias_producto'), 
  validateSearch, 
  categoriaProductoController.searchCategorias
);

module.exports = router;
