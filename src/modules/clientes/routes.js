const express = require('express');
const router = express.Router();
const clienteController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
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
  // Aceptar correo_electronico o email
  body(['correo_electronico', 'email'])
    .custom((value, { req }) => {
      const email = req.body.correo_electronico ?? req.body.email;
      return typeof email === 'string' && email.length > 0;
    })
    .withMessage('El correo electrónico es requerido')
    .bail()
    .custom((value, { req }) => {
      const email = req.body.correo_electronico ?? req.body.email;
      // Validación simple de email
      return /.+@.+\..+/.test(email);
    })
    .withMessage('El correo electrónico debe ser válido')
    .bail()
    .custom((value, { req }) => {
      const email = req.body.correo_electronico ?? req.body.email;
      return typeof email === 'string' && email.length <= 100;
    })
    .withMessage('El correo no puede exceder 100 caracteres'),
  // Aceptar ciudad_id o fkid_ciudad
  body(['ciudad_id', 'fkid_ciudad'])
    .custom((value, { req }) => {
      const ciudadId = req.body.ciudad_id ?? req.body.fkid_ciudad;
      return Number.isInteger(ciudadId) ? ciudadId >= 1 : Number.isInteger(parseInt(ciudadId));
    })
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
  // Permitir cambiar correo_electronico o email
  body(['correo_electronico', 'email'])
    .optional()
    .custom((value, { req }) => {
      const email = req.body.correo_electronico ?? req.body.email;
      if (email === undefined) return true;
      return /.+@.+\..+/.test(email);
    })
    .withMessage('El correo electrónico debe ser válido')
    .bail()
    .custom((value, { req }) => {
      const email = req.body.correo_electronico ?? req.body.email;
      if (email === undefined) return true;
      return typeof email === 'string' && email.length <= 100;
    })
    .withMessage('El correo no puede exceder 100 caracteres'),
  // Permitir cambiar ciudad_id o fkid_ciudad
  body(['ciudad_id', 'fkid_ciudad'])
    .optional()
    .custom((value, { req }) => {
      const ciudadId = req.body.ciudad_id ?? req.body.fkid_ciudad;
      if (ciudadId === undefined) return true;
      const n = parseInt(ciudadId);
      return Number.isInteger(n) && n >= 1;
    })
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
  // Permitir filtrar por ciudad_id o fkid_ciudad
  query(['ciudad_id', 'fkid_ciudad']).optional().custom((value, { req }) => {
    const ciudadId = req.query.ciudad_id ?? req.query.fkid_ciudad;
    if (ciudadId === undefined) return true;
    const n = parseInt(ciudadId);
    return Number.isInteger(n) && n >= 1;
  }).withMessage('ID de ciudad inválido'),
  query('search').optional().isLength({ max: 100 }).withMessage('Búsqueda no puede exceder 100 caracteres')
];

// Rutas principales
router.get('/', 
  requireSuperAdminOrPermission('ver_clientes'),
  queryValidation,
  validateRequest,
  clienteController.getAllClientes
);

router.get('/stats',
  requireSuperAdminOrPermission('ver_clientes'),
  clienteController.getClienteStats
);

router.get('/active',
  requireSuperAdminOrPermission('ver_clientes'),
  clienteController.getActiveClientes
);

router.get('/:id',
  requireSuperAdminOrPermission('ver_clientes'),
  idValidation,
  validateRequest,
  clienteController.getClienteById
);

router.post('/',
  requireSuperAdminOrPermission('ver_clientes'),
  createClienteValidation,
  validateRequest,
  clienteController.createCliente
);

router.put('/:id',
  requireSuperAdminOrPermission('ver_clientes'),
  updateClienteValidation,
  validateRequest,
  clienteController.updateCliente
);

router.patch('/:id/restore',
  requireSuperAdminOrPermission('ver_clientes'),
  idValidation,
  validateRequest,
  clienteController.restoreCliente
);

router.delete('/:id',
  requireSuperAdminOrPermission('ver_clientes'),
  idValidation,
  validateRequest,
  clienteController.deleteCliente
);

module.exports = router;
