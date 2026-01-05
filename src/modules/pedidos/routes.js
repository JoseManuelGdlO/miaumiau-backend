const express = require('express');
const router = express.Router();
const pedidoController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validatePedido = [
  body('fkid_cliente')
    .isInt({ min: 1 })
    .withMessage('El ID del cliente debe ser un número entero positivo'),
  
  body('telefono_referencia')
    .optional()
    .isLength({ min: 7, max: 20 })
    .withMessage('El teléfono debe tener entre 7 y 20 caracteres')
    .matches(/^[\+]?[0-9\s\-\(\)]+$/)
    .withMessage('El teléfono solo puede contener números, espacios, guiones, paréntesis y +'),
  
  body('email_referencia')
    .optional()
    .isEmail()
    .withMessage('El email debe ser válido')
    .isLength({ min: 5, max: 255 })
    .withMessage('El email debe tener entre 5 y 255 caracteres'),
  
  body('direccion_entrega')
    .isLength({ min: 10, max: 500 })
    .withMessage('La dirección de entrega debe tener entre 10 y 500 caracteres')
    .notEmpty()
    .withMessage('La dirección de entrega no puede estar vacía'),
  
  body('fkid_ciudad')
    .isInt({ min: 1 })
    .withMessage('El ID de la ciudad debe ser un número entero positivo'),
  
  body('fecha_entrega_estimada')
    .optional()
    .isISO8601()
    .withMessage('La fecha de entrega estimada debe ser una fecha válida'),
  
  body('metodo_pago')
    .optional()
    .isIn(['efectivo', 'tarjeta', 'transferencia', 'pago_movil'])
    .withMessage('El método de pago debe ser: efectivo, tarjeta, transferencia o pago_movil'),
  
  body('notas')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Las notas no pueden exceder 1000 caracteres'),
  
  body('productos')
    .optional()
    .isArray()
    .withMessage('Los productos deben ser un array'),
  
  body('productos.*.fkid_producto')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del producto debe ser un número entero positivo'),
  
  body('productos.*.cantidad')
    .optional()
    .isInt({ min: 1, max: 9999 })
    .withMessage('La cantidad debe ser entre 1 y 9999'),
  
  body('productos.*.precio_unidad')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('El precio unitario debe ser mayor a 0.01'),
  
  body('productos.*.descuento_producto')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El descuento debe ser entre 0 y 100'),
  
  body('codigo_promocion')
    .optional({ nullable: true })
    .if((value) => value !== null && value !== undefined && value !== '')
    .isLength({ min: 3, max: 50 })
    .withMessage('El código de promoción debe tener entre 3 y 50 caracteres'),
  
  body('stripe_link_id')
    .optional({ nullable: true })
    .isLength({ max: 100 })
    .withMessage('El stripe_link_id no puede exceder 100 caracteres'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateQuery = [
  query('fkid_cliente')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del cliente debe ser un número entero positivo'),
  
  query('fkid_ciudad')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID de la ciudad debe ser un número entero positivo'),
  
  query('estado')
    .optional()
    .isIn(['pendiente', 'confirmado', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'])
    .withMessage('El estado debe ser: pendiente, confirmado, en_preparacion, en_camino, entregado o cancelado'),
  
  query('metodo_pago')
    .optional()
    .isIn(['efectivo', 'tarjeta', 'transferencia', 'pago_movil'])
    .withMessage('El método de pago debe ser: efectivo, tarjeta, transferencia o pago_movil'),
  
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  query('search')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('La búsqueda debe tener entre 2 y 50 caracteres'),
  
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('La fecha de inicio debe ser una fecha válida'),
  
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('La fecha de fin debe ser una fecha válida'),
  
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

const validateEstadoChange = [
  body('estado')
    .isIn(['pendiente', 'confirmado', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'])
    .withMessage('El estado debe ser: pendiente, confirmado, en_preparacion, en_camino, entregado o cancelado'),
  
  handleValidationErrors
];

const validateEstadoParam = [
  param('estado')
    .isIn(['pendiente', 'confirmado', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'])
    .withMessage('El estado debe ser: pendiente, confirmado, en_preparacion, en_camino, entregado o cancelado'),
  
  handleValidationErrors
];

const validateClientId = [
  param('clientId')
    .isInt({ min: 1 })
    .withMessage('El ID del cliente debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateCiudadId = [
  param('ciudadId')
    .isInt({ min: 1 })
    .withMessage('El ID de la ciudad debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateNumero = [
  param('numero')
    .isLength({ min: 5, max: 50 })
    .withMessage('El número de pedido debe tener entre 5 y 50 caracteres'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información)
router.get('/stats', pedidoController.getPedidoStats);
router.get('/recent', pedidoController.getRecentPedidos);
router.get('/pendientes', pedidoController.getPedidosPendientes);
router.get('/en-preparacion', pedidoController.getPedidosEnPreparacion);
router.get('/en-camino', pedidoController.getPedidosEnCamino);
router.get('/disponibilidad/:fecha_inicio', pedidoController.getDisponibilidadEntregas);

// Rutas protegidas - Solo administradores y moderadores pueden gestionar pedidos
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateQuery, 
  pedidoController.getAllPedidos
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateId, 
  pedidoController.getPedidoById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validatePedido, 
  pedidoController.createPedido
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateId, 
  validatePedido, 
  pedidoController.updatePedido
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateId, 
  pedidoController.deletePedido
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateId, 
  pedidoController.restorePedido
);

router.patch('/:id/estado', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateId, 
  validateEstadoChange, 
  pedidoController.changeEstado
);

router.patch('/:id/confirmar', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateId, 
  pedidoController.confirmarPedido
);

router.patch('/:id/entregar', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateId, 
  pedidoController.entregarPedido
);

router.patch('/:id/cancelar', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateId, 
  pedidoController.cancelarPedido
);

// Rutas para consultas específicas
router.get('/cliente/:clientId', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateClientId, 
  pedidoController.getPedidosByCliente
);

router.get('/estado/:estado', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateEstadoParam, 
  pedidoController.getPedidosByEstado
);

router.get('/ciudad/:ciudadId', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateCiudadId, 
  pedidoController.getPedidosByCiudad
);

router.get('/numero/:numero', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_pedidos'), 
  validateNumero, 
  pedidoController.searchPedidoByNumero
);

module.exports = router;
