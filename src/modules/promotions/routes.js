const express = require('express');
const router = express.Router();
const promotionController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Middleware de validación para crear promoción
const validateCreatePromotion = [
  body('nombre')
    .notEmpty()
    .withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  
  body('codigo')
    .notEmpty()
    .withMessage('El código es requerido')
    .isLength({ min: 3, max: 20 })
    .withMessage('El código debe tener entre 3 y 20 caracteres')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'),
  
  body('descripcion')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),
  
  body('tipo_promocion')
    .notEmpty()
    .withMessage('El tipo de promoción es requerido')
    .isIn(['porcentaje', 'monto_fijo', 'envio_gratis', 'descuento_especial'])
    .withMessage('Tipo de promoción no válido'),
  
  body('valor_descuento')
    .notEmpty()
    .withMessage('El valor del descuento es requerido')
    .isFloat({ min: 0 })
    .withMessage('El valor del descuento debe ser un número positivo'),
  
  body('fecha_inicio')
    .notEmpty()
    .withMessage('La fecha de inicio es requerida')
    .isISO8601()
    .withMessage('Formato de fecha inválido'),
  
  body('fecha_fin')
    .notEmpty()
    .withMessage('La fecha de fin es requerida')
    .isISO8601()
    .withMessage('Formato de fecha inválido')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.fecha_inicio)) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      return true;
    }),
  
  body('limite_uso')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El límite de uso debe ser un número entero positivo'),
  
  body('compra_minima')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('La compra mínima debe ser un número positivo'),
  
  body('descuento_maximo')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El descuento máximo debe ser un número positivo'),
  
  body('cities')
    .optional()
    .isArray()
    .withMessage('Las ciudades deben ser un array'),
  
  body('cities.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Cada ciudad debe ser un ID válido'),
  
  handleValidationErrors
];

// Middleware de validación para actualizar promoción
const validateUpdatePromotion = [
  body('nombre')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  
  body('codigo')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('El código debe tener entre 3 y 20 caracteres')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'),
  
  body('descripcion')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('La descripción no puede exceder 1000 caracteres'),
  
  body('tipo_promocion')
    .optional()
    .isIn(['porcentaje', 'monto_fijo', 'envio_gratis', 'descuento_especial'])
    .withMessage('Tipo de promoción no válido'),
  
  body('valor_descuento')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El valor del descuento debe ser un número positivo'),
  
  body('fecha_inicio')
    .optional()
    .isISO8601()
    .withMessage('Formato de fecha inválido'),
  
  body('fecha_fin')
    .optional()
    .isISO8601()
    .withMessage('Formato de fecha inválido'),
  
  body('limite_uso')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El límite de uso debe ser un número entero positivo'),
  
  body('compra_minima')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('La compra mínima debe ser un número positivo'),
  
  body('descuento_maximo')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El descuento máximo debe ser un número positivo'),
  
  body('cities')
    .optional()
    .isArray()
    .withMessage('Las ciudades deben ser un array'),
  
  body('cities.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Cada ciudad debe ser un ID válido'),
  
  handleValidationErrors
];

// Middleware de validación para parámetros
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID inválido'),
  handleValidationErrors
];

const validateCityId = [
  param('city_id')
    .isInt({ min: 1 })
    .withMessage('ID de ciudad inválido'),
  handleValidationErrors
];

const validateCode = [
  param('codigo')
    .notEmpty()
    .withMessage('Código requerido')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Código inválido'),
  handleValidationErrors
];

const validateValidarPromocion = [
  body('telefono')
    .notEmpty()
    .withMessage('El teléfono es requerido')
    .isString()
    .withMessage('El teléfono debe ser una cadena de texto')
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres'),
  
  body('codigo')
    .notEmpty()
    .withMessage('El código de promoción es requerido')
    .isString()
    .withMessage('El código debe ser una cadena de texto')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'),
  
  handleValidationErrors
];

