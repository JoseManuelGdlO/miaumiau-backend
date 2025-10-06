const express = require('express');
const router = express.Router();
const repartidorController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
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
    .optional()
    .isEmail()
    .withMessage('El email debe ser válido')
    .isLength({ max: 100 })
    .withMessage('El email no puede exceder 100 caracteres'),
  
  body('fkid_ciudad')
    .isInt({ min: 1 })
    .withMessage('La ciudad es requerida'),
  
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
    .optional()
    .isObject()
    .withMessage('La zona de cobertura debe ser un objeto JSON válido'),
  
  body('horario_trabajo')
    .optional()
    .isObject()
    .withMessage('El horario de trabajo debe ser un objeto JSON válido'),
  
  body('tarifa_base')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('La tarifa base debe ser un número positivo'),
  
  body('comision_porcentaje')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('La comisión debe estar entre 0 y 100'),
  
  body('fecha_ingreso')
    .isDate()
    .withMessage('La fecha de ingreso debe ser válida'),
  
  body('fecha_nacimiento')
    .optional()
    .isDate()
    .withMessage('La fecha de nacimiento debe ser válida'),
  
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

// Rutas públicas (solo para obtener información básica)
router.get('/disponibles', repartidorController.getRepartidoresDisponibles);
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

module.exports = router;
