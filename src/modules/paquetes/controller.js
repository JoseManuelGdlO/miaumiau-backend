const { Paquete, ProductoPaquete, Inventario } = require('../../models');
const { Op } = require('sequelize');

class PaqueteController {
  // Obtener todos los paquetes
  async getAllPaquetes(req, res, next) {
    try {
      const { 
        activos,
        search,
        page = 1,
        limit = 10
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos solo si se especifica el parámetro
      if (activos === 'true') {
        whereClause.is_active = true;
      } else if (activos === 'false') {
        whereClause.is_active = false;
      }
      // Si no se especifica activos, mostrar todos (activos e inactivos)
      
      // Búsqueda por nombre o descripción
      if (search) {
        whereClause[Op.or] = [
          { nombre: { [Op.like]: `%${search}%` } },
          { descripcion: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: paquetes } = await Paquete.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: ProductoPaquete,
            as: 'productos',
            include: [
              {
                model: Inventario,
                as: 'producto',
                attributes: ['id', 'nombre', 'descripcion', 'precio_venta']
              }
            ]
          }
        ],
        order: [['created_at', 'DESC'], ['updated_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          paquetes,
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

  // Obtener un paquete por ID
  async getPaqueteById(req, res, next) {
    try {
      const { id } = req.params;
      
      const paquete = await Paquete.findByPk(id, {
        include: [
          {
            model: ProductoPaquete,
            as: 'productos',
            include: [
              {
                model: Inventario,
                as: 'producto',
                attributes: ['id', 'nombre', 'descripcion', 'precio_venta']
              }
            ]
          }
        ]
      });
      
      if (!paquete) {
        return res.status(404).json({
          success: false,
          message: 'Paquete no encontrado'
        });
      }

      res.json({
        success: true,
        data: { paquete }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo paquete
  async createPaquete(req, res, next) {
    try {
      const {
        nombre,
        descripcion,
        precio,
        descuento = 0,
        productos = []
      } = req.body;

      // Validar que se proporcionen productos
      if (!productos || productos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debe agregar al menos un producto al paquete'
        });
      }

      // Calcular precio_final
      const precioNum = parseFloat(precio);
      const descuentoNum = descuento ? parseFloat(descuento) : 0;
      const descuentoAmount = (precioNum * descuentoNum) / 100;
      const precioFinal = precioNum - descuentoAmount;

      // Crear el paquete
      const paquete = await Paquete.create({
        nombre,
        descripcion,
        precio: precioNum,
        descuento: descuentoNum,
        precio_final: precioFinal,
        is_active: true
      });

      // Validar y crear los productos del paquete
      for (const productoData of productos) {
        const { fkid_producto, cantidad } = productoData;

        // Verificar que el producto existe
        const producto = await Inventario.findByPk(fkid_producto);
        if (!producto) {
          // Si el producto no existe, eliminar el paquete creado
          await paquete.destroy();
          return res.status(400).json({
            success: false,
            message: `El producto con ID ${fkid_producto} no existe`
          });
        }

        // Verificar que la cantidad sea válida
        if (!cantidad || cantidad < 1) {
          await paquete.destroy();
          return res.status(400).json({
            success: false,
            message: 'La cantidad debe ser mayor a 0'
          });
        }

        // Crear la relación producto-paquete
        await ProductoPaquete.create({
          fkid_paquete: paquete.id,
          fkid_producto: fkid_producto,
          cantidad: parseInt(cantidad)
        });
      }

      // Obtener el paquete creado con sus productos
      const paqueteCompleto = await Paquete.findByPk(paquete.id, {
        include: [
          {
            model: ProductoPaquete,
            as: 'productos',
            include: [
              {
                model: Inventario,
                as: 'producto',
                attributes: ['id', 'nombre', 'descripcion', 'precio_venta']
              }
            ]
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Paquete creado exitosamente',
        data: { paquete: paqueteCompleto }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar paquete
  async updatePaquete(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const paquete = await Paquete.findByPk(id);
      
      if (!paquete) {
        return res.status(404).json({
          success: false,
          message: 'Paquete no encontrado'
        });
      }

      // Si se actualiza el precio o descuento, recalcular precio_final
      if (updateData.precio !== undefined || updateData.descuento !== undefined) {
        const precio = updateData.precio !== undefined ? parseFloat(updateData.precio) : parseFloat(paquete.precio);
        const descuento = updateData.descuento !== undefined ? parseFloat(updateData.descuento) : (paquete.descuento || 0);
        const descuentoAmount = (precio * descuento) / 100;
        updateData.precio_final = precio - descuentoAmount;
      }

      // Actualizar el paquete
      await paquete.update(updateData);

      // Si se proporcionan productos, actualizar la relación
      if (updateData.productos && Array.isArray(updateData.productos)) {
        // Eliminar productos existentes
        await ProductoPaquete.destroy({
          where: { fkid_paquete: id }
        });

        // Agregar nuevos productos
        for (const productoData of updateData.productos) {
          const { fkid_producto, cantidad } = productoData;

          // Verificar que el producto existe
          const producto = await Inventario.findByPk(fkid_producto);
          if (!producto) {
            return res.status(400).json({
              success: false,
              message: `El producto con ID ${fkid_producto} no existe`
            });
          }

          // Verificar que la cantidad sea válida
          if (!cantidad || cantidad < 1) {
            return res.status(400).json({
              success: false,
              message: 'La cantidad debe ser mayor a 0'
            });
          }

          // Crear la relación producto-paquete
          await ProductoPaquete.create({
            fkid_paquete: id,
            fkid_producto: fkid_producto,
            cantidad: parseInt(cantidad)
          });
        }
      }

      // Obtener el paquete actualizado con sus productos
      const paqueteActualizado = await Paquete.findByPk(id, {
        include: [
          {
            model: ProductoPaquete,
            as: 'productos',
            include: [
              {
                model: Inventario,
                as: 'producto',
                attributes: ['id', 'nombre', 'descripcion', 'precio_venta']
              }
            ]
          }
        ]
      });

      res.json({
        success: true,
        message: 'Paquete actualizado exitosamente',
        data: { paquete: paqueteActualizado }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar paquete
  async deletePaquete(req, res, next) {
    try {
      const { id } = req.params;

      const paquete = await Paquete.findByPk(id);
      
      if (!paquete) {
        return res.status(404).json({
          success: false,
          message: 'Paquete no encontrado'
        });
      }

      // Eliminar productos asociados
      await ProductoPaquete.destroy({
        where: { fkid_paquete: id }
      });

      // Eliminar el paquete
      await paquete.destroy();

      res.json({
        success: true,
        message: 'Paquete eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Activar/Desactivar paquete
  async togglePaqueteStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      const paquete = await Paquete.findByPk(id);
      
      if (!paquete) {
        return res.status(404).json({
          success: false,
          message: 'Paquete no encontrado'
        });
      }

      paquete.is_active = is_active !== undefined ? is_active : !paquete.is_active;
      await paquete.save();

      res.json({
        success: true,
        message: `Paquete ${paquete.is_active ? 'activado' : 'desactivado'} exitosamente`,
        data: { paquete }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener paquetes activos
  async getPaquetesActivos(req, res, next) {
    try {
      const paquetes = await Paquete.findActive();

      res.json({
        success: true,
        data: {
          paquetes,
          total: paquetes.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Buscar paquetes
  async searchPaquetes(req, res, next) {
    try {
      const { search } = req.query;

      if (!search) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el parámetro de búsqueda'
        });
      }

      const paquetes = await Paquete.findBySearch(search);

      res.json({
        success: true,
        data: {
          paquetes,
          total: paquetes.length,
          searchTerm: search
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de paquetes
  async getPaqueteStats(req, res, next) {
    try {
      const totalPaquetes = await Paquete.count();
      const paquetesActivos = await Paquete.count({
        where: { is_active: true }
      });
      const paquetesInactivos = await Paquete.count({
        where: { is_active: false }
      });

      const stats = await Paquete.getPackageStats();
      const statsData = stats[0]?.dataValues || {};

      res.json({
        success: true,
        data: {
          totalPaquetes,
          paquetesActivos,
          paquetesInactivos,
          valorTotal: parseFloat(statsData.total_valor || 0),
          precioPromedio: parseFloat(statsData.precio_promedio || 0)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaqueteController();

