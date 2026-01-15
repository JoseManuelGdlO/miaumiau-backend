const { Promotion, City, PromotionCity, Inventario } = require('../../models');
const { Op } = require('sequelize');
const { query } = require('../../config/postgres');
const { mapCityNameToId } = require('../../utils/cityMapper');
const { aplicarLogicaDescuento, calcularTotalCarrito } = require('../descuentos/aplicarDescuentos');

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

      // 1. Consultar PostgreSQL solo para obtener la ciudad
      let ciudadNombre = null;
      try {
        const pgQuery = 'SELECT ciudad, productos FROM pedido_sesion WHERE session_id = $1';
        const result = await query(pgQuery, [telefono]);

        if (!result.rows || result.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'No se encontró una sesión activa para este teléfono'
          });
        }

        const sessionData = result.rows[0];
        
        // Obtener ciudad del campo ciudad directamente
        if (sessionData.ciudad) {
          ciudadNombre = sessionData.ciudad;
        } else if (sessionData.productos) {
          // Si no está en ciudad, intentar obtenerla del JSON de productos
          try {
            const productosData = typeof sessionData.productos === 'string' 
              ? JSON.parse(sessionData.productos) 
              : sessionData.productos;
            
            if (productosData && productosData.ciudad) {
              ciudadNombre = productosData.ciudad;
            }
          } catch (parseError) {
            // Si falla el parseo, continuar sin ciudad (se validará después)
          }
        }
      } catch (pgError) {
        console.error('Error consultando PostgreSQL:', pgError);
        return res.status(503).json({
          success: false,
          message: 'Error al consultar la base de datos de sesiones. Por favor, intenta de nuevo más tarde.'
        });
      }

      if (!ciudadNombre) {
        return res.status(400).json({
          success: false,
          message: 'No se pudo determinar la ciudad del usuario'
        });
      }

      // 2. Convertir nombre de ciudad a ID
      const ciudadId = await mapCityNameToId(ciudadNombre);
      if (!ciudadId) {
        return res.status(400).json({
          success: false,
          message: `La ciudad "${ciudadNombre}" no está registrada en el sistema`
        });
      }

      // 3. Buscar la promoción por código
      const promotion = await Promotion.findByCode(codigo);
      if (!promotion) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: 'Código de promoción no válido'
        });
      }

      // 4. Validar vigencia temporal (fecha_inicio <= hoy <= fecha_fin)
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
            ciudad_id: ciudadId
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
            ciudad_id: ciudadId
          }
        });
      }

      // 5. Validar aplicabilidad de ciudad
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
              ciudad_id: ciudadId
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
          ciudad_id: ciudadId
        }
      });

    } catch (error) {
      console.error('Error en validarPromocion:', error);
      next(error);
    }
  }

  // Aplicar código de promoción a productos en sesión
  async aplicarCodigo(req, res, next) {
    try {
      const { telefono, logica_aplicar } = req.body;

      // Validar parámetros requeridos
      if (!telefono) {
        return res.status(400).json({
          success: false,
          message: 'El teléfono es requerido'
        });
      }

      if (!logica_aplicar) {
        return res.status(400).json({
          success: false,
          message: 'La lógica de aplicación es requerida'
        });
      }

      const { tipo_accion, valor, unidad_valor, condiciones, efecto } = logica_aplicar;

      if (!tipo_accion) {
        return res.status(400).json({
          success: false,
          message: 'El tipo de acción es requerido'
        });
      }

      const tiposAccionValidos = ['descuento_global', 'descuento_producto', 'segunda_unidad', 'producto_regalo'];
      if (!tiposAccionValidos.includes(tipo_accion)) {
        return res.status(400).json({
          success: false,
          message: `Tipo de acción inválido. Debe ser uno de: ${tiposAccionValidos.join(', ')}`
        });
      }

      // 1. Consultar PostgreSQL para obtener productos actuales
      let sessionData;
      try {
        const pgQuery = 'SELECT session_id, productos FROM pedido_sesion WHERE session_id = $1';
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

      // 2. Parsear el JSON de productos
      let productosData;
      try {
        if (typeof sessionData.productos === 'string') {
          productosData = JSON.parse(sessionData.productos);
        } else {
          productosData = sessionData.productos;
        }

        if (!productosData || !productosData.productos || !Array.isArray(productosData.productos)) {
          return res.status(400).json({
            success: false,
            message: 'La estructura de productos en la sesión no es válida'
          });
        }
      } catch (parseError) {
        console.error('Error parseando productos:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Error al procesar los datos de la sesión'
        });
      }

      const productos = productosData.productos;
      const totalAntes = calcularTotalCarrito(productos);

      // 3. Aplicar la lógica según el tipo de acción usando el módulo de descuentos
      const resultado = aplicarLogicaDescuento(productos, logica_aplicar);
      
      if (!resultado.aplicado && resultado.mensaje && resultado.mensaje.includes('Tipo de acción no soportado')) {
        return res.status(400).json({
          success: false,
          message: resultado.mensaje
        });
      }

      if (!resultado.aplicado) {
        return res.status(400).json({
          success: false,
          message: resultado.mensaje || 'No se pudo aplicar la promoción',
          data: {
            productos: productos,
            condiciones_cumplidas: false
          }
        });
      }

      // 4. Si es producto_regalo, buscar el ID en inventarios para productos sin ID
      let productosModificados = resultado.productos;
      if (tipo_accion === 'producto_regalo' && logica_aplicar.efecto && logica_aplicar.efecto.producto_target_keywords) {
        const keywords = logica_aplicar.efecto.producto_target_keywords;
        
        if (keywords && keywords.length > 0) {
          // Buscar productos regalo que no tengan ID (tanto si se agregaron como si ya existían)
          const productosRegaloSinId = productosModificados.filter(p => 
            (p.es_regalo === true || p.precio === 0) && 
            (p.id === null || p.id === undefined)
          );
          
          if (productosRegaloSinId.length > 0) {
            try {
              // Construir condiciones de búsqueda con todos los keywords
              // Buscar productos que contengan cualquiera de los keywords en el nombre
              const condicionesNombre = keywords.map(keyword => ({
                nombre: { [Op.like]: `%${keyword.trim()}%` }
              }));
              
              const whereClause = {
                baja_logica: false,
                [Op.or]: condicionesNombre
              };
              
              // Buscar el producto en inventarios
              let productoInventario = await Inventario.findOne({
                where: whereClause,
                order: [['nombre', 'ASC']]
              });
              
              // Si no se encuentra, intentar buscar con el primer keyword completo
              if (!productoInventario) {
                const primerKeyword = keywords[0]?.trim();
                if (primerKeyword) {
                  productoInventario = await Inventario.findOne({
                    where: {
                      baja_logica: false,
                      nombre: { [Op.like]: `%${primerKeyword}%` }
                    },
                    order: [['nombre', 'ASC']]
                  });
                }
              }
              
              // Asignar el ID a todos los productos regalo sin ID
              if (productoInventario) {
                productosRegaloSinId.forEach(producto => {
                  producto.id = productoInventario.id;
                  // Actualizar el nombre si no coincide exactamente
                  if (!producto.nombre || producto.nombre !== productoInventario.nombre) {
                    producto.nombre = productoInventario.nombre;
                  }
                });
              }
            } catch (searchError) {
              console.error('Error buscando producto en inventarios:', searchError);
              // Continuar sin asignar ID si hay error en la búsqueda
            }
          }
        }
      }

      // 5. Actualizar productos en PostgreSQL
      const totalDespues = calcularTotalCarrito(productosModificados);
      
      // Preservar otros campos del objeto original
      const productosActualizados = {
        ...productosData,
        productos: productosModificados
      };

      try {
        const updateQuery = 'UPDATE pedido_sesion SET productos = $1 WHERE session_id = $2';
        await query(updateQuery, [JSON.stringify(productosActualizados), telefono]);
      } catch (updateError) {
        console.error('Error actualizando PostgreSQL:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Error al actualizar los productos en la sesión'
        });
      }

      // 6. Retornar respuesta con productos modificados
      res.json({
        success: true,
        message: 'Promoción aplicada exitosamente',
        data: {
          productos_modificados: productosModificados,
          total_antes: Math.round(totalAntes * 100) / 100,
          total_despues: Math.round(totalDespues * 100) / 100,
          descuento_total: resultado.descuento_total || (totalAntes - totalDespues),
          debug: {
            tipo_accion: tipo_accion,
            productos_afectados: productosModificados.filter(p => 
              p.descuento_aplicado || p.descuento_segunda_unidad || p.es_regalo
            ).length,
            condiciones_cumplidas: true,
            producto_agregado: resultado.producto_agregado || false
          }
        }
      });

    } catch (error) {
      console.error('Error en aplicarCodigo:', error);
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
