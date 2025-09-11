const { Role, Permission, RolePermission } = require('../../models');
const { Op } = require('sequelize');

class RoleController {
  // Obtener todos los roles
  async getAllRoles(req, res, next) {
    try {
      const { activos = 'true', include_permissions = 'false' } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      if (activos === 'true') {
        whereClause.baja_logica = false;
      } else if (activos === 'false') {
        whereClause.baja_logica = true;
      }

      const includeOptions = [];
      
      // Incluir permisos si se solicita
      if (include_permissions === 'true') {
        includeOptions.push({
          model: Permission,
          as: 'permissions',
          through: { attributes: [] }, // No incluir datos de la tabla intermedia
          where: { baja_logica: false }
        });
      }

      const roles = await Role.findAll({
        where: whereClause,
        include: includeOptions,
        order: [['nombre', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          roles,
          total: roles.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener un rol por ID
  async getRoleById(req, res, next) {
    try {
      const { id } = req.params;
      const { include_permissions = 'true' } = req.query;
      
      const includeOptions = [];
      
      if (include_permissions === 'true') {
        includeOptions.push({
          model: Permission,
          as: 'permissions',
          through: { attributes: [] },
          where: { baja_logica: false }
        });
      }
      
      const role = await Role.findByPk(id, {
        include: includeOptions
      });
      
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Rol no encontrado'
        });
      }

      res.json({
        success: true,
        data: { role }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo rol
  async createRole(req, res, next) {
    try {
      const { nombre, descripcion, permissions = [] } = req.body;

      // Verificar si el rol ya existe
      const existingRole = await Role.findOne({
        where: { nombre }
      });

      if (existingRole) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un rol con ese nombre'
        });
      }

      // Crear el rol
      const role = await Role.create({
        nombre,
        descripcion
      });

      // Asignar permisos si se proporcionan
      if (permissions && permissions.length > 0) {
        // Verificar que todos los permisos existan
        const existingPermissions = await Permission.findAll({
          where: {
            id: { [Op.in]: permissions },
            baja_logica: false
          }
        });

        if (existingPermissions.length !== permissions.length) {
          return res.status(400).json({
            success: false,
            message: 'Algunos permisos no existen o están inactivos'
          });
        }

        // Asignar permisos al rol
        await RolePermission.syncRolePermissions(role.id, permissions);
      }

      // Obtener el rol con sus permisos
      const roleWithPermissions = await Role.findByPk(role.id, {
        include: [{
          model: Permission,
          as: 'permissions',
          through: { attributes: [] }
        }]
      });

      res.status(201).json({
        success: true,
        message: 'Rol creado exitosamente',
        data: { role: roleWithPermissions }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar rol
  async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const { nombre, descripcion, permissions } = req.body;

      const role = await Role.findByPk(id);
      
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Rol no encontrado'
        });
      }

      // Verificar si el nuevo nombre ya existe (si se está cambiando)
      if (nombre && nombre !== role.nombre) {
        const existingRole = await Role.findOne({
          where: { 
            nombre,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingRole) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un rol con ese nombre'
          });
        }
      }

      // Actualizar el rol
      await role.update({
        nombre: nombre || role.nombre,
        descripcion: descripcion !== undefined ? descripcion : role.descripcion
      });

      // Actualizar permisos si se proporcionan
      if (permissions !== undefined) {
        if (Array.isArray(permissions)) {
          // Verificar que todos los permisos existan
          if (permissions.length > 0) {
            const existingPermissions = await Permission.findAll({
              where: {
                id: { [Op.in]: permissions },
                baja_logica: false
              }
            });

            if (existingPermissions.length !== permissions.length) {
              return res.status(400).json({
                success: false,
                message: 'Algunos permisos no existen o están inactivos'
              });
            }
          }

          // Sincronizar permisos
          await RolePermission.syncRolePermissions(role.id, permissions);
        }
      }

      // Obtener el rol actualizado con sus permisos
      const updatedRole = await Role.findByPk(role.id, {
        include: [{
          model: Permission,
          as: 'permissions',
          through: { attributes: [] }
        }]
      });

      res.json({
        success: true,
        message: 'Rol actualizado exitosamente',
        data: { role: updatedRole }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar rol (baja lógica)
  async deleteRole(req, res, next) {
    try {
      const { id } = req.params;

      const role = await Role.findByPk(id);
      
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Rol no encontrado'
        });
      }

      await role.softDelete();

      res.json({
        success: true,
        message: 'Rol eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar rol
  async restoreRole(req, res, next) {
    try {
      const { id } = req.params;

      const role = await Role.findByPk(id);
      
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Rol no encontrado'
        });
      }

      await role.restore();

      res.json({
        success: true,
        message: 'Rol restaurado exitosamente',
        data: { role }
      });
    } catch (error) {
      next(error);
    }
  }

  // Asignar permiso a rol
  async assignPermission(req, res, next) {
    try {
      const { id } = req.params;
      const { permission_id } = req.body;

      const role = await Role.findByPk(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Rol no encontrado'
        });
      }

      const permission = await Permission.findByPk(permission_id);
      if (!permission || permission.baja_logica) {
        return res.status(404).json({
          success: false,
          message: 'Permiso no encontrado o inactivo'
        });
      }

      const { rolePermission, created } = await RolePermission.assignPermissionToRole(id, permission_id);

      res.json({
        success: true,
        message: created ? 'Permiso asignado exitosamente' : 'El permiso ya estaba asignado',
        data: { rolePermission }
      });
    } catch (error) {
      next(error);
    }
  }

  // Remover permiso de rol
  async removePermission(req, res, next) {
    try {
      const { id, permission_id } = req.params;

      const role = await Role.findByPk(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Rol no encontrado'
        });
      }

      const deletedCount = await RolePermission.removePermissionFromRole(id, permission_id);

      if (deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'El permiso no estaba asignado a este rol'
        });
      }

      res.json({
        success: true,
        message: 'Permiso removido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener permisos de un rol
  async getRolePermissions(req, res, next) {
    try {
      const { id } = req.params;

      const role = await Role.findByPk(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Rol no encontrado'
        });
      }

      const rolePermissions = await RolePermission.findByRole(id);

      res.json({
        success: true,
        data: {
          role: role.toJSON(),
          permissions: rolePermissions.map(rp => rp.permission)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RoleController();
