const { User, Role, City } = require('../../models');
const { Op } = require('sequelize');

class UsersController {
  // Obtener todos los usuarios
  async getAllUsers(req, res, next) {
    try {
      const { 
        activos = 'true', 
        rol_id, 
        ciudad_id, 
        search,
        page = 1,
        limit = 10
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      if (activos === 'true') {
        whereClause.isActive = true;
      } else if (activos === 'false') {
        whereClause.isActive = false;
      }
      
      // Filtrar por rol
      if (rol_id) {
        whereClause.rol_id = rol_id;
      }
      
      // Filtrar por ciudad
      if (ciudad_id) {
        whereClause.ciudad_id = ciudad_id;
      }

      // Búsqueda por nombre o email
      if (search) {
        whereClause[Op.or] = [
          { nombre_completo: { [Op.like]: `%${search}%` } },
          { correo_electronico: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Role,
            as: 'rol',
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
        attributes: { exclude: ['contrasena'] } // Excluir contraseña
      });

      res.json({
        success: true,
        data: {
          users,
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener un usuario por ID
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id, {
        include: [
          {
            model: Role,
            as: 'rol',
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        attributes: { exclude: ['contrasena'] }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear un nuevo usuario
  async createUser(req, res, next) {
    try {
      const { nombre_completo, correo_electronico, contrasena, rol_id, ciudad_id } = req.body;

      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({
        where: { correo_electronico }
      });

      if (existingUser) {
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

      // Obtener el usuario con sus relaciones
      const newUser = await User.findByPk(user.id, {
        include: [
          {
            model: Role,
            as: 'rol',
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        attributes: { exclude: ['contrasena'] }
      });

      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        data: newUser
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar un usuario
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { nombre_completo, correo_electronico, rol_id, ciudad_id, isActive } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar si el correo ya existe (si se está cambiando)
      if (correo_electronico && correo_electronico !== user.correo_electronico) {
        const existingUser = await User.findOne({
          where: { correo_electronico }
        });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'El correo electrónico ya está en uso'
          });
        }
      }

      // Actualizar usuario
      const updateData = {
        nombre_completo: nombre_completo || user.nombre_completo,
        correo_electronico: correo_electronico || user.correo_electronico,
        rol_id: rol_id || user.rol_id,
        isActive: isActive !== undefined ? isActive : user.isActive
      };
      
      // Manejar ciudad_id: si viene undefined, mantener el valor actual; si viene null, establecerlo como null
      if (ciudad_id !== undefined) {
        updateData.ciudad_id = ciudad_id;
      } else {
        updateData.ciudad_id = user.ciudad_id;
      }
      
      await user.update(updateData);

      // Obtener el usuario actualizado con sus relaciones
      const updatedUser = await User.findByPk(id, {
        include: [
          {
            model: Role,
            as: 'rol',
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        attributes: { exclude: ['contrasena'] }
      });

      res.json({
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: updatedUser
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar un usuario (baja lógica)
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar si es el último administrador
      if (user.rol_id === 1) { // Asumiendo que rol_id 1 es admin
        const adminCount = await User.count({
          where: { 
            rol_id: 1, 
            isActive: true,
            id: { [Op.ne]: id }
          }
        });

        if (adminCount === 0) {
          return res.status(400).json({
            success: false,
            message: 'No se puede eliminar el último administrador del sistema'
          });
        }
      }

      await user.update({ isActive: false });

      res.json({
        success: true,
        message: 'Usuario eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar un usuario
  async restoreUser(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      await user.update({ isActive: true });

      res.json({
        success: true,
        message: 'Usuario restaurado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Cambiar contraseña de un usuario (solo admin)
  async changeUserPassword(req, res, next) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      await user.update({ contrasena: newPassword });

      res.json({
        success: true,
        message: 'Contraseña actualizada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener estadísticas de usuarios
  async getUserStats(req, res, next) {
    try {
      const totalUsers = await User.count({ where: { isActive: true } });
      const activeUsers = await User.count({ where: { isActive: true } });
      const inactiveUsers = await User.count({ where: { isActive: false } });

      // Usuarios por rol
      const usersByRole = await User.findAll({
        where: { isActive: true },
        include: [{
          model: Role,
          as: 'rol',
          attributes: ['id', 'nombre']
        }],
        attributes: ['rol_id'],
        group: ['rol_id', 'rol.id', 'rol.nombre'],
        raw: false
      });

      const roleStats = usersByRole.map(item => ({
        role: item.rol ? item.rol.nombre : 'Sin rol',
        count: 1 // Esto se puede mejorar con una consulta más compleja
      }));

      res.json({
        success: true,
        data: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          byRole: roleStats
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UsersController();
