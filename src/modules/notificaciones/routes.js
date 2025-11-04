const express = require('express');
const router = express.Router();
const notificacionController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateNotificacion = [
  body('nombre')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('El nombre debe tener entre 1 y 255 caracteres')
    .notEmpty()
    .withMessage('El nombre es obligatorio'),
  
  body('descripcion')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('La descripción no puede exceder 5000 caracteres'),
  
  body('prioridad')
    .optional()
    .isIn(['baja', 'media', 'alta', 'urgente'])
    .withMessage('La prioridad debe ser: baja, media, alta o urgente'),
  
  body('leida')
    .optional()
    .isBoolean()
    .withMessage('El campo leida debe ser un booleano'),
  
  body('datos')
    .optional()
    .custom((value) => {
      try {
        if (typeof value === 'string') {
          JSON.parse(value);
        } else if (typeof value !== 'object' && value !== null) {
          throw new Error('Los datos deben ser un objeto JSON válido');
        }
        return true;
      } catch (error) {
        throw new Error('Los datos deben ser un objeto JSON válido');
      }
    }),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validatePrioridad = [
  param('prioridad')
    .isIn(['baja', 'media', 'alta', 'urgente'])
    .withMessage('La prioridad debe ser: baja, media, alta o urgente'),
  
  handleValidationErrors
];

const validateFecha = [
  param('fecha')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('La fecha debe tener el formato YYYY-MM-DD'),
  
  handleValidationErrors
];

const validateQuery = [
  query('prioridad')
    .optional()
    .isIn(['baja', 'media', 'alta', 'urgente'])
    .withMessage('La prioridad debe ser: baja, media, alta o urgente'),
  
  query('leida')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro leida debe ser true o false'),
  
  query('fecha_inicio')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('La fecha de inicio debe tener el formato YYYY-MM-DD'),
  
  query('fecha_fin')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('La fecha de fin debe tener el formato YYYY-MM-DD'),
  
  query('search')
    .optional()
    .isLength({ min: 2, max: 255 })
    .withMessage('La búsqueda debe tener entre 2 y 255 caracteres'),
  
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

// Rutas públicas (estadísticas y recientes)
router.get('/stats', notificacionController.getStats);
router.get('/recent', notificacionController.getNotificacionesRecientes);
router.get('/actividad-reciente', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_notificaciones'), 
  notificacionController.getActividadReciente
);

// Rutas protegidas - CRUD completo
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_notificaciones'), 
  validateQuery, 
  notificacionController.getAllNotificaciones
);

router.get('/leidas', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_notificaciones'), 
  notificacionController.getNotificacionesLeidas
);

router.get('/no-leidas', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_notificaciones'), 
  notificacionController.getNotificacionesNoLeidas
);

router.get('/urgentes', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_notificaciones'), 
  notificacionController.getNotificacionesUrgentes
);

router.get('/prioridad/:prioridad', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_notificaciones'), 
  validatePrioridad, 
  notificacionController.getNotificacionesByPrioridad
);

router.get('/fecha/:fecha', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_notificaciones'), 
  validateFecha, 
  notificacionController.getNotificacionesByFecha
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_notificaciones'), 
  validateId, 
  notificacionController.getNotificacionById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('crear_notificaciones'), 
  validateNotificacion, 
  notificacionController.createNotificacion
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('editar_notificaciones'), 
  validateId, 
  validateNotificacion, 
  notificacionController.updateNotificacion
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('eliminar_notificaciones'), 
  validateId, 
  notificacionController.deleteNotificacion
);

// Rutas para marcar como leída/no leída
router.patch('/:id/marcar-leida', 
  authenticateToken, 
  requireSuperAdminOrPermission('editar_notificaciones'), 
  validateId, 
  notificacionController.marcarComoLeida
);

router.patch('/:id/marcar-no-leida', 
  authenticateToken, 
  requireSuperAdminOrPermission('editar_notificaciones'), 
  validateId, 
  notificacionController.marcarComoNoLeida
);

router.patch('/marcar-todas-leidas', 
  authenticateToken, 
  requireSuperAdminOrPermission('editar_notificaciones'), 
  notificacionController.marcarTodasComoLeidas
);

module.exports = router;

