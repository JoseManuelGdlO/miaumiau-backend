const express = require('express');
const router = express.Router();
const conversacionChatController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { requireSuperAdminOrPermission } = require('../../middleware/permissions');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validaciones
const validateChat = [
  body('fkid_conversacion')
    .isInt({ min: 1 })
    .withMessage('El ID de la conversación debe ser un número entero positivo'),
  
  body('from')
    .optional()
    .isIn(['usuario', 'bot', 'agente', 'sistema'])
    .withMessage('El campo from debe ser: usuario, bot, agente o sistema'),
  
  body('mensaje')
    .isLength({ min: 1, max: 5000 })
    .withMessage('El mensaje debe tener entre 1 y 5000 caracteres')
    .notEmpty()
    .withMessage('El mensaje no puede estar vacío'),
  
  body('tipo_mensaje')
    .optional()
    .isIn(['texto', 'imagen', 'archivo', 'audio', 'video', 'ubicacion', 'contacto'])
    .withMessage('El tipo de mensaje debe ser: texto, imagen, archivo, audio, video, ubicacion o contacto'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('El metadata debe ser un objeto JSON válido'),
  
  handleValidationErrors
];

const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El ID debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateQuery = [
  query('fkid_conversacion')
    .optional()
    .isInt({ min: 1 })
    .withMessage('El ID de la conversación debe ser un número entero positivo'),
  
  query('from')
    .optional()
    .isIn(['usuario', 'bot', 'agente', 'sistema'])
    .withMessage('El campo from debe ser: usuario, bot, agente o sistema'),
  
  query('tipo_mensaje')
    .optional()
    .isIn(['texto', 'imagen', 'archivo', 'audio', 'video', 'ubicacion', 'contacto'])
    .withMessage('El tipo de mensaje debe ser: texto, imagen, archivo, audio, video, ubicacion o contacto'),
  
  query('leido')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro leido debe ser true o false'),
  
  query('activos')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('El parámetro activos debe ser true o false'),
  
  query('search')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('La búsqueda debe tener entre 2 y 100 caracteres'),
  
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

const validateSearch = [
  query('search')
    .isLength({ min: 2, max: 100 })
    .withMessage('La búsqueda debe tener entre 2 y 100 caracteres'),
  
  handleValidationErrors
];

const validateConversacionId = [
  param('conversacionId')
    .isInt({ min: 1 })
    .withMessage('El ID de la conversación debe ser un número entero positivo'),
  
  handleValidationErrors
];

const validateFrom = [
  param('from')
    .isIn(['usuario', 'bot', 'agente', 'sistema'])
    .withMessage('El campo from debe ser: usuario, bot, agente o sistema'),
  
  handleValidationErrors
];

const validateFecha = [
  param('fecha')
    .isISO8601()
    .withMessage('La fecha debe ser una fecha válida'),
  
  handleValidationErrors
];

// Rutas públicas (solo para obtener información)
router.get('/stats', conversacionChatController.getChatStats);
router.get('/recent', conversacionChatController.getRecentChats);
router.get('/unread', conversacionChatController.getUnreadChats);

// Rutas protegidas - Solo administradores y moderadores pueden gestionar chats
router.get('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateQuery, 
  conversacionChatController.getAllChats
);

router.get('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateId, 
  conversacionChatController.getChatById
);

router.post('/', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateChat, 
  conversacionChatController.createChat
);

router.put('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateId, 
  validateChat, 
  conversacionChatController.updateChat
);

router.delete('/:id', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateId, 
  conversacionChatController.deleteChat
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateId, 
  conversacionChatController.restoreChat
);

router.patch('/:id/read', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateId, 
  conversacionChatController.markAsRead
);

router.patch('/:id/unread', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateId, 
  conversacionChatController.markAsUnread
);

// Rutas para consultas específicas
router.get('/conversacion/:conversacionId', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateConversacionId, 
  conversacionChatController.getChatsByConversacion
);

router.get('/from/:from', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateFrom, 
  conversacionChatController.getChatsByFrom
);

router.get('/date/:fecha', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateFecha, 
  conversacionChatController.getChatsByDate
);

router.get('/search/term', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateSearch, 
  conversacionChatController.searchChats
);

router.get('/hour/:fecha', 
  authenticateToken, 
  requireSuperAdminOrPermission('ver_conversaciones_chat'), 
  validateFecha, 
  conversacionChatController.getChatsByHour
);

module.exports = router;
