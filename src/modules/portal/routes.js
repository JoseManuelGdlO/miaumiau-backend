const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const portalController = require('./controller');
const { authenticateClientePortal } = require('../../middleware/authClientePortal');
const { Cliente } = require('../../models');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      errors: errors.array()
    });
  }
  next();
};

async function requirePortalPasswordComplete(req, res, next) {
  try {
    const cliente = await Cliente.findByPk(req.clientePortal.clienteId, {
      attributes: ['id', 'must_change_password']
    });
    if (!cliente) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }
    if (cliente.must_change_password) {
      return res.status(403).json({
        success: false,
        code: 'MUST_CHANGE_PASSWORD',
        message: 'Debes actualizar tu contraseña para continuar'
      });
    }
    next();
  } catch (e) {
    next(e);
  }
}

router.post(
  '/auth/login',
  [
    body('telefono').notEmpty().withMessage('Teléfono requerido'),
    body('password').notEmpty().withMessage('Contraseña requerida')
  ],
  validate,
  portalController.login.bind(portalController)
);

router.post(
  '/auth/change-password',
  authenticateClientePortal,
  [
    body('newPassword').isLength({ min: 6 }).withMessage('Mínimo 6 caracteres'),
    body('currentPassword').notEmpty().withMessage('Contraseña actual requerida')
  ],
  validate,
  portalController.changePassword.bind(portalController)
);

router.get('/me', authenticateClientePortal, portalController.me.bind(portalController));

router.get(
  '/pedidos',
  authenticateClientePortal,
  requirePortalPasswordComplete,
  portalController.listPedidos.bind(portalController)
);

router.get(
  '/puntos/movimientos',
  authenticateClientePortal,
  requirePortalPasswordComplete,
  portalController.listMovimientosPuntos.bind(portalController)
);

router.get(
  '/puntos/resumen',
  authenticateClientePortal,
  requirePortalPasswordComplete,
  portalController.resumenPuntos.bind(portalController)
);

module.exports = router;
