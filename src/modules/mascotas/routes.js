const express = require('express');
const router = express.Router();
const mascotaController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Middleware de validación para crear mascota
const validateCreateMascota = [
  body('nombre')
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ min: 1, max: 50 })
    .withMessage('El nombre debe tener entre 1 y 50 caracteres'),
  
  body('edad')
    .optional()
    .isInt({ min: 0, max: 30 })
    .withMessage('La edad debe ser un número entre 0 y 30'),
  
  body('genero')
    .optional()
    .isIn(['macho', 'hembra'])
    .withMessage('El género debe ser "macho" o "hembra"'),
  
  body('raza')
    .optional()
    .isLength({ max: 50 })
    .withMessage('La raza no puede exceder 50 caracteres'),
  
  body('producto_preferido')
    .optional()
    .isLength({ max: 100 })
    .withMessage('El producto preferido no puede exceder 100 caracteres'),
  
  body('notas_especiales')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Las notas especiales no pueden exceder 1000 caracteres'),
  
  body('fkid_cliente')
    .notEmpty()
    .withMessage('El ID del cliente es requerido')
    .isInt({ min: 1 })
    .withMessage('El ID del cliente debe ser un número entero positivo'),
  
  handleValidationErrors
];

// Middleware de validación para actualizar mascota
const validateUpdateMascota = [
  body('nombre')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('El nombre debe tener entre 1 y 50 caracteres'),
  
  body('edad')
    .optional()
    .isInt({ min: 0, max: 30 })
    .withMessage('La edad debe ser un número entre 0 y 30'),
  
  body('genero')
    .optional()
    .isIn(['macho', 'hembra'])
    .withMessage('El género debe ser "macho" o "hembra"'),
  
  body('raza')
    .optional()
    .isLength({ max: 50 })
    .withMessage('La raza no puede exceder 50 caracteres'),
  
  body('producto_preferido')
    .optional()
    .isLength({ max: 100 })
    .withMessage('El producto preferido no puede exceder 100 caracteres'),
  
  body('notas_especiales')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Las notas especiales no pueden exceder 1000 caracteres'),
  
  body('fkid_cliente')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del cliente debe ser un número entero positivo'),
  
  handleValidationErrors
];

// Middleware de validación para parámetros
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID inválido'),
  handleValidationErrors
];

const validateClienteId = [
  param('cliente_id')
    .isInt({ min: 1 })
    .withMessage('ID de cliente inválido'),
  handleValidationErrors
];

// Rutas públicas
router.get('/stats', mascotaController.getMascotaStats);
router.get('/active', mascotaController.getActiveMascotas);
router.get('/cliente/:cliente_id', validateClienteId, mascotaController.getMascotasByCliente);

// Rutas protegidas (requieren autenticación)
router.use(authenticateToken);

// Rutas de administración (requieren rol admin o super_admin)
router.get('/', mascotaController.getAllMascotas);
router.get('/:id', validateId, mascotaController.getMascotaById);
router.post('/', requireSuperAdminOrPermission('ver_mascotas'), validateCreateMascota, mascotaController.createMascota);
router.put('/:id', requireSuperAdminOrPermission('ver_mascotas'), validateId, validateUpdateMascota, mascotaController.updateMascota);
router.delete('/:id', requireSuperAdminOrPermission('ver_mascotas'), validateId, mascotaController.deleteMascota);
router.patch('/:id/restore', requireSuperAdminOrPermission('ver_mascotas'), validateId, mascotaController.restoreMascota);

module.exports = router;
