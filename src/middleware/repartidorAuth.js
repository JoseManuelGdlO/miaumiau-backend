const jwt = require('jsonwebtoken');
const { Repartidor } = require('../models');

const authenticateRepartidor = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar que el token sea de un repartidor
    if (decoded.tipo !== 'repartidor' || !decoded.repartidorId) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido para repartidor'
      });
    }

    // Buscar el repartidor
    const repartidor = await Repartidor.findByPk(decoded.repartidorId, {
      where: { baja_logica: false },
      attributes: { exclude: ['contrasena'] }
    });

    if (!repartidor) {
      return res.status(401).json({
        success: false,
        message: 'Repartidor no encontrado'
      });
    }

    // Verificar que el repartidor esté activo
    if (!['activo', 'disponible', 'en_ruta', 'ocupado'].includes(repartidor.estado)) {
      return res.status(401).json({
        success: false,
        message: 'Tu cuenta está inactiva. Contacta al administrador.'
      });
    }

    req.repartidor = repartidor;
    req.repartidorId = repartidor.id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error al autenticar repartidor'
    });
  }
};

module.exports = { authenticateRepartidor };
