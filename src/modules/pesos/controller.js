const { Peso } = require('../../models');
const { Op } = require('sequelize');

const { Logger } = require('../../utils/logger');

const log = new Logger('Pesos');

class PesoController {
  // Obtener todos los pesos
  async getAllPesos(req, res, next) {
    try {
      const { 
        unidad_medida, 
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
      
      // Filtrar por unidad de medida
      if (unidad_medida) {
        whereClause.unidad_medida = unidad_medida;
      }

      // Búsqueda por cantidad
      if (search) {
        whereClause.cantidad = {
          [Op.eq]: parseFloat(search)
        };
      }

      const offset = (page - 1) * limit;

      const { count, rows: pesos } = await Peso.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'ASC'], ['updatedAt', 'ASC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          pesos,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      log.error('getAllPesos falló', { message: error.message });
      next(error);
    }
  }

  // Obtener un peso por ID
  async getPesoById(req, res, next) {
    try {
      const { id } = req.params;
      
      const peso = await Peso.findByPk(id);
      
      if (!peso) {
        return res.status(404).json({
          success: false,
          message: 'Peso no encontrado'
        });
      }

      res.json({
        success: true,
        data: { peso }
      });
    } catch (error) {
      log.error('getPesoById falló', { message: error.message });
      next(error);
    }
  }

  // Crear nuevo peso
  async createPeso(req, res, next) {
    try {
      const {
        cantidad,
        unidad_medida
      } = req.body;

      // Verificar si ya existe un peso con la misma cantidad y unidad
      const existingPeso = await Peso.findOne({
        where: { 
          cantidad: parseFloat(cantidad),
          unidad_medida,
          baja_logica: false
        }
      });

      if (existingPeso) {
        log.warn('createPeso rechazado', { status: 400, reason: "Ya existe un peso con esa cantidad y unidad de medida" });
        return res.status(400).json({
          success: false,
          message: 'Ya existe un peso con esa cantidad y unidad de medida'
        });
      }

      const peso = await Peso.create({
        cantidad: parseFloat(cantidad),
        unidad_medida
      });

      log.info('createPeso', { id: peso.id });
      res.status(201).json({
        success: true,
        message: 'Peso creado exitosamente',
        data: { peso }
      });
    } catch (error) {
      log.error('createPeso falló', { message: error.message });
      next(error);
    }
  }

  // Actualizar peso
  async updatePeso(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const peso = await Peso.findByPk(id);
      
      if (!peso) {
        log.warn('updatePeso rechazado', { status: 404, reason: "Peso no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Peso no encontrado'
        });
      }

      // Verificar si el nuevo peso ya existe (si se están cambiando cantidad o unidad)
      if (updateData.cantidad && updateData.unidad_medida) {
        const existingPeso = await Peso.findOne({
          where: { 
            cantidad: parseFloat(updateData.cantidad),
            unidad_medida: updateData.unidad_medida,
            id: { [Op.ne]: id },
            baja_logica: false
          }
        });
        
        if (existingPeso) {
          log.warn('updatePeso rechazado', { status: 400, reason: "Ya existe un peso con esa cantidad y unidad de medida" });
          return res.status(400).json({
            success: false,
            message: 'Ya existe un peso con esa cantidad y unidad de medida'
          });
        }
      }

      // Convertir cantidad a número si se está actualizando
      if (updateData.cantidad) {
        updateData.cantidad = parseFloat(updateData.cantidad);
      }

      await peso.update(updateData);

      log.info('updatePeso', { id: id });
      res.json({
        success: true,
        message: 'Peso actualizado exitosamente',
        data: { peso }
      });
    } catch (error) {
      log.error('updatePeso falló', { message: error.message });
      next(error);
    }
  }

  // Eliminar peso (baja lógica)
  async deletePeso(req, res, next) {
    try {
      const { id } = req.params;

      const peso = await Peso.findByPk(id);
      
      if (!peso) {
        log.warn('deletePeso rechazado', { status: 404, reason: "Peso no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Peso no encontrado'
        });
      }

      await peso.softDelete();

      log.info('deletePeso', { id: id });
      res.json({
        success: true,
        message: 'Peso eliminado exitosamente'
      });
    } catch (error) {
      log.error('deletePeso falló', { message: error.message });
      next(error);
    }
  }

  // Restaurar peso
  async restorePeso(req, res, next) {
    try {
      const { id } = req.params;

      const peso = await Peso.findByPk(id);
      
      if (!peso) {
        log.warn('restorePeso rechazado', { status: 404, reason: "Peso no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Peso no encontrado'
        });
      }

      await peso.restore();

      log.info('restorePeso', { id: id });
      res.json({
        success: true,
        message: 'Peso restaurado exitosamente',
        data: { peso }
      });
    } catch (error) {
      log.error('restorePeso falló', { message: error.message });
      next(error);
    }
  }

