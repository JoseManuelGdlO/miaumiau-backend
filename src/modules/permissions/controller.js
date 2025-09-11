const { Permission } = require('../../models');
const { Op } = require('sequelize');

class PermissionController {
  // Obtener todos los permisos
  async getAllPermissions(req, res, next) {
    try {
      const { categoria, tipo, activos = 'true' } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      if (activos === 'true') {
        whereClause.baja_logica = false;
      } else if (activos === 'false') {
        whereClause.baja_logica = true;
      }
      
      // Filtrar por categoría
      if (categoria) {
        whereClause.categoria = categoria;
      }
      
      // Filtrar por tipo
      if (tipo) {
        whereClause.tipo = tipo;
      }

      const permissions = await Permission.findAll({
        where: whereClause,
        order: [['categoria', 'ASC'], ['nombre', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          permissions,
          total: permissions.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener un permiso por ID
  async getPermissionById(req, res, next) {
    try {
      const { id } = req.params;
      
      const permission = await Permission.findByPk(id);
      
      if (!permission) {
        return res.status(404).json({
          success: false,
          message: 'Permiso no encontrado'
        });
      }

      res.json({
        success: true,
        data: { permission }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo permiso
  async createPermission(req, res, next) {
    try {
      const { nombre, categoria, descripcion, tipo } = req.body;

      // Verificar si el permiso ya existe
      const existingPermission = await Permission.findOne({
        where: { nombre }
      });

      if (existingPermission) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un permiso con ese nombre'
        });
      }

      const permission = await Permission.create({
        nombre,
        categoria,
        descripcion,
        tipo
      });

      res.status(201).json({
        success: true,
        message: 'Permiso creado exitosamente',
        data: { permission }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar permiso
  async updatePermission(req, res, next) {
    try {
      const { id } = req.params;
      const { nombre, categoria, descripcion, tipo } = req.body;

      const permission = await Permission.findByPk(id);
      
      if (!permission) {
        return res.status(404).json({
          success: false,
          message: 'Permiso no encontrado'
        });
      }

      // Verificar si el nuevo nombre ya existe (si se está cambiando)
      if (nombre && nombre !== permission.nombre) {
        const existingPermission = await Permission.findOne({
          where: { 
            nombre,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingPermission) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un permiso con ese nombre'
          });
        }
      }

      await permission.update({
        nombre: nombre || permission.nombre,
        categoria: categoria || permission.categoria,
        descripcion: descripcion !== undefined ? descripcion : permission.descripcion,
        tipo: tipo || permission.tipo
      });

      res.json({
        success: true,
        message: 'Permiso actualizado exitosamente',
        data: { permission }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar permiso (baja lógica)
  async deletePermission(req, res, next) {
    try {
      const { id } = req.params;

      const permission = await Permission.findByPk(id);
      
      if (!permission) {
        return res.status(404).json({
          success: false,
          message: 'Permiso no encontrado'
        });
      }

      await permission.softDelete();

      res.json({
        success: true,
        message: 'Permiso eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar permiso
  async restorePermission(req, res, next) {
    try {
      const { id } = req.params;

      const permission = await Permission.findByPk(id);
      
      if (!permission) {
        return res.status(404).json({
          success: false,
          message: 'Permiso no encontrado'
        });
      }

      await permission.restore();

      res.json({
        success: true,
        message: 'Permiso restaurado exitosamente',
        data: { permission }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener categorías disponibles
  async getCategories(req, res, next) {
    try {
      const categories = await Permission.findAll({
        attributes: ['categoria'],
        where: { baja_logica: false },
        group: ['categoria'],
        order: [['categoria', 'ASC']]
      });

      const categoryList = categories.map(cat => cat.categoria);

      res.json({
        success: true,
        data: { categories: categoryList }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener tipos disponibles
  async getTypes(req, res, next) {
    try {
      const types = ['lectura', 'escritura', 'eliminacion', 'administracion', 'especial'];

      res.json({
        success: true,
        data: { types }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PermissionController();
