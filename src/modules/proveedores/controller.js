const { Proveedor } = require('../../models');
const { Op } = require('sequelize');

const { Logger } = require('../../utils/logger');

const log = new Logger('Proveedores');

class ProveedorController {
  // Obtener todos los proveedores
  async getAllProveedores(req, res, next) {
    try {
      const { 
        activos = 'true',
        search,
        page = 1,
        limit = 10
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      if (activos === 'true') {
        whereClause.baja_logica = false;
      } else if (activos === 'false') {
        whereClause.baja_logica = true;
      }

      // Búsqueda por nombre, descripción o correo
      if (search) {
        whereClause[Op.or] = [
          { nombre: { [Op.iLike]: `%${search}%` } },
          { descripcion: { [Op.iLike]: `%${search}%` } },
          { correo: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: proveedores } = await Proveedor.findAndCountAll({
        where: whereClause,
        order: [['nombre', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          proveedores,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      log.error('getAllProveedores falló', { message: error.message });
      next(error);
    }
  }

  // Obtener un proveedor por ID
  async getProveedorById(req, res, next) {
    try {
      const { id } = req.params;
      
      const proveedor = await Proveedor.findByPk(id);
      
      if (!proveedor) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }

      res.json({
        success: true,
        data: { proveedor }
      });
    } catch (error) {
      log.error('getProveedorById falló', { message: error.message });
      next(error);
    }
  }

  // Crear nuevo proveedor
  async createProveedor(req, res, next) {
    try {
      const {
        nombre,
        descripcion,
        correo,
        telefono
      } = req.body;

      // Verificar si el correo ya existe
      const existingProveedor = await Proveedor.findByEmail(correo);

      if (existingProveedor) {
        log.warn('createProveedor rechazado', { status: 400, reason: "Ya existe un proveedor con ese correo electrónico" });
        return res.status(400).json({
          success: false,
          message: 'Ya existe un proveedor con ese correo electrónico'
        });
      }

      // Verificar si el teléfono ya existe
      const existingPhone = await Proveedor.findByPhone(telefono);

      if (existingPhone) {
        log.warn('createProveedor rechazado', { status: 400, reason: "Ya existe un proveedor con ese número de teléfono" });
        return res.status(400).json({
          success: false,
          message: 'Ya existe un proveedor con ese número de teléfono'
        });
      }

      const proveedor = await Proveedor.create({
        nombre,
        descripcion,
        correo,
        telefono
      });

      log.info('createProveedor', { id: proveedor.id });
      res.status(201).json({
        success: true,
        message: 'Proveedor creado exitosamente',
        data: { proveedor }
      });
    } catch (error) {
      log.error('createProveedor falló', { message: error.message });
      next(error);
    }
  }

  // Actualizar proveedor
  async updateProveedor(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const proveedor = await Proveedor.findByPk(id);
      
      if (!proveedor) {
        log.warn('updateProveedor rechazado', { status: 404, reason: "Proveedor no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }

      // Verificar si el nuevo correo ya existe (si se está cambiando)
      if (updateData.correo) {
        const existingProveedor = await Proveedor.findOne({
          where: { 
            correo: updateData.correo,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingProveedor) {
          log.warn('updateProveedor rechazado', { status: 400, reason: "Ya existe un proveedor con ese correo electrónico" });
          return res.status(400).json({
            success: false,
            message: 'Ya existe un proveedor con ese correo electrónico'
          });
        }
      }

      // Verificar si el nuevo teléfono ya existe (si se está cambiando)
      if (updateData.telefono) {
        const existingPhone = await Proveedor.findOne({
          where: { 
            telefono: updateData.telefono,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingPhone) {
          log.warn('updateProveedor rechazado', { status: 400, reason: "Ya existe un proveedor con ese número de teléfono" });
          return res.status(400).json({
            success: false,
            message: 'Ya existe un proveedor con ese número de teléfono'
          });
        }
      }

      await proveedor.update(updateData);

      log.info('updateProveedor', { id: id });
      res.json({
        success: true,
        message: 'Proveedor actualizado exitosamente',
        data: { proveedor }
      });
    } catch (error) {
      log.error('updateProveedor falló', { message: error.message });
      next(error);
    }
  }

  // Eliminar proveedor (baja lógica)
  async deleteProveedor(req, res, next) {
    try {
      const { id } = req.params;

      const proveedor = await Proveedor.findByPk(id);
      
      if (!proveedor) {
        log.warn('deleteProveedor rechazado', { status: 404, reason: "Proveedor no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }

      await proveedor.softDelete();

      log.info('deleteProveedor', { id: id });
      res.json({
        success: true,
        message: 'Proveedor eliminado exitosamente'
      });
    } catch (error) {
      log.error('deleteProveedor falló', { message: error.message });
      next(error);
    }
  }

  // Restaurar proveedor
  async restoreProveedor(req, res, next) {
    try {
      const { id } = req.params;

      const proveedor = await Proveedor.findByPk(id);
      
      if (!proveedor) {
        log.warn('restoreProveedor rechazado', { status: 404, reason: "Proveedor no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }

      await proveedor.restore();

      log.info('restoreProveedor', { id: id });
      res.json({
        success: true,
        message: 'Proveedor restaurado exitosamente',
        data: { proveedor }
      });
    } catch (error) {
      log.error('restoreProveedor falló', { message: error.message });
      next(error);
    }
  }

  // Activar proveedor
  async activateProveedor(req, res, next) {
    try {
      const { id } = req.params;

      const proveedor = await Proveedor.findByPk(id);
      
      if (!proveedor) {
        log.warn('activateProveedor rechazado', { status: 404, reason: "Proveedor no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }

      await proveedor.activate();

      log.info('activateProveedor', { id: id });
      res.json({
        success: true,
        message: 'Proveedor activado exitosamente',
        data: { proveedor }
      });
    } catch (error) {
      log.error('activateProveedor falló', { message: error.message });
      next(error);
    }
  }

  // Desactivar proveedor
  async deactivateProveedor(req, res, next) {
    try {
      const { id } = req.params;

      const proveedor = await Proveedor.findByPk(id);
      
      if (!proveedor) {
        log.warn('deactivateProveedor rechazado', { status: 404, reason: "Proveedor no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }

      await proveedor.deactivate();

      log.info('deactivateProveedor', { id: id });
      res.json({
        success: true,
        message: 'Proveedor desactivado exitosamente',
        data: { proveedor }
      });
    } catch (error) {
      log.error('deactivateProveedor falló', { message: error.message });
      next(error);
    }
  }

  // Obtener proveedores activos
  async getActiveProveedores(req, res, next) {
    try {
      const proveedores = await Proveedor.findActive();

      res.json({
        success: true,
        data: {
          proveedores,
          total: proveedores.length
        }
      });
    } catch (error) {
      log.error('getActiveProveedores falló', { message: error.message });
      next(error);
    }
  }

  // Buscar proveedores
  async searchProveedores(req, res, next) {
    try {
      const { search } = req.query;

      if (!search) {
        log.warn('searchProveedores rechazado', { status: 400, reason: "Se requiere el parámetro de búsqueda" });
        return res.status(400).json({
          success: false,
          message: 'Se requiere el parámetro de búsqueda'
        });
      }

      const proveedores = await Proveedor.findBySearch(search);

      res.json({
        success: true,
        data: {
          proveedores,
          total: proveedores.length,
          searchTerm: search
        }
      });
    } catch (error) {
      log.error('searchProveedores falló', { message: error.message });
      next(error);
    }
  }

  // Obtener proveedor por correo
  async getProveedorByEmail(req, res, next) {
    try {
      const { correo } = req.params;

      const proveedor = await Proveedor.findByEmail(correo);

      if (!proveedor) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }

      res.json({
        success: true,
        data: { proveedor }
      });
    } catch (error) {
      log.error('getProveedorByEmail falló', { message: error.message });
      next(error);
    }
  }

  // Obtener proveedor por teléfono
  async getProveedorByPhone(req, res, next) {
    try {
      const { telefono } = req.params;

      const proveedor = await Proveedor.findByPhone(telefono);

      if (!proveedor) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }

      res.json({
        success: true,
        data: { proveedor }
      });
    } catch (error) {
      log.error('getProveedorByPhone falló', { message: error.message });
      next(error);
    }
  }

  // Estadísticas de proveedores
  async getProveedorStats(req, res, next) {
    try {
      const totalProveedores = await Proveedor.count({
        where: { baja_logica: false }
      });

      const proveedoresActivos = await Proveedor.count({
        where: { baja_logica: false }
      });

      const proveedoresInactivos = await Proveedor.count({
        where: { baja_logica: true }
      });

      const proveedoresConDescripcion = await Proveedor.count({
        where: { 
          baja_logica: false,
          descripcion: { [Op.ne]: null }
        }
      });

      const proveedoresSinDescripcion = await Proveedor.count({
        where: { 
          baja_logica: false,
          descripcion: null
        }
      });

      res.json({
        success: true,
        data: {
          totalProveedores,
          proveedoresActivos,
          proveedoresInactivos,
          proveedoresConDescripcion,
          proveedoresSinDescripcion
        }
      });
    } catch (error) {
      log.error('getProveedorStats falló', { message: error.message });
      next(error);
    }
  }
}

module.exports = new ProveedorController();
