const { User, Role, Permission, RolePermission } = require('../models');

/**
 * Middleware para verificar permisos específicos del usuario
 * @param {string|Array} requiredPermissions - Permiso(s) requerido(s)
 * @returns {Function} Middleware function
 */
const requirePermission = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Autenticación requerida'
        });
      }

      // Convertir a array si es string
      const permissions = Array.isArray(requiredPermissions) 
        ? requiredPermissions 
        : [requiredPermissions];

      // Si ya tenemos permisos en el request (del token), usarlos directamente
      if (req.userPermissions && req.userPermissions.length > 0) {
        // Verificar si el usuario tiene al menos uno de los permisos requeridos
        const hasPermission = permissions.some(permission => 
          req.userPermissions.includes(permission)
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'Permisos insuficientes',
            required: permissions,
            userPermissions: req.userPermissions
          });
        }

        return next();
      }

      // Fallback: obtener permisos desde la BD si no están en el token
      const userWithPermissions = await User.findByPk(req.user.id, {
        include: [
          {
            model: Role,
            as: 'rol',
            include: [
              {
                model: Permission,
                as: 'permissions',
                through: { attributes: [] },
                where: { baja_logica: false },
                required: false
              }
            ]
          }
        ]
      });

      if (!userWithPermissions || !userWithPermissions.rol) {
        return res.status(403).json({
          success: false,
          message: 'Usuario sin rol asignado'
        });
      }

      // Obtener los nombres de permisos del usuario
      const userPermissions = userWithPermissions.rol.permissions.map(p => p.nombre);

      // Si es super_admin, agregar indicador de acceso total
      if (userWithPermissions.rol.nombre === 'super_admin') {
        userPermissions.push('*');
      }

      // Verificar si el usuario tiene al menos uno de los permisos requeridos
      const hasPermission = permissions.some(permission => 
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Permisos insuficientes',
          required: permissions,
          userPermissions: userPermissions
        });
      }

      // Agregar permisos del usuario al request para uso posterior
      req.userPermissions = userPermissions;
      next();
    } catch (error) {
      console.error('Error verificando permisos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
};

/**
 * Middleware para verificar múltiples permisos (todos requeridos)
 * @param {Array} requiredPermissions - Array de permisos requeridos
 * @returns {Function} Middleware function
 */
const requireAllPermissions = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Autenticación requerida'
        });
      }

      // Obtener el usuario con su rol y permisos
      const userWithPermissions = await User.findByPk(req.user.id, {
        include: [
          {
            model: Role,
            as: 'rol',
            include: [
              {
                model: Permission,
                as: 'permissions',
                through: { attributes: [] },
                where: { baja_logica: false },
                required: false
              }
            ]
          }
        ]
      });

      if (!userWithPermissions || !userWithPermissions.rol) {
        return res.status(403).json({
          success: false,
          message: 'Usuario sin rol asignado'
        });
      }

      // Obtener los nombres de permisos del usuario
      const userPermissions = userWithPermissions.rol.permissions.map(p => p.nombre);

      // Verificar si el usuario tiene todos los permisos requeridos
      const hasAllPermissions = requiredPermissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        const missingPermissions = requiredPermissions.filter(permission => 
          !userPermissions.includes(permission)
        );
        
        return res.status(403).json({
          success: false,
          message: 'Permisos insuficientes',
          required: requiredPermissions,
          missing: missingPermissions,
          userPermissions: userPermissions
        });
      }

      // Agregar permisos del usuario al request para uso posterior
      req.userPermissions = userPermissions;
      next();
    } catch (error) {
      console.error('Error verificando permisos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
};

/**
 * Middleware para verificar permisos por categoría
 * @param {string} category - Categoría de permisos
 * @param {string} action - Acción requerida (ver, crear, editar, eliminar, administrar)
 * @returns {Function} Middleware function
 */
const requireCategoryPermission = (category, action) => {
  const permissionName = `${action}_${category}`;
  return requirePermission(permissionName);
};

/**
 * Middleware para verificar si el usuario es super_admin (bypass de permisos)
 * @returns {Function} Middleware function
 */
const requireSuperAdmin = () => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Autenticación requerida'
        });
      }

      if (req.user.rol && req.user.rol.nombre === 'super_admin') {
        // Super admin tiene acceso a todo
        req.userPermissions = ['*']; // Indicador de acceso total
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Se requiere rol de super administrador'
      });
    } catch (error) {
      console.error('Error verificando super admin:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
};

/**
 * Middleware híbrido: super_admin o permiso específico
 * @param {string|Array} requiredPermissions - Permiso(s) requerido(s)
 * @returns {Function} Middleware function
 */
const requireSuperAdminOrPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Autenticación requerida'
        });
      }

      // Si ya tenemos permisos en el request (del token), verificar directamente
      if (req.userPermissions && req.userPermissions.length > 0) {
        // Si es super_admin (tiene '*' en permisos), permitir acceso
        if (req.userPermissions.includes('*')) {
          return next();
        }

        // Si no es super_admin, verificar permisos específicos
        const permissions = Array.isArray(requiredPermissions) 
          ? requiredPermissions 
          : [requiredPermissions];

        const hasPermission = permissions.some(permission => 
          req.userPermissions.includes(permission)
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'Permisos insuficientes',
            required: permissions,
            userPermissions: req.userPermissions
          });
        }

        return next();
      }

      // Fallback: verificar desde la BD
      // Si es super_admin, permitir acceso
      if (req.user.rol && req.user.rol.nombre === 'super_admin') {
        req.userPermissions = ['*'];
        return next();
      }

      // Si no es super_admin, verificar permisos específicos
      return requirePermission(requiredPermissions)(req, res, next);
    } catch (error) {
      console.error('Error en verificación híbrida:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  };
};

module.exports = {
  requirePermission,
  requireAllPermissions,
  requireCategoryPermission,
  requireSuperAdmin,
  requireSuperAdminOrPermission
};
