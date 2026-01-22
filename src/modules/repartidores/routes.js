const express = require('express');
const router = express.Router();
const repartidorController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { authenticateRepartidor } = require('../../middleware/repartidorAuth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateRepartidor = [
  body('codigo_repartidor')
    .notEmpty()
    .withMessage('El código del repartidor es requerido')
    .isLength({ min: 3, max: 20 })
    .withMessage('El código debe tener entre 3 y 20 caracteres'),
  
  body('nombre_completo')
    .notEmpty()
    .withMessage('El nombre completo es requerido')
    .isLength({ min: 2, max: 150 })
    .withMessage('El nombre debe tener entre 2 y 150 caracteres'),
  
  body('telefono')
    .notEmpty()
    .withMessage('El teléfono es requerido')
    .isLength({ min: 10, max: 20 })
    .withMessage('El teléfono debe tener entre 10 y 20 caracteres'),
  
  body('email')
    .notEmpty()
    .withMessage('El email es requerido')
    .isEmail()
    .withMessage('El email debe ser válido')
    .isLength({ max: 100 })
    .withMessage('El email no puede exceder 100 caracteres'),
  
  body('fkid_ciudad')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID de ciudad debe ser válido'),
  
  body('direccion')
    .optional()
    .isLength({ min: 5, max: 255 })
    .withMessage('La dirección debe tener entre 5 y 255 caracteres'),
  
  body('fkid_usuario')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID de usuario debe ser válido'),
  
  body('tipo_vehiculo')
    .optional()
    .isIn(['moto', 'bicicleta', 'auto', 'camioneta', 'caminando'])
    .withMessage('Tipo de vehículo inválido'),
  
  body('capacidad_carga')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('La capacidad de carga debe ser un número positivo'),
  
  body('zona_cobertura')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined) {
        return true; // Permitir null/undefined
      }
      return typeof value === 'object' && !Array.isArray(value);
    })
    .withMessage('La zona de cobertura debe ser un objeto JSON válido o null'),
  
  body('horario_trabajo')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === null || value === undefined) {
        return true; // Permitir null/undefined
      }
      return typeof value === 'object' && !Array.isArray(value);
    })
    .withMessage('El horario de trabajo debe ser un objeto JSON válido o null'),
  
  body('tarifa_base')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('La tarifa base debe ser un número positivo'),
  
  body('comision_porcentaje')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('La comisión debe estar entre 0 y 100'),
  
  body('fecha_ingreso')
    .optional()
    .isDate()
    .withMessage('La fecha de ingreso debe ser válida'),
  
  body('fecha_nacimiento')
    .optional()
    .isDate()
    .withMessage('La fecha de nacimiento debe ser válida'),
  
  body('contrasena')
    .optional()
    .isLength({ min: 6, max: 255 })
    .withMessage('La contraseña debe tener entre 6 y 255 caracteres'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID inválido'),
  
  handleValidationErrors
];

const validateQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero mayor a 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser un número entre 1 y 100'),
  
  query('estado')
    .optional()
    .isIn(['activo', 'inactivo', 'ocupado', 'disponible', 'en_ruta'])
    .withMessage('Estado inválido'),
  
  query('tipo_vehiculo')
    .optional()
    .isIn(['moto', 'bicicleta', 'auto', 'camioneta', 'caminando'])
    .withMessage('Tipo de vehículo inválido'),
  
  handleValidationErrors
];

const validateEstado = [
  body('estado')
    .isIn(['activo', 'inactivo', 'ocupado', 'disponible', 'en_ruta'])
    .withMessage('Estado inválido'),
  
  handleValidationErrors
];

const validateMetricas = [
  body('entregas')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Las entregas deben ser un número entero positivo'),
  
  body('km')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Los kilómetros deben ser un número positivo'),
  
  body('calificacion')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('La calificación debe estar entre 0 y 5'),
  
  handleValidationErrors
];

// Validaciones para query parameters
const validateQueryParams = [
  query('ciudad')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID de ciudad debe ser un número válido'),
  
  handleValidationErrors
];

