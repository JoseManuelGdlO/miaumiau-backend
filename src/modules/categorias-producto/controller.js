const { CategoriaProducto } = require('../../models');
const { Op } = require('sequelize');

const { Logger } = require('../../utils/logger');

const log = new Logger('CategoriasProducto');

class CategoriaProductoController {
  // Obtener todas las categorías de producto
  async getAllCategorias(req, res, next) {
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

      // Búsqueda por nombre o descripción
      if (search) {
        whereClause[Op.or] = [
          { nombre: { [Op.like]: `%${search}%` } },
          { descripcion: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: categorias } = await CategoriaProducto.findAndCountAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          categorias,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      log.error('getAllCategorias falló', { message: error.message });
      next(error);
    }
  }

  // Obtener una categoría por ID
  async getCategoriaById(req, res, next) {
    try {
      const { id } = req.params;
      
      const categoria = await CategoriaProducto.findByPk(id);
      
      if (!categoria) {
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      res.json({
        success: true,
        data: { categoria }
      });
    } catch (error) {
      log.error('getCategoriaById falló', { message: error.message });
      next(error);
    }
  }

  // Crear nueva categoría
  async createCategoria(req, res, next) {
    try {
      const {
        nombre,
        descripcion
      } = req.body;

      // Verificar si la categoría ya existe
      const existingCategoria = await CategoriaProducto.findByName(nombre);

      if (existingCategoria) {
        log.warn('createCategoria rechazado', { status: 400, reason: "Ya existe una categoría con ese nombre" });
        return res.status(400).json({
          success: false,
          message: 'Ya existe una categoría con ese nombre'
        });
      }

      const categoria = await CategoriaProducto.create({
        nombre,
        descripcion
      });

      log.info('createCategoria', { id: categoria.id });
      res.status(201).json({
        success: true,
        message: 'Categoría creada exitosamente',
        data: { categoria }
      });
    } catch (error) {
      log.error('createCategoria falló', { message: error.message });
      next(error);
    }
  }

  // Actualizar categoría
  async updateCategoria(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const categoria = await CategoriaProducto.findByPk(id);
      
      if (!categoria) {
        log.warn('updateCategoria rechazado', { status: 404, reason: "Categoría no encontrada" });
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      // Verificar si el nuevo nombre ya existe (si se está cambiando)
      if (updateData.nombre) {
        const existingCategoria = await CategoriaProducto.findOne({
          where: { 
            nombre: {
              [Op.like]: updateData.nombre
            },
            id: { [Op.ne]: id }
          }
        });
        
        if (existingCategoria) {
          log.warn('updateCategoria rechazado', { status: 400, reason: "Ya existe una categoría con ese nombre" });
          return res.status(400).json({
            success: false,
            message: 'Ya existe una categoría con ese nombre'
          });
        }
      }

      await categoria.update(updateData);

      log.info('updateCategoria', { id: id });
      res.json({
        success: true,
        message: 'Categoría actualizada exitosamente',
        data: { categoria }
      });
    } catch (error) {
      log.error('updateCategoria falló', { message: error.message });
      next(error);
    }
  }

  // Eliminar categoría (baja lógica)
  async deleteCategoria(req, res, next) {
    try {
      const { id } = req.params;

      const categoria = await CategoriaProducto.findByPk(id);
      
      if (!categoria) {
        log.warn('deleteCategoria rechazado', { status: 404, reason: "Categoría no encontrada" });
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      await categoria.softDelete();

      log.info('deleteCategoria', { id: id });
      res.json({
        success: true,
        message: 'Categoría eliminada exitosamente'
      });
    } catch (error) {
      log.error('deleteCategoria falló', { message: error.message });
      next(error);
    }
  }

  // Restaurar categoría
  async restoreCategoria(req, res, next) {
    try {
      const { id } = req.params;

      const categoria = await CategoriaProducto.findByPk(id);
      
      if (!categoria) {
        log.warn('restoreCategoria rechazado', { status: 404, reason: "Categoría no encontrada" });
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      await categoria.restore();

      log.info('restoreCategoria', { id: id });
      res.json({
        success: true,
        message: 'Categoría restaurada exitosamente',
        data: { categoria }
      });
    } catch (error) {
      log.error('restoreCategoria falló', { message: error.message });
      next(error);
    }
  }

  // Activar categoría
  async activateCategoria(req, res, next) {
    try {
      const { id } = req.params;

      const categoria = await CategoriaProducto.findByPk(id);
      
      if (!categoria) {
        log.warn('activateCategoria rechazado', { status: 404, reason: "Categoría no encontrada" });
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      await categoria.activate();

      log.info('activateCategoria', { id: id });
      res.json({
        success: true,
        message: 'Categoría activada exitosamente',
        data: { categoria }
      });
    } catch (error) {
      log.error('activateCategoria falló', { message: error.message });
      next(error);
    }
  }

  // Desactivar categoría
  async deactivateCategoria(req, res, next) {
    try {
      const { id } = req.params;

      const categoria = await CategoriaProducto.findByPk(id);
      
      if (!categoria) {
        log.warn('deactivateCategoria rechazado', { status: 404, reason: "Categoría no encontrada" });
        return res.status(404).json({
          success: false,
          message: 'Categoría no encontrada'
        });
      }

      await categoria.deactivate();

      log.info('deactivateCategoria', { id: id });
      res.json({
        success: true,
        message: 'Categoría desactivada exitosamente',
        data: { categoria }
      });
    } catch (error) {
      log.error('deactivateCategoria falló', { message: error.message });
      next(error);
    }
  }

  // Obtener categorías activas
  async getActiveCategorias(req, res, next) {
    try {
      const categorias = await CategoriaProducto.findActive();

      res.json({
        success: true,
        data: {
          categorias,
          total: categorias.length
        }
      });
    } catch (error) {
      log.error('getActiveCategorias falló', { message: error.message });
      next(error);
    }
  }

  // Buscar categorías
  async searchCategorias(req, res, next) {
    try {
      const { search } = req.query;

      if (!search) {
        log.warn('searchCategorias rechazado', { status: 400, reason: "Se requiere el parámetro de búsqueda" });
        return res.status(400).json({
          success: false,
          message: 'Se requiere el parámetro de búsqueda'
        });
      }

      const categorias = await CategoriaProducto.findBySearch(search);

      res.json({
        success: true,
        data: {
          categorias,
          total: categorias.length,
          searchTerm: search
        }
      });
    } catch (error) {
      log.error('searchCategorias falló', { message: error.message });
      next(error);
    }
  }

  // Estadísticas de categorías
  async getCategoriaStats(req, res, next) {
    try {
      const totalCategorias = await CategoriaProducto.count({
        where: { baja_logica: false }
      });

      const categoriasActivas = await CategoriaProducto.count({
        where: { baja_logica: false }
      });

      const categoriasInactivas = await CategoriaProducto.count({
        where: { baja_logica: true }
      });

      const categoriasConDescripcion = await CategoriaProducto.count({
        where: { 
          baja_logica: false,
          descripcion: { [Op.ne]: null }
        }
      });

      const categoriasSinDescripcion = await CategoriaProducto.count({
        where: { 
          baja_logica: false,
          descripcion: null
        }
      });

      res.json({
        success: true,
        data: {
          totalCategorias,
          categoriasActivas,
          categoriasInactivas,
          categoriasConDescripcion,
          categoriasSinDescripcion
        }
      });
    } catch (error) {
      log.error('getCategoriaStats falló', { message: error.message });
      next(error);
    }
  }
}

module.exports = new CategoriaProductoController();
