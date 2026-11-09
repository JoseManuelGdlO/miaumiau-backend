const jwt = require('jsonwebtoken');

const ACTIVE = ['activo', 'disponible', 'en_ruta', 'ocupado'];

async function verifyRepartidorToken(token, deps = {}) {
  if (!token || typeof token !== 'string') return null;
  let decoded;
  try {
    decoded = jwt.verify(token, deps.secret || process.env.JWT_SECRET);
  } catch {
    return null;
  }
  if (decoded.tipo !== 'repartidor' || !decoded.repartidorId) return null;
  const Repartidor = deps.Repartidor || require('../../models').Repartidor;
  const repartidor = await Repartidor.findByPk(decoded.repartidorId);
  if (!repartidor || repartidor.baja_logica) return null;
  if (!ACTIVE.includes(repartidor.estado)) return null;
  return { repartidorId: repartidor.id };
}

function verifyCallCenterToken(token, deps = {}) {
  if (!token || typeof token !== 'string') return null;
  let decoded;
  try {
    decoded = jwt.verify(token, deps.secret || process.env.JWT_SECRET);
  } catch {
    return null;
  }
  if (decoded.tipo === 'repartidor' || decoded.tipo === 'portal_cliente') return null;
  const userId = decoded.userId;
  if (userId == null) return null;
  const role = decoded.role || decoded.rol;
  const permissions = Array.isArray(decoded.permissions) ? decoded.permissions : [];
  if (role === 'super_admin' || permissions.includes('*') || permissions.includes('operar_call_center')) {
    return { userId };
  }
  return null;
}

module.exports = { verifyRepartidorToken, verifyCallCenterToken };
