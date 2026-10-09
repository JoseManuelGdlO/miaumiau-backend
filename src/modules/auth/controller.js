const { User, Role, Permission } = require('../../models');
const { generateToken, generateRefreshToken, generatePermanentToken } = require('../../utils/jwt');

const { Logger } = require('../../utils/logger');

const log = new Logger('Auth');

class AuthController {
  // Registro de usuario
  async register(req, res, next) {
    try {
      const { nombre_completo, correo_electronico, contrasena, rol_id, ciudad_id } = req.body;

      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({
        where: { correo_electronico }
      });

      if (existingUser) {
        log.warn('register rechazado', { status: 400, reason: "El correo electrónico ya está registrado" });
        return res.status(400).json({
          success: false,
          message: 'El correo electrónico ya está registrado'
        });
      }

      // Crear nuevo usuario
      const userData = {
        nombre_completo,
        correo_electronico,
        contrasena,
        rol_id
      };
      
      // Solo incluir ciudad_id si viene en el body
      if (ciudad_id !== undefined && ciudad_id !== null) {
        userData.ciudad_id = ciudad_id;
      }
      
      const user = await User.create(userData);

      // Generar tokens
      const token = generateToken({ userId: user.id, email: user.correo_electronico });
      const refreshToken = generateRefreshToken({ userId: user.id });

      log.info('register', { id: user.id });
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: {
          user: user.toJSON(),
          token,
          refreshToken
        }
      });
    } catch (error) {
      log.error('register falló', { message: error.message });
      next(error);
    }
  }

  // Login de usuario
  async login(req, res, next) {
    try {
      const { correo_electronico, contrasena } = req.body;

      // Buscar usuario por email con rol y permisos
      const user = await User.findOne({
        where: { correo_electronico },
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

      if (!user) {
        log.warn('login rechazado', { status: 401, reason: "Credenciales inválidas" });
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas',
          error: 'Credenciales inválidas'
        });
      }

      // Verificar si el usuario está activo
      if (!user.isActive) {
        log.warn('login rechazado', { status: 401, reason: "Cuenta desactivada. Contacta al administrador." });
        return res.status(401).json({
          success: false,
          message: 'Cuenta desactivada. Contacta al administrador.',
          error: 'Cuenta desactivada. Contacta al administrador.'
        });
      }

      // Verificar contraseña (texto plano por ahora)
      const isPasswordValid = user.contrasena === contrasena;

      if (!isPasswordValid) {
        log.warn('login rechazado', { status: 401, reason: "Credenciales inválidas" });
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas',
          error: 'Credenciales inválidas'
        });
      }

      // Actualizar último login
      await user.update({ lastLogin: new Date() });

      // Obtener permisos del usuario
      let userPermissions = [];
      if (user.rol && user.rol.permissions) {
        userPermissions = user.rol.permissions.map(p => p.nombre);
      }

      // Si es super_admin, agregar indicador de acceso total
      if (user.rol && user.rol.nombre === 'super_admin') {
        userPermissions.push('*'); // Indicador de acceso total
      }

      // Generar tokens con permisos incluidos
      const token = generateToken({ 
        userId: user.id, 
        email: user.correo_electronico,
        role: user.rol ? user.rol.nombre : null,
        permissions: userPermissions
      });
      const refreshToken = generateRefreshToken({ userId: user.id });

      log.info('login', { id: user.id });
      res.json({
        success: true,
        message: 'Login exitoso',
        data: {
          user: {
            id: user.id,
            nombre_completo: user.nombre_completo,
            correo_electronico: user.correo_electronico,
            rol: user.rol ? {
              id: user.rol.id,
              nombre: user.rol.nombre,
              descripcion: user.rol.descripcion
            } : null,
            isActive: user.isActive,
            lastLogin: user.lastLogin
          },
          permissions: userPermissions,
          token,
          refreshToken
        }
      });
    } catch (error) {
      log.error('login falló', { message: error.message });
      next(error);
    }
  }

  // Obtener perfil del usuario autenticado
  async getProfile(req, res, next) {
    try {
      res.json({
        success: true,
        data: {
          user: req.user
        }
      });
    } catch (error) {
      log.error('getProfile falló', { message: error.message });
      next(error);
    }
  }

  // Actualizar perfil
  async updateProfile(req, res, next) {
    try {
      const { nombre_completo, correo_electronico, ciudad_id } = req.body;
      const userId = req.user.id;

      // Verificar si el correo ya existe (si se está cambiando)
      if (correo_electronico && correo_electronico !== req.user.correo_electronico) {
        const existingUser = await User.findByEmail(correo_electronico);
        if (existingUser) {
          log.warn('updateProfile rechazado', { status: 400, reason: "El correo electrónico ya está en uso" });
          return res.status(400).json({
            success: false,
            message: 'El correo electrónico ya está en uso'
          });
        }
      }

      // Actualizar usuario
      const updatedUser = await User.findByPk(userId);
      const updateData = {
        nombre_completo: nombre_completo || updatedUser.nombre_completo,
        correo_electronico: correo_electronico || updatedUser.correo_electronico
      };
      
      // Manejar ciudad_id: si viene undefined, mantener el valor actual; si viene null, establecerlo como null
      if (ciudad_id !== undefined) {
        updateData.ciudad_id = ciudad_id;
      } else {
        updateData.ciudad_id = updatedUser.ciudad_id;
      }
      
      await updatedUser.update(updateData);

      log.info('updateProfile', { id: req.user.id });
      res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: {
          user: updatedUser.toJSON()
        }
      });
    } catch (error) {
      log.error('updateProfile falló', { message: error.message });
      next(error);
    }
  }

  // Cambiar contraseña
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Obtener usuario con contraseña
      const user = await User.findByPk(userId);

      // Verificar contraseña actual
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);

      if (!isCurrentPasswordValid) {
        log.warn('changePassword rechazado', { status: 400, reason: "La contraseña actual es incorrecta" });
        return res.status(400).json({
          success: false,
          message: 'La contraseña actual es incorrecta'
        });
      }

      // Actualizar contraseña
      await user.update({ contrasena: newPassword });

      log.info('changePassword', { id: req.user.id });
      res.json({
        success: true,
        message: 'Contraseña actualizada exitosamente'
      });
    } catch (error) {
      log.error('changePassword falló', { message: error.message });
      next(error);
    }
  }

  // Logout (en el cliente se debe eliminar el token)
  async logout(req, res, next) {
    try {
      log.info('logout', { id: req.user && req.user.id });
      res.json({
        success: true,
        message: 'Logout exitoso'
      });
    } catch (error) {
      log.error('logout falló', { message: error.message });
      next(error);
    }
  }

  // Refrescar token
  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        log.warn('refreshToken rechazado', { status: 401, reason: "Refresh token requerido" });
        return res.status(401).json({
          success: false,
          message: 'Refresh token requerido'
        });
      }

      const { verifyRefreshToken } = require('../../utils/jwt');
      const decoded = verifyRefreshToken(refreshToken);

      // Verificar que el usuario aún existe
      const user = await User.findByPk(decoded.userId);
      if (!user || !user.isActive) {
        log.warn('refreshToken rechazado', { status: 401, reason: "Usuario no válido" });
        return res.status(401).json({
          success: false,
          message: 'Usuario no válido'
        });
      }

      // Generar nuevo token
      const newToken = generateToken({ userId: user.id, email: user.email });

      log.info('refreshToken', { id: user.id });
      res.json({
        success: true,
        data: {
          token: newToken
        }
      });
    } catch (error) {
      log.error('refreshToken falló', { message: error.message });
      next(error);
    }
  }

  // Generar token permanente (sin vencimiento)
  async generatePermanentToken(req, res, next) {
    try {
      const { userId } = req.body;

      if (!userId) {
        log.warn('generatePermanentToken rechazado', { status: 400, reason: "ID de usuario requerido" });
        return res.status(400).json({
          success: false,
          message: 'ID de usuario requerido'
        });
      }

      // Buscar usuario con rol y permisos
      const user = await User.findByPk(userId, {
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

      if (!user) {
        log.warn('generatePermanentToken rechazado', { status: 404, reason: "Usuario no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      if (!user.isActive) {
        log.warn('generatePermanentToken rechazado', { status: 400, reason: "Usuario inactivo" });
        return res.status(400).json({
          success: false,
          message: 'Usuario inactivo'
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

      // Generar token permanente
      const permanentToken = generatePermanentToken({
        userId: user.id,
        email: user.correo_electronico,
        role: user.rol ? user.rol.nombre : null,
        permissions: userPermissions
      });

      log.info('generatePermanentToken', { id: user.id });
      res.json({
        success: true,
        message: 'Token permanente generado exitosamente',
        data: {
          user: {
            id: user.id,
            nombre_completo: user.nombre_completo,
            correo_electronico: user.correo_electronico,
            rol: user.rol ? {
              id: user.rol.id,
              nombre: user.rol.nombre,
              descripcion: user.rol.descripcion
            } : null
          },
          permissions: userPermissions,
          permanentToken,
          warning: 'Este token no expira. Úsalo con precaución y guárdalo de forma segura.'
        }
      });
    } catch (error) {
      log.error('generatePermanentToken falló', { message: error.message });
      next(error);
    }
  }
}

module.exports = new AuthController();
