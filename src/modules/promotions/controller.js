const { Promotion, City, PromotionCity } = require('../../models');
const { Op } = require('sequelize');
const { query } = require('../../config/postgres');
const { mapCityNameToId } = require('../../utils/cityMapper');

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

  // Validar promoción con datos de PostgreSQL (n8n)
  async validarPromocion(req, res, next) {
    try {
      const { telefono, codigo } = req.body;

      // Validar que se proporcionen los parámetros requeridos
      if (!telefono) {
        return res.status(400).json({
          success: false,
          message: 'El teléfono es requerido'
        });
      }

      if (!codigo) {
        return res.status(400).json({
          success: false,
          message: 'El código de promoción es requerido'
        });
      }

      // 1. Consultar PostgreSQL para obtener datos de la sesión
      let sessionData;
      try {
        const pgQuery = 'SELECT session_id, productos, ciudad FROM pedido_sesion WHERE session_id = $1';
        const result = await query(pgQuery, [telefono]);

        if (!result.rows || result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'No se encontró una sesión activa para este teléfono'
          });
        }

        sessionData = result.rows[0];
      } catch (pgError) {
        console.error('Error consultando PostgreSQL:', pgError);
        return res.status(503).json({
          success: false,
          message: 'Error al consultar la base de datos de sesiones. Por favor, intenta de nuevo más tarde.'
        });
      }

      // 2. Parsear el JSON string de productos
      let productos = [];
      let ciudadNombre = null;

      try {
        // El campo productos puede venir como JSON string o ya parseado
        if (typeof sessionData.productos === 'string') {
          const productosData = JSON.parse(sessionData.productos);
          // Si el JSON contiene un objeto con la propiedad productos
          if (productosData.productos && Array.isArray(productosData.productos)) {
            productos = productosData.productos;
            ciudadNombre = productosData.ciudad || sessionData.ciudad;
          } else if (Array.isArray(productosData)) {
            productos = productosData;
            ciudadNombre = sessionData.ciudad;
          } else {
            productos = [];
            ciudadNombre = sessionData.ciudad;
          }
        } else if (Array.isArray(sessionData.productos)) {
          productos = sessionData.productos;
          ciudadNombre = sessionData.ciudad;
        } else {
          // Si productos es un objeto, intentar extraer el array
          if (sessionData.productos && sessionData.productos.productos) {
            productos = sessionData.productos.productos;
            ciudadNombre = sessionData.productos.ciudad || sessionData.ciudad;
          } else {
            productos = [];
            ciudadNombre = sessionData.ciudad;
          }
        }
      } catch (parseError) {
        console.error('Error parseando productos:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Error al procesar los datos de la sesión'
        });
      }

      if (!ciudadNombre) {
        return res.status(400).json({
          success: false,
          message: 'No se pudo determinar la ciudad del usuario'
        });
      }

      // 3. Convertir nombre de ciudad a ID
      const ciudadId = await mapCityNameToId(ciudadNombre);
      if (!ciudadId) {
        return res.status(400).json({
          success: false,
          message: `La ciudad "${ciudadNombre}" no está registrada en el sistema`
        });
      }

      // 4. Buscar la promoción por código
      const promotion = await Promotion.findByCode(codigo);
      if (!promotion) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: 'Código de promoción no válido'
        });
      }

      // 5. Validar vigencia temporal (fecha_inicio <= hoy <= fecha_fin)
      const fechaActual = new Date();
      const fechaInicio = new Date(promotion.fecha_inicio);
      const fechaFin = new Date(promotion.fecha_fin);

      if (fechaActual < fechaInicio) {
        return res.status(400).json({
          success: true,
          valid: false,
          message: `La promoción aún no está vigente. Inicia el ${fechaInicio.toLocaleDateString('es-MX')}`,
          data: {
            promotion: {
              id: promotion.id,
              nombre: promotion.nombre,
              codigo: promotion.codigo,
              fecha_inicio: promotion.fecha_inicio,
              fecha_fin: promotion.fecha_fin
            },
            ciudad_usuario: ciudadNombre,
            ciudad_id: ciudadId,
            productos: productos
          }
        });
      }

      if (fechaActual > fechaFin) {
        return res.status(400).json({
          success: true,
          valid: false,
          message: `La promoción ha expirado. Finalizó el ${fechaFin.toLocaleDateString('es-MX')}`,
          data: {
            promotion: {
              id: promotion.id,
              nombre: promotion.nombre,
              codigo: promotion.codigo,
              fecha_inicio: promotion.fecha_inicio,
              fecha_fin: promotion.fecha_fin
            },
            ciudad_usuario: ciudadNombre,
            ciudad_id: ciudadId,
            productos: productos
          }
        });
      }

      // 6. Validar aplicabilidad de ciudad
      // Si la promoción tiene ciudades asociadas, verificar que la ciudad del usuario esté incluida
      const cityPromotions = await PromotionCity.findAll({
        where: {
          promotion_id: promotion.id
        }
      });

      // Si hay ciudades asociadas, la promoción solo aplica a esas ciudades
      if (cityPromotions.length > 0) {
        const ciudadesAplicables = cityPromotions.map(cp => cp.city_id);
        if (!ciudadesAplicables.includes(ciudadId)) {
          return res.status(400).json({
            success: true,
            valid: false,
            message: 'La promoción no está disponible en tu ciudad',
            data: {
              promotion: {
                id: promotion.id,
                nombre: promotion.nombre,
                codigo: promotion.codigo
              },
              ciudad_usuario: ciudadNombre,
              ciudad_id: ciudadId,
              productos: productos
            }
          });
        }
      }

      // Si llegamos aquí, la promoción es válida
      res.json({
        success: true,
        valid: true,
        message: 'Código de promoción válido',
        data: {
          promotion: promotion.toJSON(),
          ciudad_usuario: ciudadNombre,
          ciudad_id: ciudadId,
          productos: productos
        }
      });

    } catch (error) {
      console.error('Error en validarPromocion:', error);
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
