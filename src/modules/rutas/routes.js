const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, requireSuperAdminOrPermission } = require('../../middleware/permissions');
const rutaController = require('./controller');

const router = express.Router();

// Middleware de validación
const handleValidationErrors = (req, res, next) => {
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

// Validaciones para crear ruta
const createRutaValidation = [
  body('nombre_ruta')
    .notEmpty()
    .withMessage('El nombre de la ruta es requerido')
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  
  body('fecha_ruta')
    .notEmpty()
    .withMessage('La fecha de la ruta es requerida')
    .isISO8601()
    .withMessage('La fecha debe tener formato válido (YYYY-MM-DD)'),
  
  body('fkid_ciudad')
    .notEmpty()
    .withMessage('La ciudad es requerida')
    .isInt({ min: 1 })
    .withMessage('La ciudad debe ser un ID válido'),
  
  body('fkid_repartidor')
    .notEmpty()
    .withMessage('El repartidor es requerido')
    .isInt({ min: 1 })
    .withMessage('El repartidor debe ser un ID válido'),
  
  body('estado')
    .optional()
    .isIn(['planificada', 'en_progreso', 'completada', 'cancelada'])
    .withMessage('El estado debe ser: planificada, en_progreso, completada o cancelada'),
  
  body('notas')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder 500 caracteres')
];

// Validaciones para actualizar ruta
const updateRutaValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID de la ruta debe ser un número válido'),
  
  body('nombre_ruta')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  
  body('fecha_ruta')
    .optional()
    .isISO8601()
    .withMessage('La fecha debe tener formato válido (YYYY-MM-DD)'),
  
  body('fkid_ciudad')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La ciudad debe ser un ID válido'),
  
  body('fkid_repartidor')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El repartidor debe ser un ID válido'),
  
  body('estado')
    .optional()
    .isIn(['planificada', 'en_progreso', 'completada', 'cancelada'])
    .withMessage('El estado debe ser: planificada, en_progreso, completada o cancelada'),
  
  body('notas')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder 500 caracteres'),
  
  body('total_pedidos')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El total de pedidos debe ser un número entero positivo'),
  
  body('total_entregados')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El total de entregados debe ser un número entero positivo'),
  
  body('distancia_estimada')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('La distancia estimada debe ser un número positivo'),
  
  body('tiempo_estimado')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El tiempo estimado debe ser un número entero positivo')
];

// Validaciones para asignar pedidos
const asignarPedidosValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID de la ruta debe ser un número válido'),
  
  body('pedidos')
    .isArray({ min: 1 })
    .withMessage('Debe proporcionar al menos un pedido'),
  
  body('pedidos.*.fkid_pedido')
    .isInt({ min: 1 })
    .withMessage('El ID del pedido debe ser un número válido'),
  
  body('pedidos.*.orden_entrega')
    .isInt({ min: 1 })
    .withMessage('El orden de entrega debe ser un número entero positivo'),
  
  body('pedidos.*.lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('La latitud debe estar entre -90 y 90'),
  
  body('pedidos.*.lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('La longitud debe estar entre -180 y 180'),
  
  body('pedidos.*.link_ubicacion')
    .optional()
    .isURL()
    .withMessage('El link de ubicación debe ser una URL válida'),
  
  body('pedidos.*.notas_entrega')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Las notas de entrega no pueden exceder 500 caracteres')
];

// Validaciones para cambiar estado
const cambiarEstadoValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID de la ruta debe ser un número válido'),
  
  body('estado')
    .notEmpty()
    .withMessage('El estado es requerido')
    .isIn(['planificada', 'en_progreso', 'completada', 'cancelada'])
    .withMessage('El estado debe ser: planificada, en_progreso, completada o cancelada')
];

// Validaciones para parámetros de ID
const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número válido')
];

// Validaciones para desasignar pedido
const desasignarPedidoValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID de la ruta debe ser un número válido'),
  
  param('pedidoId')
    .isInt({ min: 1 })
    .withMessage('El ID del pedido debe ser un número válido')
];