  // Activar peso
  async activatePeso(req, res, next) {
    try {
      const { id } = req.params;

      const peso = await Peso.findByPk(id);
      
      if (!peso) {
        log.warn('activatePeso rechazado', { status: 404, reason: "Peso no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Peso no encontrado'
        });
      }

      await peso.activate();

      log.info('activatePeso', { id: id });
      res.json({
        success: true,
        message: 'Peso activado exitosamente',
        data: { peso }
      });
    } catch (error) {
      log.error('activatePeso falló', { message: error.message });
      next(error);
    }
  }

  // Desactivar peso
  async deactivatePeso(req, res, next) {
    try {
      const { id } = req.params;

      const peso = await Peso.findByPk(id);
      
      if (!peso) {
        log.warn('deactivatePeso rechazado', { status: 404, reason: "Peso no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Peso no encontrado'
        });
      }

      await peso.deactivate();

      log.info('deactivatePeso', { id: id });
      res.json({
        success: true,
        message: 'Peso desactivado exitosamente',
        data: { peso }
      });
    } catch (error) {
      log.error('deactivatePeso falló', { message: error.message });
      next(error);
    }
  }

  // Obtener pesos por unidad de medida
  async getPesosByUnidad(req, res, next) {
    try {
      const { unidad } = req.params;

      const pesos = await Peso.findByUnidad(unidad);

      res.json({
        success: true,
        data: {
          pesos,
          total: pesos.length,
          unidad
        }
      });
    } catch (error) {
      log.error('getPesosByUnidad falló', { message: error.message });
      next(error);
    }
  }

  // Obtener pesos activos
  async getActivePesos(req, res, next) {
    try {
      const pesos = await Peso.findActive();

      res.json({
        success: true,
        data: {
          pesos,
          total: pesos.length
        }
      });
    } catch (error) {
      log.error('getActivePesos falló', { message: error.message });
      next(error);
    }
  }

  // Obtener unidades disponibles
  async getUnidadesDisponibles(req, res, next) {
    try {
      const unidades = Peso.getUnidadesDisponibles();

      res.json({
        success: true,
        data: { unidades }
      });
    } catch (error) {
      log.error('getUnidadesDisponibles falló', { message: error.message });
      next(error);
    }
  }

  // Obtener pesos por rango
  async getPesosByRange(req, res, next) {
    try {
      const { min, max } = req.query;

      if (!min || !max) {
        log.warn('getPesosByRange rechazado', { status: 400, reason: "Se requieren los parámetros min y max" });
        return res.status(400).json({
          success: false,
          message: 'Se requieren los parámetros min y max'
        });
      }

      const pesos = await Peso.findByRange(parseFloat(min), parseFloat(max));

      res.json({
        success: true,
        data: {
          pesos,
          total: pesos.length,
          range: { min: parseFloat(min), max: parseFloat(max) }
        }
      });
    } catch (error) {
      log.error('getPesosByRange falló', { message: error.message });
      next(error);
    }
  }

  // Estadísticas de pesos
  async getPesoStats(req, res, next) {
    try {
      const totalPesos = await Peso.count({
        where: { baja_logica: false }
      });

      const pesosByUnidad = await Peso.findAll({
        attributes: [
          'unidad_medida',
          [Peso.sequelize.fn('COUNT', Peso.sequelize.col('id')), 'count']
        ],
        where: { baja_logica: false },
        group: ['unidad_medida'],
        order: [['unidad_medida', 'ASC']]
      });

      const minCantidad = await Peso.min('cantidad', {
        where: { baja_logica: false }
      });

      const maxCantidad = await Peso.max('cantidad', {
        where: { baja_logica: false }
      });

      const avgCantidad = await Peso.findOne({
        attributes: [
          [Peso.sequelize.fn('AVG', Peso.sequelize.col('cantidad')), 'avg_cantidad']
        ],
        where: { baja_logica: false }
      });

      res.json({
        success: true,
        data: {
          totalPesos,
          pesosByUnidad,
          minCantidad,
          maxCantidad,
          averageCantidad: avgCantidad ? Math.round(avgCantidad.dataValues.avg_cantidad * 100) / 100 : 0
        }
      });
    } catch (error) {
      log.error('getPesoStats falló', { message: error.message });
      next(error);
    }
  }
}

module.exports = new PesoController();
