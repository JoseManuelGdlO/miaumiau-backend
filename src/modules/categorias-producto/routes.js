const express = require('express');
const router = express.Router();
const categoriaProductoController = require('./controller');
const { authenticateToken, requireRole } = require('../../middleware/auth');
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
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateQuery, 
  categoriaProductoController.getAllCategorias
);

router.get('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateId, 
  categoriaProductoController.getCategoriaById
);

router.post('/', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateCategoria, 
  categoriaProductoController.createCategoria
);

router.put('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  validateCategoria, 
  categoriaProductoController.updateCategoria
);

router.delete('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  categoriaProductoController.deleteCategoria
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  categoriaProductoController.restoreCategoria
);

router.patch('/:id/activate', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  categoriaProductoController.activateCategoria
);

router.patch('/:id/deactivate', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  categoriaProductoController.deactivateCategoria
);

// Rutas para consultas específicas
router.get('/search/term', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateSearch, 
  categoriaProductoController.searchCategorias
);

module.exports = router;
