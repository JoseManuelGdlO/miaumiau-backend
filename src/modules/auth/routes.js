const express = require('express');
const router = express.Router();
const authController = require('./controller');
const { authenticateToken } = require('../../middleware/auth');
const { 
  validateRegister, 
  validateLogin, 
  validateChangePassword 
} = require('../../utils/validation');

// Rutas públicas
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh-token', authController.refreshToken);

// Rutas protegidas
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);
router.put('/change-password', authenticateToken, validateChangePassword, authController.changePassword);
router.post('/logout', authenticateToken, authController.logout);
router.post('/generate-permanent-token', authenticateToken, authController.generatePermanentToken);

module.exports = router;
