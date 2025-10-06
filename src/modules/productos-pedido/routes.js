const express = require('express');
const router = express.Router();
const productoPedidoController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateProductoPedido = [
  body('fkid_pedido')
    .isInt({ min: 1 })
    .withMessage('El ID del pedido debe ser un número entero positivo'),
  
  body('fkid_producto')
    .isInt({ min: 1 })
    .withMessage('El ID del producto debe ser un número entero positivo'),
  
  body('cantidad')
    .isInt({ min: 1, max: 9999 })
    .withMessage('La cantidad debe ser entre 1 y 9999'),
  
  body('precio_unidad')
    .isFloat({ min: 0.01 })
    .withMessage('El precio unitario debe ser mayor a 0.01'),
  
  body('descuento_producto')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El descuento debe ser entre 0 y 100'),
  
  body('notas_producto')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Las notas del producto no pueden exceder 500 caracteres'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateQuery = [
  query('fkid_pedido')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del pedido debe ser un número entero positivo'),
  
  query('fkid_producto')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID del producto debe ser un número entero positivo'),
  
  query('cantidad')
    .optional()
    .isInt({ min: 1, max: 9999 })
    .withMessage('La cantidad debe ser entre 1 y 9999'),
  
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  query('precio_min')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio mínimo debe ser mayor o igual a 0'),
  
  query('precio_max')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El precio máximo debe ser mayor o igual a 0'),
  
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

const validateCantidad = [
  body('cantidad')
    .isInt({ min: 1, max: 9999 })
    .withMessage('La cantidad debe ser entre 1 y 9999'),
  
  handleValidationErrors
];

const validateDescuento = [
  body('descuento_producto')
    .isFloat({ min: 0, max: 100 })
    .withMessage('El descuento debe ser entre 0 y 100'),
  
  handleValidationErrors
];

const validatePedidoId = [
  param('pedidoId')
    .isInt({ min: 1 })
    .withMessage('El ID del pedido debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateProductoId = [
  param('productoId')
    .isInt({ min: 1 })
    .withMessage('El ID del producto debe ser un número entero positivo'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información)
router.get('/stats', productoPedidoController.getProductoPedidoStats);
router.get('/recent', productoPedidoController.getRecentProductosPedido);
router.get('/mas-vendidos', productoPedidoController.getProductosMasVendidos);
router.get('/con-descuento', productoPedidoController.getProductosConDescuento);

// Rutas protegidas - Solo administradores y moderadores pueden gestionar productos de pedido
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_productos_pedido'), 
  validateQuery, 
  productoPedidoController.getAllProductosPedido
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_productos_pedido'), 
  validateId, 
  productoPedidoController.getProductoPedidoById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_productos_pedido'), 
  validateProductoPedido, 
  productoPedidoController.createProductoPedido
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_productos_pedido'), 
  validateId, 
  validateProductoPedido, 
  productoPedidoController.updateProductoPedido
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_productos_pedido'), 
  validateId, 
  productoPedidoController.deleteProductoPedido
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_productos_pedido'), 
  validateId, 
  productoPedidoController.restoreProductoPedido
);

router.patch('/:id/cantidad', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_productos_pedido'), 
  validateId, 
  validateCantidad, 
  productoPedidoController.updateCantidad
);

router.patch('/:id/descuento', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_productos_pedido'), 
  validateId, 
  validateDescuento, 
  productoPedidoController.aplicarDescuento
);

// Rutas para consultas específicas
router.get('/pedido/:pedidoId', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_productos_pedido'), 
  validatePedidoId, 
  productoPedidoController.getProductosByPedido
);

router.get('/producto/:productoId', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_productos_pedido'), 
  validateProductoId, 
  productoPedidoController.getProductosByProducto
);

module.exports = router;