const validateAplicarCodigo = [
  body('telefono')
    .notEmpty()
    .withMessage('El teléfono es requerido')
    .isString()
    .withMessage('El teléfono debe ser una cadena de texto')
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres'),
  
  body('logica_aplicar')
    .notEmpty()
    .withMessage('La lógica de aplicación es requerida')
    .isObject()
    .withMessage('La lógica de aplicación debe ser un objeto'),
  
  body('logica_aplicar.tipo_accion')
    .notEmpty()
    .withMessage('El tipo de acción es requerido')
    .isIn(['descuento_global', 'descuento_producto', 'segunda_unidad', 'producto_regalo'])
    .withMessage('El tipo de acción debe ser uno de: descuento_global, descuento_producto, segunda_unidad, producto_regalo'),
  
  body('logica_aplicar.valor')
    .notEmpty()
    .withMessage('El valor es requerido')
    .custom((value) => {
      const numValue = parseFloat(value);
      return !isNaN(numValue) && numValue >= 0;
    })
    .withMessage('El valor debe ser un número positivo'),
  
  body('logica_aplicar.unidad_valor')
    .notEmpty()
    .withMessage('La unidad de valor es requerida')
    .isIn(['porcentaje', 'monto'])
    .withMessage('La unidad de valor debe ser "porcentaje" o "monto"'),
  
  body('logica_aplicar.condiciones')
    .optional()
    .isObject()
    .withMessage('Las condiciones deben ser un objeto'),
  
  body('logica_aplicar.condiciones.monto_minimo_carrito')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined) return true;
      const numValue = parseFloat(value);
      return !isNaN(numValue) && numValue >= 0;
    })
    .withMessage('El monto mínimo del carrito debe ser un número positivo'),
  
  body('logica_aplicar.condiciones.producto_trigger_keywords')
    .optional()
    .isArray()
    .withMessage('Los keywords de trigger deben ser un array'),
  
  body('logica_aplicar.condiciones.producto_trigger_keywords.*')
    .optional()
    .isString()
    .withMessage('Cada keyword debe ser una cadena de texto'),
  
  body('logica_aplicar.condiciones.cantidad_trigger')
    .optional()
    .isInt({ min: 0 })
    .withMessage('La cantidad trigger debe ser un número entero positivo'),
  
  body('logica_aplicar.efecto')
    .optional()
    .isObject()
    .withMessage('El efecto debe ser un objeto'),
  
  body('logica_aplicar.efecto.producto_target_keywords')
    .optional()
    .isArray()
    .withMessage('Los keywords de target deben ser un array'),
  
  body('logica_aplicar.efecto.producto_target_keywords.*')
    .optional()
    .isString()
    .withMessage('Cada keyword debe ser una cadena de texto'),
  
  handleValidationErrors
];

// Rutas públicas
router.get('/types', promotionController.getPromotionTypes);
router.get('/active', promotionController.getActivePromotions);
router.get('/stats', promotionController.getPromotionStats);
router.get('/validate/:codigo', validateCode, promotionController.validatePromotionCode);
router.get('/city/:city_id', validateCityId, promotionController.getPromotionsByCity);

// Rutas protegidas (requieren autenticación)
router.use(authenticateToken);

// Ruta para validar promoción con datos de PostgreSQL
router.post('/validar', validateValidarPromocion, promotionController.validarPromocion);

// Ruta para aplicar código de promoción a productos en sesión
router.post('/aplicarCodigo', validateAplicarCodigo, promotionController.aplicarCodigo);

// Rutas de administración (requieren rol admin o super_admin)
router.get('/', promotionController.getAllPromotions);
router.get('/:id', validateId, promotionController.getPromotionById);
router.post('/', requireSuperAdminOrPermission('ver_promociones'), validateCreatePromotion, promotionController.createPromotion);
router.put('/:id', requireSuperAdminOrPermission('ver_promociones'), validateId, validateUpdatePromotion, promotionController.updatePromotion);
router.delete('/:id', requireSuperAdminOrPermission('ver_promociones'), validateId, promotionController.deletePromotion);
router.patch('/:id/restore', requireSuperAdminOrPermission('ver_promociones'), validateId, promotionController.restorePromotion);

module.exports = router;
