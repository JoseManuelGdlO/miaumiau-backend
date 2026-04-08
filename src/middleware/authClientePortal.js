const { verifyPortalToken } = require('../utils/jwt');

function authenticateClientePortal(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token requerido' });
  }
  try {
    const decoded = verifyPortalToken(token);
    req.clientePortal = { clienteId: decoded.clienteId, mustChangePassword: decoded.mustChangePassword };
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
}

module.exports = { authenticateClientePortal };
