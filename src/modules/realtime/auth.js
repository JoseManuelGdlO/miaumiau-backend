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

module.exports = { verifyRepartidorToken };