// Validaciones para fecha
const fechaValidation = [
  param('fecha')
    .isISO8601()
    .withMessage('La fecha debe tener formato válido (YYYY-MM-DD)')
];

// Validaciones para query parameters
const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero positivo'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser un número entre 1 y 100'),
  
  query('estado')
    .optional()
    .isIn(['planificada', 'en_progreso', 'completada', 'cancelada'])
    .withMessage('El estado debe ser: planificada, en_progreso, completada o cancelada'),
  
  query('fecha_ruta')
    .optional()
    .isISO8601()
    .withMessage('La fecha debe tener formato válido (YYYY-MM-DD)'),
  
  query('fkid_ciudad')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La ciudad debe ser un ID válido'),
  
  query('fkid_repartidor')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El repartidor debe ser un ID válido'),
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('La búsqueda debe tener entre 1 y 100 caracteres')
];

// ==================== RUTAS ====================

// Crear nueva ruta
router.post('/',
  authenticateToken,
  requireSuperAdminOrPermission('crear_rutas'),
  createRutaValidation,
  handleValidationErrors,
  rutaController.createRuta
);

// Obtener todas las rutas con filtros
router.get('/',
  authenticateToken,
  requireSuperAdminOrPermission('ver_rutas'),
  queryValidation,
  handleValidationErrors,
  rutaController.getAllRutas
);

// Obtener rutas por fecha específica
router.get('/fecha/:fecha',
  authenticateToken,
  requireSuperAdminOrPermission('ver_rutas'),
  fechaValidation,
  handleValidationErrors,
  rutaController.getRutasByDate
);

// Obtener pedidos sin asignar por fecha
router.get('/pedidos-sin-asignar/:fecha',
  authenticateToken,
  requireSuperAdminOrPermission('ver_rutas'),
  fechaValidation,
  handleValidationErrors,
  rutaController.getPedidosSinAsignar
);

// Obtener ruta por ID
router.get('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('ver_rutas'),
  idValidation,
  handleValidationErrors,
  rutaController.getRutaById
);

// Actualizar ruta
router.put('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('editar_rutas'),
  updateRutaValidation,
  handleValidationErrors,
  rutaController.updateRuta
);

// Asignar pedidos a una ruta
router.post('/:id/pedidos',
  authenticateToken,
  requireSuperAdminOrPermission('editar_rutas'),
  asignarPedidosValidation,
  handleValidationErrors,
  rutaController.asignarPedidos
);

// Desasignar un pedido específico de una ruta
router.delete('/:id/pedidos/:pedidoId',
  authenticateToken,
  requireSuperAdminOrPermission('editar_rutas'),
  desasignarPedidoValidation,
  handleValidationErrors,
  rutaController.desasignarPedido
);

// Desasignar repartidor de una ruta
router.delete('/:id/repartidor',
  authenticateToken,
  requireSuperAdminOrPermission('editar_rutas'),
  idValidation,
  handleValidationErrors,
  rutaController.desasignarRepartidor
);

// Cambiar estado de la ruta
router.patch('/:id/estado',
  authenticateToken,
  requireSuperAdminOrPermission('editar_rutas'),
  cambiarEstadoValidation,
  handleValidationErrors,
  rutaController.cambiarEstado
);

// Eliminar ruta (soft delete)
router.delete('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('eliminar_rutas'),
  idValidation,
  handleValidationErrors,
  rutaController.deleteRuta
);

// Restaurar ruta
router.patch('/:id/restore',
  authenticateToken,
  requireSuperAdminOrPermission('editar_rutas'),
  idValidation,
  handleValidationErrors,
  rutaController.restoreRuta
);

// Obtener estadísticas de rutas
router.get('/estadisticas/general',
  authenticateToken,
  requireSuperAdminOrPermission('ver_estadisticas_rutas'),
  rutaController.getEstadisticas
);

module.exports = router;
