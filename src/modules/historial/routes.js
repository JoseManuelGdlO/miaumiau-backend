const express = require('express');
const { authenticateToken } = require('../../middleware/auth');
const service = require('./service');

const router = express.Router();

function rolDe(user) {
  return user?.rol?.nombre || user?.role || '';
}

router.get('/', authenticateToken, async (req, res) => {
  const rol = rolDe(req.user);
  if (rol !== 'admin' && rol !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Solo un administrador puede ver el historial' });
  }
  try {
    const data = await service.listar({
      search: req.query.search,
      accion: req.query.accion,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'No se pudo leer el historial' });
  }
});

module.exports = router;
