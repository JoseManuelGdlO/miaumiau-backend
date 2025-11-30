const { Inventario, Peso, CategoriaProducto, City, Proveedor } = require('../../models');
const { Op } = require('sequelize');
const { applyCityFilter } = require('../../utils/cityFilter');

class InventarioController {
  // Obtener todos los inventarios
  async getAllInventarios(req, res, next) {
    try {
      const { 
        categoria,
        ciudad,
        proveedor,
        peso,
        activos = 'true',
        low_stock = 'false',
        search,
        min_price,
        max_price,
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
      
      // Filtrar por categoría
      if (categoria) {
        whereClause.fkid_categoria = categoria;
      }
      
      // Filtrar por ciudad (si viene en query params)
      if (ciudad) {
        whereClause.fkid_ciudad = ciudad;
      }

      // Aplicar filtro de ciudad según el usuario autenticado
      // Si el usuario tiene ciudad asignada, solo puede ver inventario de su ciudad
      // Si no tiene ciudad asignada, puede ver todo el inventario
      applyCityFilter(req, whereClause, 'fkid_ciudad');
      
      // Filtrar por proveedor
      if (proveedor) {
        whereClause.fkid_proveedor = proveedor;
      }
      
      // Filtrar por peso
      if (peso) {
        whereClause.fkid_peso = peso;
      }

      // Filtrar por stock bajo
      if (low_stock === 'true') {
        whereClause[Op.and] = [
          { stock_inicial: { [Op.lte]: Op.col('stock_minimo') } }
        ];
      }

      // Filtrar por rango de precios
      if (min_price && max_price) {
        whereClause.precio_venta = {
          [Op.between]: [parseFloat(min_price), parseFloat(max_price)]
        };
      }

      // Búsqueda por nombre, SKU o descripción
      if (search) {
        whereClause[Op.or] = [
          { nombre: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } },
          { descripcion: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: inventarios } = await Inventario.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Peso,
            as: 'peso',
            attributes: ['id', 'cantidad', 'unidad_medida']
          },
          {
            model: CategoriaProducto,
            as: 'categoria',
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Proveedor,
            as: 'proveedor',
            attributes: ['id', 'nombre', 'correo', 'telefono']
          }
        ],
        order: [['created_at', 'DESC'], ['updated_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          inventarios,
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

  // Obtener un inventario por ID
  async getInventarioById(req, res, next) {
    try {
      const { id } = req.params;
      
      const inventario = await Inventario.findByPk(id, {
        include: [
          {
            model: Peso,
            as: 'peso',
            attributes: ['id', 'cantidad', 'unidad_medida']
          },
          {
            model: CategoriaProducto,
            as: 'categoria',
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Proveedor,
            as: 'proveedor',
            attributes: ['id', 'nombre', 'correo', 'telefono']
          }
        ]
      });
      
      if (!inventario) {
        return res.status(404).json({
          success: false,
          message: 'Inventario no encontrado'
        });
      }

      // Verificar que el usuario tenga acceso a este inventario
      const userCityId = req.user?.ciudad_id || req.user?.ciudad?.id;
      if (userCityId !== null && inventario.fkid_ciudad !== userCityId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver este inventario'
        });
      }

      res.json({
        success: true,
        data: { inventario }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo inventario
  async createInventario(req, res, next) {
    try {
      const {
        nombre,
        sku,
        fkid_peso,
        fkid_categoria,
        fkid_ciudad,
        descripcion,
        stock_inicial = 0,
        stock_minimo = 0,
        stock_maximo = 1000,
        costo_unitario,
        precio_venta,
        fkid_proveedor
      } = req.body;

      // Verificar si el SKU ya existe
      const existingInventario = await Inventario.findBySKU(sku);

      if (existingInventario) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un inventario con ese SKU'
        });
      }

      // Verificar que las relaciones existan
      const peso = await Peso.findByPk(fkid_peso);
      if (!peso) {
        return res.status(400).json({
          success: false,
          message: 'El peso especificado no existe'
        });
      }

      const categoria = await CategoriaProducto.findByPk(fkid_categoria);
      if (!categoria) {
        return res.status(400).json({
          success: false,
          message: 'La categoría especificada no existe'
        });
      }

      const ciudad = await City.findByPk(fkid_ciudad);
      if (!ciudad) {
        return res.status(400).json({
          success: false,
          message: 'La ciudad especificada no existe'
        });
      }

      const proveedor = await Proveedor.findByPk(fkid_proveedor);
      if (!proveedor) {
        return res.status(400).json({
          success: false,
          message: 'El proveedor especificado no existe'
        });
      }

      const inventario = await Inventario.create({
        nombre,
        sku,
        fkid_peso,
        fkid_categoria,
        fkid_ciudad,
        descripcion,
        stock_inicial,
        stock_minimo,
        stock_maximo,
        costo_unitario,
        precio_venta,
        fkid_proveedor
      });

      // Obtener el inventario creado con sus relaciones
      const inventarioCompleto = await Inventario.findByPk(inventario.id, {
        include: [
          {
            model: Peso,
            as: 'peso',
            attributes: ['id', 'cantidad', 'unidad_medida']
          },
          {
            model: CategoriaProducto,
            as: 'categoria',
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Proveedor,
            as: 'proveedor',
            attributes: ['id', 'nombre', 'correo', 'telefono']
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Inventario creado exitosamente',
        data: { inventario: inventarioCompleto }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar inventario
  async updateInventario(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const inventario = await Inventario.findByPk(id);
      
      if (!inventario) {
        return res.status(404).json({
          success: false,
          message: 'Inventario no encontrado'
        });
      }

      // Verificar si el nuevo SKU ya existe (si se está cambiando)
      if (updateData.sku && updateData.sku !== inventario.sku) {
        const existingInventario = await Inventario.findOne({
          where: { 
            sku: updateData.sku,
            id: { [Op.ne]: id }
          }
        });
        
        if (existingInventario) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe un inventario con ese SKU'
          });
        }
      }

      // Verificar que las relaciones existan si se están actualizando
      if (updateData.fkid_peso) {
        const peso = await Peso.findByPk(updateData.fkid_peso);
        if (!peso) {
          return res.status(400).json({
            success: false,
            message: 'El peso especificado no existe'
          });
        }
      }

      if (updateData.fkid_categoria) {
        const categoria = await CategoriaProducto.findByPk(updateData.fkid_categoria);
        if (!categoria) {
          return res.status(400).json({
            success: false,
            message: 'La categoría especificada no existe'
          });
        }
      }

      if (updateData.fkid_ciudad) {
        const ciudad = await City.findByPk(updateData.fkid_ciudad);
        if (!ciudad) {
          return res.status(400).json({
            success: false,
            message: 'La ciudad especificada no existe'
          });
        }
      }

      if (updateData.fkid_proveedor) {
        const proveedor = await Proveedor.findByPk(updateData.fkid_proveedor);
        if (!proveedor) {
          return res.status(400).json({
            success: false,
            message: 'El proveedor especificado no existe'
          });
        }
      }

      await inventario.update(updateData);

      // Obtener el inventario actualizado con sus relaciones
      const inventarioActualizado = await Inventario.findByPk(id, {
        include: [
          {
            model: Peso,
            as: 'peso',
            attributes: ['id', 'cantidad', 'unidad_medida']
          },
          {
            model: CategoriaProducto,
            as: 'categoria',
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          },
          {
            model: Proveedor,
            as: 'proveedor',
            attributes: ['id', 'nombre', 'correo', 'telefono']
          }
        ]
      });

      res.json({
        success: true,
        message: 'Inventario actualizado exitosamente',
        data: { inventario: inventarioActualizado }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar inventario (baja lógica)
  async deleteInventario(req, res, next) {
    try {
      const { id } = req.params;

      const inventario = await Inventario.findByPk(id);
      
      if (!inventario) {
        return res.status(404).json({
          success: false,
          message: 'Inventario no encontrado'
        });
      }

      await inventario.softDelete();

      res.json({
        success: true,
        message: 'Inventario eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar inventario
  async restoreInventario(req, res, next) {
    try {
      const { id } = req.params;

      const inventario = await Inventario.findByPk(id);
      
      if (!inventario) {
        return res.status(404).json({
          success: false,
          message: 'Inventario no encontrado'
        });
      }

      await inventario.restore();

      res.json({
        success: true,
        message: 'Inventario restaurado exitosamente',
        data: { inventario }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar stock
  async updateStock(req, res, next) {
    try {
      const { id } = req.params;
      const { stock_inicial } = req.body;

      const inventario = await Inventario.findByPk(id);
      
      if (!inventario) {
        return res.status(404).json({
          success: false,
          message: 'Inventario no encontrado'
        });
      }

      await inventario.updateStock(stock_inicial);

      res.json({
        success: true,
        message: 'Stock actualizado exitosamente',
        data: { inventario }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener inventarios por categoría
  async getInventariosByCategory(req, res, next) {
    try {
      const { categoriaId } = req.params;

      const whereClause = {
        fkid_categoria: categoriaId,
        baja_logica: false
      };

      // Aplicar filtro de ciudad según el usuario autenticado
      applyCityFilter(req, whereClause, 'fkid_ciudad');

      const inventarios = await Inventario.findAll({
        where: whereClause,
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        order: [['nombre', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          inventarios,
          total: inventarios.length,
          categoriaId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener inventarios por ciudad
  async getInventariosByCity(req, res, next) {
    try {
      const { ciudadId } = req.params;

      // Verificar que el usuario tenga acceso a esta ciudad
      const userCityId = req.user?.ciudad_id || req.user?.ciudad?.id;
      if (userCityId !== null && parseInt(ciudadId) !== userCityId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver inventario de esta ciudad'
        });
      }

      const inventarios = await Inventario.findByCity(ciudadId);

      res.json({
        success: true,
        data: {
          inventarios,
          total: inventarios.length,
          ciudadId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener inventarios por proveedor
  async getInventariosByProvider(req, res, next) {
    try {
      const { proveedorId } = req.params;

      const whereClause = {
        fkid_proveedor: proveedorId,
        baja_logica: false
      };

      // Aplicar filtro de ciudad según el usuario autenticado
      applyCityFilter(req, whereClause, 'fkid_ciudad');

      const inventarios = await Inventario.findAll({
        where: whereClause,
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        order: [['nombre', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          inventarios,
          total: inventarios.length,
          proveedorId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener inventarios con stock bajo
  async getLowStockInventarios(req, res, next) {
    try {
      const whereClause = {
        baja_logica: false,
        stock_inicial: {
          [Op.lte]: Op.col('stock_minimo')
        }
      };

      // Aplicar filtro de ciudad según el usuario autenticado
      applyCityFilter(req, whereClause, 'fkid_ciudad');

      const inventarios = await Inventario.findAll({
        where: whereClause,
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        order: [['stock_inicial', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          inventarios,
          total: inventarios.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Buscar inventarios
  async searchInventarios(req, res, next) {
    try {
      const { search } = req.query;

      if (!search) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el parámetro de búsqueda'
        });
      }

      const whereClause = {
        baja_logica: false,
        [Op.or]: [
          { nombre: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } },
          { descripcion: { [Op.like]: `%${search}%` } }
        ]
      };

      // Aplicar filtro de ciudad según el usuario autenticado
      applyCityFilter(req, whereClause, 'fkid_ciudad');

      const inventarios = await Inventario.findAll({
        where: whereClause,
        include: [
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre', 'departamento']
          }
        ],
        order: [['nombre', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          inventarios,
          total: inventarios.length,
          searchTerm: search
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de inventario
  async getInventarioStats(req, res, next) {
    try {
      const baseWhere = { baja_logica: false };
      
      // Aplicar filtro de ciudad según el usuario autenticado
      applyCityFilter(req, baseWhere, 'fkid_ciudad');

      const totalInventarios = await Inventario.count({
        where: baseWhere
      });

      const inventariosActivos = await Inventario.count({
        where: baseWhere
      });

      const inventariosInactivos = await Inventario.count({
        where: { ...baseWhere, baja_logica: true }
      });

      const inventariosStockBajo = await Inventario.count({
        where: { 
          ...baseWhere,
          stock_inicial: {
            [Op.lte]: Op.col('stock_minimo')
          }
        }
      });

      const totalStock = await Inventario.sum('stock_inicial', {
        where: baseWhere
      });

      const valorTotalInventario = await Inventario.findAll({
        attributes: [
          [Inventario.sequelize.fn('SUM', Inventario.sequelize.literal('stock_inicial * costo_unitario')), 'total_value']
        ],
        where: baseWhere
      });

      const precioPromedio = await Inventario.findOne({
        attributes: [
          [Inventario.sequelize.fn('AVG', Inventario.sequelize.col('precio_venta')), 'avg_price']
        ],
        where: baseWhere
      });

      res.json({
        success: true,
        data: {
          totalInventarios,
          inventariosActivos,
          inventariosInactivos,
          inventariosStockBajo,
          totalStock,
          valorTotalInventario: valorTotalInventario[0]?.dataValues?.total_value || 0,
          precioPromedio: precioPromedio ? Math.round(precioPromedio.dataValues.avg_price * 100) / 100 : 0
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InventarioController();
