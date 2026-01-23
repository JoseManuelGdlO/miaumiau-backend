const { City } = require('../../models');
const { Op } = require('sequelize');
const { mapCityNameToId, validateAndGetCity } = require('../../utils/cityMapper');

class CityController {
  // Obtener todas las ciudades
  async getAllCities(req, res, next) {
    try {
      const { 
        departamento, 
        estado_inicial, 
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
      
      // Filtrar por departamento
      if (departamento) {
        whereClause.departamento = departamento;
      }
      
      // Filtrar por estado
      if (estado_inicial) {
        whereClause.estado_inicial = estado_inicial;
      }

      // Búsqueda por nombre o departamento
      if (search) {
        whereClause[Op.or] = [
          { nombre: { [Op.like]: `%${search}%` } },
          { departamento: { [Op.like]: `%${search}%` } },
          { manager: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: cities } = await City.findAndCountAll({
        where: whereClause,
        order: [['created_at', 'DESC'], ['updated_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          cities,
          pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener una ciudad por ID o nombre
  async getCityById(req, res, next) {
    try {
      const { id } = req.params;
      
      // Intentar convertir nombre a ID si es necesario
      const cityId = await mapCityNameToId(id);
      if (!cityId) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }
      
      // Validar que la ciudad existe (puede ser que el ID sea válido pero la ciudad no exista)
      const city = await City.findByPk(cityId);
      
      if (!city) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }

      res.json({
        success: true,
        data: { city }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nueva ciudad
  async createCity(req, res, next) {
    try {
      const {
        nombre,
        departamento,
        direccion_operaciones,
        estado_inicial = 'activa',
        numero_zonas_entrega = 1,
        area_cobertura,
        tiempo_promedio_entrega,
        horario_atencion,
        manager,
        telefono,
        email_contacto,
        notas_adicionales,
        max_pedidos_por_horario = 5,
        dias_trabajo = [0, 1, 2, 3, 4, 5, 6]
      } = req.body;

      // Verificar si la ciudad ya existe
      const existingCity = await City.findByNameAndDepartment(nombre, departamento);

      if (existingCity) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una ciudad con ese nombre en ese departamento'
        });
      }

      // Validar dias_trabajo si se proporciona
      if (dias_trabajo !== undefined && dias_trabajo !== null) {
        if (!Array.isArray(dias_trabajo) || dias_trabajo.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'dias_trabajo debe ser un array con al menos un día'
          });
        }
        const validDays = [0, 1, 2, 3, 4, 5, 6];
        for (const day of dias_trabajo) {
          if (!validDays.includes(day)) {
            return res.status(400).json({
              success: false,
              message: 'dias_trabajo debe contener solo valores entre 0 y 6 (0=domingo, 6=sábado)'
            });
          }
        }
      }

      // Validar max_pedidos_por_horario si se proporciona
      if (max_pedidos_por_horario !== undefined && max_pedidos_por_horario !== null) {
        if (typeof max_pedidos_por_horario !== 'number' || max_pedidos_por_horario < 1 || max_pedidos_por_horario > 100) {
          return res.status(400).json({
            success: false,
            message: 'max_pedidos_por_horario debe ser un número entre 1 y 100'
          });
        }
      }

      const city = await City.create({
        nombre,
        departamento,
        direccion_operaciones,
        estado_inicial,
        numero_zonas_entrega,
        area_cobertura,
        tiempo_promedio_entrega,
        horario_atencion,
        manager,
        telefono,
        email_contacto,
        notas_adicionales,
        max_pedidos_por_horario,
        dias_trabajo
      });

      res.status(201).json({
        success: true,
        message: 'Ciudad creada exitosamente',
        data: { city }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar ciudad
  async updateCity(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Intentar convertir nombre a ID si es necesario
      const cityId = await mapCityNameToId(id);
      if (!cityId) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }

      const city = await City.findByPk(cityId);
      
      if (!city) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }

      // Verificar si el nuevo nombre y departamento ya existen (si se están cambiando)
      if (updateData.nombre && updateData.departamento) {
        const existingCity = await City.findOne({
          where: { 
            nombre: updateData.nombre,
            departamento: updateData.departamento,
            id: { [Op.ne]: cityId }
          }
        });
        
        if (existingCity) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe una ciudad con ese nombre en ese departamento'
          });
        }
      }

      // Validar dias_trabajo si se proporciona en la actualización
      if (updateData.dias_trabajo !== undefined && updateData.dias_trabajo !== null) {
        if (!Array.isArray(updateData.dias_trabajo) || updateData.dias_trabajo.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'dias_trabajo debe ser un array con al menos un día'
          });
        }
        const validDays = [0, 1, 2, 3, 4, 5, 6];
        for (const day of updateData.dias_trabajo) {
          if (!validDays.includes(day)) {
            return res.status(400).json({
              success: false,
              message: 'dias_trabajo debe contener solo valores entre 0 y 6 (0=domingo, 6=sábado)'
            });
          }
        }
      }

      // Validar max_pedidos_por_horario si se proporciona en la actualización
      if (updateData.max_pedidos_por_horario !== undefined && updateData.max_pedidos_por_horario !== null) {
        if (typeof updateData.max_pedidos_por_horario !== 'number' || updateData.max_pedidos_por_horario < 1 || updateData.max_pedidos_por_horario > 100) {
          return res.status(400).json({
            success: false,
            message: 'max_pedidos_por_horario debe ser un número entre 1 y 100'
          });
        }
      }

      await city.update(updateData);

      res.json({
        success: true,
        message: 'Ciudad actualizada exitosamente',
        data: { city }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar ciudad (baja lógica)
  async deleteCity(req, res, next) {
    try {
      const { id } = req.params;

      // Intentar convertir nombre a ID si es necesario
      const cityId = await mapCityNameToId(id);
      if (!cityId) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }

      const city = await City.findByPk(cityId);
      
      if (!city) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }

      await city.softDelete();

      res.json({
        success: true,
        message: 'Ciudad eliminada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar ciudad
  async restoreCity(req, res, next) {
    try {
      const { id } = req.params;

      // Intentar convertir nombre a ID si es necesario
      const cityId = await mapCityNameToId(id);
      if (!cityId) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }

      const city = await City.findByPk(cityId);
      
      if (!city) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }

      await city.restore();

      res.json({
        success: true,
        message: 'Ciudad restaurada exitosamente',
        data: { city }
      });
    } catch (error) {
      next(error);
    }
  }

  // Activar ciudad
  async activateCity(req, res, next) {
    try {
      const { id } = req.params;

      // Intentar convertir nombre a ID si es necesario
      const cityId = await mapCityNameToId(id);
      if (!cityId) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }

      const city = await City.findByPk(cityId);
      
      if (!city) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }

      await city.activate();

      res.json({
        success: true,
        message: 'Ciudad activada exitosamente',
        data: { city }
      });
    } catch (error) {
      next(error);
    }
  }

  // Desactivar ciudad
  async deactivateCity(req, res, next) {
    try {
      const { id } = req.params;

      // Intentar convertir nombre a ID si es necesario
      const cityId = await mapCityNameToId(id);
      if (!cityId) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }

      const city = await City.findByPk(cityId);
      
      if (!city) {
        return res.status(404).json({
          success: false,
          message: `Ciudad "${id}" no encontrada`
        });
      }

      await city.deactivate();

      res.json({
        success: true,
        message: 'Ciudad desactivada exitosamente',
        data: { city }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener ciudades por departamento
  async getCitiesByDepartment(req, res, next) {
    try {
      const { departamento } = req.params;

      const cities = await City.findByDepartment(departamento);

      res.json({
        success: true,
        data: {
          cities,
          total: cities.length,
          departamento
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener ciudades por estado
  async getCitiesByStatus(req, res, next) {
    try {
      const { estado } = req.params;

      const cities = await City.findByStatus(estado);

      res.json({
        success: true,
        data: {
          cities,
          total: cities.length,
          estado
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener ciudades activas
  async getActiveCities(req, res, next) {
    try {
      const cities = await City.findActive();

      res.json({
        success: true,
        data: {
          cities,
          total: cities.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener departamentos disponibles
  async getDepartments(req, res, next) {
    try {
      const departments = await City.findAll({
        attributes: ['departamento'],
        where: { baja_logica: false },
        group: ['departamento'],
        order: [['departamento', 'ASC']]
      });

      const departmentList = departments.map(dept => dept.departamento);

      res.json({
        success: true,
        data: { departments: departmentList }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener estados disponibles
  async getStatuses(req, res, next) {
    try {
      const statuses = ['activa', 'inactiva', 'en_construccion', 'mantenimiento', 'suspendida'];

      res.json({
        success: true,
        data: { statuses }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de ciudades
  async getCityStats(req, res, next) {
    try {
      const totalCities = await City.count({
        where: { baja_logica: false }
      });

      const activeCities = await City.count({
        where: { 
          baja_logica: false,
          estado_inicial: 'activa'
        }
      });

      const inactiveCities = await City.count({
        where: { 
          baja_logica: false,
          estado_inicial: { [Op.ne]: 'activa' }
        }
      });

      const totalZones = await City.sum('numero_zonas_entrega', {
        where: { baja_logica: false }
      });

      const avgDeliveryTime = await City.findOne({
        attributes: [
          [City.sequelize.fn('AVG', City.sequelize.col('tiempo_promedio_entrega')), 'avg_time']
        ],
        where: { 
          baja_logica: false,
          tiempo_promedio_entrega: { [Op.ne]: null }
        }
      });

      res.json({
        success: true,
        data: {
          totalCities,
          activeCities,
          inactiveCities,
          totalZones,
          averageDeliveryTime: avgDeliveryTime ? Math.round(avgDeliveryTime.dataValues.avg_time) : 0
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CityController();
