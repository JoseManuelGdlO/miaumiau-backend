const express = require('express');
const router = express.Router();
const conversacionChatController = require('./controller');
const { authenticateToken, requireRole } = require('../../middleware/auth');
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
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateQuery, 
  conversacionChatController.getAllChats
);

router.get('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateId, 
  conversacionChatController.getChatById
);

router.post('/', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateChat, 
  conversacionChatController.createChat
);

router.put('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  validateChat, 
  conversacionChatController.updateChat
);

router.delete('/:id', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  conversacionChatController.deleteChat
);

router.patch('/:id/restore', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  validateId, 
  conversacionChatController.restoreChat
);

router.patch('/:id/read', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateId, 
  conversacionChatController.markAsRead
);

router.patch('/:id/unread', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateId, 
  conversacionChatController.markAsUnread
);

// Rutas para consultas específicas
router.get('/conversacion/:conversacionId', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateConversacionId, 
  conversacionChatController.getChatsByConversacion
);

router.get('/from/:from', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateFrom, 
  conversacionChatController.getChatsByFrom
);

router.get('/date/:fecha', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateFecha, 
  conversacionChatController.getChatsByDate
);

router.get('/search/term', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateSearch, 
  conversacionChatController.searchChats
);

router.get('/hour/:fecha', 
  authenticateToken, 
  requireRole(['admin', 'super_admin', 'moderator']), 
  validateFecha, 
  conversacionChatController.getChatsByHour
);

module.exports = router;
