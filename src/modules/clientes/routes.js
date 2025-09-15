const express = require('express');
const router = express.Router();
const clienteController = require('./controller');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');

// Middleware de validación
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errors.array()
    });
  }
  next();
};

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

// Validaciones
const createClienteValidation = [
  body('nombre_completo')
    .notEmpty()
    .withMessage('El nombre completo es requerido')
    .isLength({ min: 2, max: 150 })
    .withMessage('El nombre debe tener entre 2 y 150 caracteres'),
  body('correo_electronico')
    .isEmail()
    .withMessage('El correo electrónico debe ser válido')
    .isLength({ max: 100 })
    .withMessage('El correo no puede exceder 100 caracteres'),
  body('ciudad_id')
    .isInt({ min: 1 })
    .withMessage('La ciudad es requerida'),
  body('contrasena')
    .optional()
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
];

const updateClienteValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID de cliente inválido'),
  body('nombre_completo')
    .optional()
    .isLength({ min: 2, max: 150 })
    .withMessage('El nombre debe tener entre 2 y 150 caracteres'),
  body('correo_electronico')
    .optional()
    .isEmail()
    .withMessage('El correo electrónico debe ser válido')
    .isLength({ max: 100 })
    .withMessage('El correo no puede exceder 100 caracteres'),
  body('ciudad_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La ciudad debe ser válida'),
  body('contrasena')
    .optional()
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
];

const idValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID de cliente inválido')
];

const queryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe estar entre 1 y 100'),
  query('activos').optional().isIn(['true', 'false']).withMessage('Activos debe ser true o false'),
  query('ciudad_id').optional().isInt({ min: 1 }).withMessage('ID de ciudad inválido'),
  query('search').optional().isLength({ max: 100 }).withMessage('Búsqueda no puede exceder 100 caracteres')
];

// Rutas principales
router.get('/', 
  requireRole(['admin', 'super_admin', 'agente']),
  queryValidation,
  validateRequest,
  clienteController.getAllClientes
);

router.get('/stats',
  requireRole(['admin', 'super_admin']),
  clienteController.getClienteStats
);

router.get('/active',
  requireRole(['admin', 'super_admin', 'agente']),
  clienteController.getActiveClientes
);

router.get('/:id',
  requireRole(['admin', 'super_admin', 'agente']),
  idValidation,
  validateRequest,
  clienteController.getClienteById
);

router.post('/',
  requireRole(['admin', 'super_admin']),
  createClienteValidation,
  validateRequest,
  clienteController.createCliente
);

router.put('/:id',
  requireRole(['admin', 'super_admin']),
  updateClienteValidation,
  validateRequest,
  clienteController.updateCliente
);

router.patch('/:id/restore',
  requireRole(['admin', 'super_admin']),
  idValidation,
  validateRequest,
  clienteController.restoreCliente
);

router.delete('/:id',
  requireRole(['admin', 'super_admin']),
  idValidation,
  validateRequest,
  clienteController.deleteCliente
);

module.exports = router;
