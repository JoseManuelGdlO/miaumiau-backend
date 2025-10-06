const jwt = require('jsonwebtoken');
const { User, Role, Permission } = require('../models');

const authenticateToken = async (req, res, next) => {
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
    
    // Si el token incluye permisos, usarlos directamente (más eficiente)
    if (decoded.permissions) {
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions
      };
      req.userPermissions = decoded.permissions;
      return next();
    }
    
    // Si no hay permisos en el token, buscarlos en la BD (fallback)
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['contrasena'] },
      include: [
        {
          model: Role,
          as: 'rol',
          attributes: ['id', 'nombre', 'descripcion'],
          include: [
            {
              model: Permission,
              as: 'permissions',
              through: { attributes: [] },
              where: { baja_logica: false },
              required: false
            }
          ]
        },
        {
          model: require('../models').City,
          as: 'ciudad',
          attributes: ['id', 'nombre', 'departamento']
        }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Obtener permisos del usuario
    let userPermissions = [];
    if (user.rol && user.rol.permissions) {
      userPermissions = user.rol.permissions.map(p => p.nombre);
    }

    // Si es super_admin, agregar indicador de acceso total
    if (user.rol && user.rol.nombre === 'super_admin') {
      userPermissions.push('*');
    }

    req.user = user;
    req.userPermissions = userPermissions;
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(403).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }

    if (!req.user.rol || !roles.includes(req.user.rol.nombre)) {
      return res.status(403).json({
        success: false,
        message: 'Permisos insuficientes'
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole
};
