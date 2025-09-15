const express = require('express');
const router = express.Router();
const pesoController = require('./controller');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validatePeso = [
  body('cantidad')
    .isFloat({ min: 0.01 })
    .withMessage('La cantidad debe ser un número positivo mayor a 0.01'),
  
  body('unidad_medida')
    .isIn(['kg', 'g', 'lb', 'oz', 'ton'])
    .withMessage('La unidad de medida debe ser una de: kg, g, lb, oz, ton'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateUnidad = [
  param('unidad')
    .isIn(['kg', 'g', 'lb', 'oz', 'ton'])
    .withMessage('La unidad debe ser una de: kg, g, lb, oz, ton'),
  
  handleValidationErrors
];

const validateQuery = [
  query('unidad_medida')
    .optional()
    .isIn(['kg', 'g', 'lb', 'oz', 'ton'])
    .withMessage('La unidad de medida debe ser una de: kg, g, lb, oz, ton'),
  
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  query('search')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('La búsqueda debe ser un número positivo'),
  
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

const validateRange = [
  query('min')
    .isFloat({ min: 0.01 })
    .withMessage('El valor mínimo debe ser un número positivo'),
  
  query('max')
    .isFloat({ min: 0.01 })
    .withMessage('El valor máximo debe ser un número positivo'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información)
router.get('/unidades', pesoController.getUnidadesDisponibles);
router.get('/stats', pesoController.getPesoStats);
router.get('/active', pesoController.getActivePesos);

// Rutas protegidas - Solo administradores y moderadores pueden gestionar pesos
router.get('/', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateQuery, 
  pesoController.getAllPesos
);

router.get('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateId, 
  pesoController.getPesoById
);

router.post('/', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validatePeso, 
  pesoController.createPeso
);

router.put('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  validatePeso, 
  pesoController.updatePeso
);

router.delete('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  pesoController.deletePeso
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  pesoController.restorePeso
);

router.patch('/:id/activate', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  pesoController.activatePeso
);

router.patch('/:id/deactivate', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  pesoController.deactivatePeso
);

// Rutas para consultas específicas
router.get('/unidad/:unidad', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateUnidad, 
  pesoController.getPesosByUnidad
);

router.get('/range/min/:min/max/:max', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateRange, 
  pesoController.getPesosByRange
);

module.exports = router;
