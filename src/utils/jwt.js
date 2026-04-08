const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });
};

const generatePermanentToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    // Sin expiresIn = token sin vencimiento
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

const portalSecret = () => process.env.JWT_PORTAL_SECRET || process.env.JWT_SECRET;

const generatePortalToken = (payload) => {
  return jwt.sign(
    { ...payload, tipo: 'portal_cliente' },
    portalSecret(),
    { expiresIn: process.env.JWT_PORTAL_EXPIRE || '7d' }
  );
};

const verifyPortalToken = (token) => {
  const decoded = jwt.verify(token, portalSecret());
  if (decoded.tipo !== 'portal_cliente') {
    const err = new Error('Token no válido para el portal');
    err.statusCode = 401;
    throw err;
  }
  return decoded;
};

module.exports = {
  generateToken,
  generateRefreshToken,
  generatePermanentToken,
  verifyToken,
  verifyRefreshToken,
  generatePortalToken,
  verifyPortalToken
};