// Validaciones para login de repartidor
const validateRepartidorLogin = [
  body('contrasena')
    .notEmpty()
    .withMessage('La contraseña es requerida'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('El email debe ser válido'),
  
  body('codigo_repartidor')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('El código de repartidor debe tener entre 3 y 20 caracteres'),
  
  body()
    .custom((value) => {
      if (!value.email && !value.codigo_repartidor) {
        throw new Error('Debes proporcionar email o código de repartidor');
      }
      return true;
    })
    .withMessage('Debes proporcionar email o código de repartidor'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información básica)
// IMPORTANTE: La ruta /login debe estar ANTES de cualquier ruta con parámetros como /:id
router.post('/login', validateRepartidorLogin, repartidorController.loginRepartidor);
router.get('/disponibles', validateQueryParams, repartidorController.getRepartidoresDisponibles);
router.get('/estadisticas', repartidorController.getEstadisticas);
router.get('/estadisticas/ciudad', repartidorController.getEstadisticasPorCiudad);
router.get('/mejores-calificados', repartidorController.getMejoresCalificados);

// Rutas protegidas - Super admin o usuarios con permisos específicos
router.get('/',
  authenticateToken,
  requireSuperAdminOrPermission('ver_repartidores'),
  validateQuery,
  repartidorController.getAllRepartidores
);

router.get('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('ver_repartidores'),
  validateId,
  repartidorController.getRepartidorById
);

router.post('/',
  authenticateToken,
  requireSuperAdminOrPermission('crear_repartidores'),
  validateRepartidor,
  repartidorController.createRepartidor
);

router.put('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('editar_repartidores'),
  validateId,
  validateRepartidor,
  repartidorController.updateRepartidor
);

router.delete('/:id',
  authenticateToken,
  requireSuperAdminOrPermission('eliminar_repartidores'),
  validateId,
  repartidorController.deleteRepartidor
);

router.patch('/:id/restore',
  authenticateToken,
  requireSuperAdminOrPermission('editar_repartidores'),
  validateId,
  repartidorController.restoreRepartidor
);

router.patch('/:id/estado',
  authenticateToken,
  requireSuperAdminOrPermission('activar_desactivar_repartidores'),
  validateId,
  validateEstado,
  repartidorController.changeEstado
);

router.get('/ciudad/:ciudadId',
  authenticateToken,
  requireSuperAdminOrPermission('ver_repartidores'),
  repartidorController.getRepartidoresByCiudad
);

router.get('/tipo-vehiculo/:tipo',
  authenticateToken,
  requireSuperAdminOrPermission('ver_repartidores'),
  repartidorController.getRepartidoresByTipoVehiculo
);

router.patch('/:id/metricas',
  authenticateToken,
  requireSuperAdminOrPermission('editar_repartidores'),
  validateId,
  validateMetricas,
  repartidorController.updateMetricas
);

router.get('/:id/horario-trabajo',
  authenticateToken,
  requireSuperAdminOrPermission('ver_repartidores'),
  validateId,
  repartidorController.checkHorarioTrabajo
);

// Rutas para repartidores autenticados
// Esta ruta puede ser usada por repartidores autenticados o por admins que envíen el ID
router.get('/mis-pedidos/del-dia',
  authenticateRepartidor,
  [
    query('repartidor_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('El ID de repartidor debe ser un número válido'),
    handleValidationErrors
  ],
  repartidorController.getPedidosDelDia
);

// Ruta alternativa para obtener pedidos del día de un repartidor específico (para admins)
router.get('/pedidos/del-dia',
  authenticateToken,
  requireSuperAdminOrPermission('ver_pedidos'),
  [
    query('repartidor_id')
      .isInt({ min: 1 })
      .withMessage('El ID de repartidor es requerido y debe ser un número válido'),
    handleValidationErrors
  ],
  repartidorController.getPedidosDelDia
);

router.patch('/pedidos/:id/estado',
  authenticateRepartidor,
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('ID de pedido inválido'),
    body('estado')
      .isIn(['pendiente', 'en_camino', 'en_ubicacion', 'entregado', 'no_entregado'])
      .withMessage('Estado inválido'),
    body('notas')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Las notas no pueden exceder 500 caracteres'),
    handleValidationErrors
  ],
  repartidorController.updateEstadoPedido
);

module.exports = router;
