const { Promotion, City, PromotionCity } = require('../../models');
const { Op } = require('sequelize');

class PromotionController {
  // Obtener todas las promociones
  async getAllPromotions(req, res, next) {
    try {
      const { 
        tipo_promocion, 
        activos = 'true',
        include_cities = 'false',
        search,
        page = 1,
        limit = 10
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      if (activos === 'true') {
        whereClause.baja_logica = false;
        // No agregamos filtros de fecha para incluir todas las promociones (activas, futuras y vencidas)
      } else if (activos === 'false') {
        whereClause.baja_logica = true;
      }
      
      // Filtrar por tipo
      if (tipo_promocion) {
        whereClause.tipo_promocion = tipo_promocion;
      }

      // Búsqueda por nombre o código
      if (search) {
        whereClause[Op.or] = [
          { nombre: { [Op.like]: `%${search}%` } },
          { codigo: { [Op.like]: `%${search}%` } }
        ];
      }

      const includeOptions = [];
      
      // Incluir ciudades si se solicita
      if (include_cities === 'true') {
        includeOptions.push({
          model: City,
          as: 'ciudades',
          through: { attributes: [] },
          where: { baja_logica: false },
          required: false // LEFT JOIN instead of INNER JOIN
        });
      }

      const offset = (page - 1) * limit;

      const { count, rows: promotions } = await Promotion.findAndCountAll({
        where: whereClause,
        include: includeOptions,
        order: [['created_at', 'DESC'], ['updated_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          promotions,
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

  // Obtener una promoción por ID
  async getPromotionById(req, res, next) {
    try {
      const { id } = req.params;
      const { include_cities = 'true' } = req.query;
      
      const includeOptions = [];
      
      if (include_cities === 'true') {
        includeOptions.push({
          model: City,
          as: 'ciudades',
          through: { attributes: [] },
          where: { baja_logica: false },
          required: false // LEFT JOIN instead of INNER JOIN
        });
      }
      
      const promotion = await Promotion.findByPk(id, {
        include: includeOptions
      });
      
      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promoción no encontrada'
        });
      }

      res.json({
        success: true,
        data: { promotion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nueva promoción
  async createPromotion(req, res, next) {
    try {
      const {
        nombre,
        codigo,
        descripcion,
        tipo_promocion,
        valor_descuento,
        fecha_inicio,
        fecha_fin,
        limite_uso = 0,
        compra_minima,
        descuento_maximo,
        cities = []
      } = req.body;

      // Verificar si el código ya existe
      const existingPromotion = await Promotion.findByCode(codigo);

      if (existingPromotion) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una promoción con ese código'
        });
      }

      // Crear la promoción
      const promotion = await Promotion.create({
        nombre,
        codigo,
        descripcion,
        tipo_promocion,
        valor_descuento,
        fecha_inicio,
        fecha_fin,
        limite_uso,
        compra_minima,
        descuento_maximo
      });

      // Asignar ciudades si se proporcionan
      if (cities && cities.length > 0) {
        // Verificar que todas las ciudades existan
        const existingCities = await City.findAll({
          where: {
            id: { [Op.in]: cities },
            baja_logica: false
          }
        });

        if (existingCities.length !== cities.length) {
          return res.status(400).json({
            success: false,
            message: 'Algunas ciudades no existen o están inactivas'
          });
        }

        // Asignar ciudades a la promoción
        await PromotionCity.syncPromotionCities(promotion.id, cities);
      }

      // Obtener la promoción con sus ciudades
      const promotionWithCities = await Promotion.findByPk(promotion.id, {
        include: [{
          model: City,
          as: 'ciudades',
          through: { attributes: [] }
        }]
      });

      res.status(201).json({
        success: true,
        message: 'Promoción creada exitosamente',
        data: { promotion: promotionWithCities }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar promoción
  async updatePromotion(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const { ciudades } = updateData;

      const promotion = await Promotion.findByPk(id);
      
      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promoción no encontrada'
        });
      }

      // Verificar si el nuevo código ya existe (si se está cambiando)
      if (updateData.codigo && updateData.codigo !== promotion.codigo) {
        const existingPromotion = await Promotion.findOne({
          where: { 
            codigo: updateData.codigo,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingPromotion) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe una promoción con ese código'
          });
        }
      }

      // Remover ciudades del updateData para manejarlo por separado
      delete updateData.ciudades;

      // Actualizar la promoción
      await promotion.update(updateData);

      // Actualizar ciudades si se proporcionan
      if (ciudades !== undefined) {
        if (Array.isArray(ciudades)) {
          // Verificar que todas las ciudades existan
          if (ciudades.length > 0) {
            const existingCities = await City.findAll({
              where: {
                id: { [Op.in]: ciudades },
                baja_logica: false
              }
            });

            if (existingCities.length !== ciudades.length) {
              return res.status(400).json({
                success: false,
                message: 'Algunas ciudades no existen o están inactivas'
              });
            }
          }

          // Sincronizar ciudades
          await PromotionCity.syncPromotionCities(promotion.id, ciudades);
        }
      }

      // Obtener la promoción actualizada con sus ciudades
      const updatedPromotion = await Promotion.findByPk(promotion.id, {
        include: [{
          model: City,
          as: 'ciudades',
          through: { attributes: [] }
        }]
      });

      res.json({
        success: true,
        message: 'Promoción actualizada exitosamente',
        data: { promotion: updatedPromotion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar promoción (baja lógica)
  async deletePromotion(req, res, next) {
    try {
      const { id } = req.params;

      const promotion = await Promotion.findByPk(id);
      
      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promoción no encontrada'
        });
      }

      await promotion.softDelete();

      res.json({
        success: true,
        message: 'Promoción eliminada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar promoción
  async restorePromotion(req, res, next) {
    try {
      const { id } = req.params;

      const promotion = await Promotion.findByPk(id);
      
      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promoción no encontrada'
        });
      }

      await promotion.restore();

      res.json({
        success: true,
        message: 'Promoción restaurada exitosamente',
        data: { promotion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener promociones activas (ahora incluye todas las promociones no eliminadas)
  async getActivePromotions(req, res, next) {
    try {
      const { include_cities = 'true' } = req.query;
      
      const includeOptions = [];
      
      if (include_cities === 'true') {
        includeOptions.push({
          model: City,
          as: 'ciudades',
          through: { attributes: [] },
          where: { baja_logica: false },
          required: false // LEFT JOIN instead of INNER JOIN
        });
      }

      // Usar el nuevo método que trae todas las promociones con las opciones de include
      const promotions = await Promotion.findAll({
        where: { baja_logica: false },
        include: includeOptions,
        order: [['fecha_inicio', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          promotions,
          total: promotions.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener promociones por ciudad
  async getPromotionsByCity(req, res, next) {
    try {
      const { city_id } = req.params;
      const { include_cities = 'false' } = req.query;

      const city = await City.findByPk(city_id);
      if (!city) {
        return res.status(404).json({
          success: false,
          message: 'Ciudad no encontrada'
        });
      }

      const includeOptions = [];
      
      if (include_cities === 'true') {
        includeOptions.push({
          model: City,
          as: 'ciudades',
          through: { attributes: [] },
          where: { baja_logica: false },
          required: false // LEFT JOIN instead of INNER JOIN
        });
      }

      const promotions = await Promotion.findAll({
        include: [{
          model: City,
          as: 'ciudades',
          through: { attributes: [] },
          where: { id: city_id }
        }],
        where: { baja_logica: false },
        order: [['fecha_inicio', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          promotions,
          total: promotions.length,
          city: city.toJSON()
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Validar código de promoción
  async validatePromotionCode(req, res, next) {
    try {
      const { codigo } = req.params;
      const { city_id } = req.query;

      const promotion = await Promotion.findByCode(codigo);
      
      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Código de promoción no válido'
        });
      }

      // Verificar si la promoción está activa
      if (!promotion.isActive()) {
        return res.status(400).json({
          success: false,
          message: 'La promoción no está activa'
        });
      }

      // Verificar si la promoción está disponible en la ciudad
      if (city_id) {
        const cityPromotion = await PromotionCity.findOne({
          where: {
            promotion_id: promotion.id,
            city_id: city_id
          }
        });

        if (!cityPromotion) {
          return res.status(400).json({
            success: false,
            message: 'La promoción no está disponible en esta ciudad'
          });
        }
      }

      res.json({
        success: true,
        message: 'Código de promoción válido',
        data: { promotion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener tipos de promoción disponibles
  async getPromotionTypes(req, res, next) {
    try {
      const types = ['porcentaje', 'monto_fijo', 'envio_gratis', 'descuento_especial'];

      res.json({
        success: true,
        data: { types }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de promociones
  async getPromotionStats(req, res, next) {
    try {
      const totalPromotions = await Promotion.count({
        where: { baja_logica: false }
      });

      const activePromotions = await Promotion.count({
        where: {
          baja_logica: false,
          fecha_inicio: { [Op.lte]: new Date() },
          fecha_fin: { [Op.gte]: new Date() }
        }
      });

      const expiredPromotions = await Promotion.count({
        where: {
          baja_logica: false,
          fecha_fin: { [Op.lt]: new Date() }
        }
      });

      const upcomingPromotions = await Promotion.count({
        where: {
          baja_logica: false,
          fecha_inicio: { [Op.gt]: new Date() }
        }
      });

      res.json({
        success: true,
        data: {
          totalPromotions,
          activePromotions,
          expiredPromotions,
          upcomingPromotions
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PromotionController();
