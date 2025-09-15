const { ProductoPedido, Pedido, Inventario } = require('../../models');
const { Op } = require('sequelize');

class ProductoPedidoController {
  // Obtener todos los productos de pedido
  async getAllProductosPedido(req, res, next) {
    try {
      const { 
        fkid_pedido,
        fkid_producto,
        cantidad,
        activos = 'true',
        search,
        precio_min,
        precio_max,
        page = 1,
        limit = 20
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      if (activos === 'true') {
        whereClause.baja_logica = false;
      } else if (activos === 'false') {
        whereClause.baja_logica = true;
      }
      
      // Filtrar por pedido
      if (fkid_pedido) {
        whereClause.fkid_pedido = fkid_pedido;
      }
      
      // Filtrar por producto
      if (fkid_producto) {
        whereClause.fkid_producto = fkid_producto;
      }
      
      // Filtrar por cantidad
      if (cantidad) {
        whereClause.cantidad = cantidad;
      }

      // Filtrar por rango de precios
      if (precio_min && precio_max) {
        whereClause.precio_total = {
          [Op.between]: [parseFloat(precio_min), parseFloat(precio_max)]
        };
      }

      const offset = (page - 1) * limit;

      const { count, rows: productosPedido } = await ProductoPedido.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Pedido,
            as: 'pedido',
            attributes: ['id', 'numero_pedido', 'estado', 'fecha_pedido'],
            required: false
          },
          {
            model: Inventario,
            as: 'producto',
            attributes: ['id', 'nombre', 'sku', 'descripcion'],
            required: false
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          productosPedido,
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

  // Obtener un producto de pedido por ID
  async getProductoPedidoById(req, res, next) {
    try {
      const { id } = req.params;
      
      const productoPedido = await ProductoPedido.findByPk(id, {
        include: [
          {
            model: Pedido,
            as: 'pedido',
            attributes: ['id', 'numero_pedido', 'estado', 'fecha_pedido', 'total'],
            required: false
          },
          {
            model: Inventario,
            as: 'producto',
            attributes: ['id', 'nombre', 'sku', 'descripcion', 'precio_venta'],
            required: false
          }
        ]
      });
      
      if (!productoPedido) {
        return res.status(404).json({
          success: false,
          message: 'Producto de pedido no encontrado'
        });
      }

      res.json({
        success: true,
        data: { productoPedido }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo producto de pedido
  async createProductoPedido(req, res, next) {
    try {
      const {
        fkid_pedido,
        fkid_producto,
        cantidad,
        precio_unidad,
        descuento_producto = 0,
        notas_producto
      } = req.body;

      // Verificar que el pedido existe
      const pedido = await Pedido.findByPk(fkid_pedido);
      if (!pedido) {
        return res.status(400).json({
          success: false,
          message: 'El pedido especificado no existe'
        });
      }

      // Verificar que el producto existe
      const producto = await Inventario.findByPk(fkid_producto);
      if (!producto) {
        return res.status(400).json({
          success: false,
          message: 'El producto especificado no existe'
        });
      }

      // Verificar que no existe ya este producto en el pedido
      const productoExistente = await ProductoPedido.findByPedidoAndProducto(fkid_pedido, fkid_producto);
      if (productoExistente) {
        return res.status(400).json({
          success: false,
          message: 'Este producto ya está en el pedido'
        });
      }

      // Calcular precio total
      const precioTotal = parseFloat(precio_unidad) * parseInt(cantidad);
      const descuento = (precioTotal * parseFloat(descuento_producto)) / 100;
      const precioFinal = precioTotal - descuento;

      const productoPedido = await ProductoPedido.create({
        fkid_pedido,
        fkid_producto,
        cantidad,
        precio_unidad,
        precio_total: precioFinal,
        descuento_producto,
        notas_producto
      });

      // Actualizar subtotal del pedido
      const totalProductos = await ProductoPedido.getTotalByPedido(fkid_pedido);
      const nuevoSubtotal = parseFloat(totalProductos[0].total_pedido);
      await pedido.actualizarSubtotal(nuevoSubtotal);

      // Obtener el producto de pedido creado con sus relaciones
      const productoPedidoCompleto = await ProductoPedido.findByPk(productoPedido.id, {
        include: [
          {
            model: Pedido,
            as: 'pedido',
            attributes: ['id', 'numero_pedido', 'estado', 'fecha_pedido'],
            required: false
          },
          {
            model: Inventario,
            as: 'producto',
            attributes: ['id', 'nombre', 'sku', 'descripcion'],
            required: false
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Producto agregado al pedido exitosamente',
        data: { productoPedido: productoPedidoCompleto }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar producto de pedido
  async updateProductoPedido(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const productoPedido = await ProductoPedido.findByPk(id);
      
      if (!productoPedido) {
        return res.status(404).json({
          success: false,
          message: 'Producto de pedido no encontrado'
        });
      }

      // Si se actualiza la cantidad o el precio, recalcular el total
      if (updateData.cantidad || updateData.precio_unidad) {
        const nuevaCantidad = updateData.cantidad || productoPedido.cantidad;
        const nuevoPrecio = updateData.precio_unidad || productoPedido.precio_unidad;
        const descuento = updateData.descuento_producto !== undefined ? updateData.descuento_producto : productoPedido.descuento_producto;
        
        const precioTotal = parseFloat(nuevoPrecio) * parseInt(nuevaCantidad);
        const descuentoCalculado = (precioTotal * parseFloat(descuento)) / 100;
        updateData.precio_total = precioTotal - descuentoCalculado;
      }

      await productoPedido.update(updateData);

      // Actualizar subtotal del pedido
      const pedido = await Pedido.findByPk(productoPedido.fkid_pedido);
      const totalProductos = await ProductoPedido.getTotalByPedido(productoPedido.fkid_pedido);
      const nuevoSubtotal = parseFloat(totalProductos[0].total_pedido);
      await pedido.actualizarSubtotal(nuevoSubtotal);

      // Obtener el producto de pedido actualizado con sus relaciones
      const productoPedidoActualizado = await ProductoPedido.findByPk(id, {
        include: [
          {
            model: Pedido,
            as: 'pedido',
            attributes: ['id', 'numero_pedido', 'estado', 'fecha_pedido'],
            required: false
          },
          {
            model: Inventario,
            as: 'producto',
            attributes: ['id', 'nombre', 'sku', 'descripcion'],
            required: false
          }
        ]
      });

      res.json({
        success: true,
        message: 'Producto de pedido actualizado exitosamente',
        data: { productoPedido: productoPedidoActualizado }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar producto de pedido (baja lógica)
  async deleteProductoPedido(req, res, next) {
    try {
      const { id } = req.params;

      const productoPedido = await ProductoPedido.findByPk(id);
      
      if (!productoPedido) {
        return res.status(404).json({
          success: false,
          message: 'Producto de pedido no encontrado'
        });
      }

      await productoPedido.softDelete();

      // Actualizar subtotal del pedido
      const pedido = await Pedido.findByPk(productoPedido.fkid_pedido);
      const totalProductos = await ProductoPedido.getTotalByPedido(productoPedido.fkid_pedido);
      const nuevoSubtotal = parseFloat(totalProductos[0].total_pedido) || 0;
      await pedido.actualizarSubtotal(nuevoSubtotal);

      res.json({
        success: true,
        message: 'Producto eliminado del pedido exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar producto de pedido
  async restoreProductoPedido(req, res, next) {
    try {
      const { id } = req.params;

      const productoPedido = await ProductoPedido.findByPk(id);
      
      if (!productoPedido) {
        return res.status(404).json({
          success: false,
          message: 'Producto de pedido no encontrado'
        });
      }

      await productoPedido.restore();

      // Actualizar subtotal del pedido
      const pedido = await Pedido.findByPk(productoPedido.fkid_pedido);
      const totalProductos = await ProductoPedido.getTotalByPedido(productoPedido.fkid_pedido);
      const nuevoSubtotal = parseFloat(totalProductos[0].total_pedido);
      await pedido.actualizarSubtotal(nuevoSubtotal);

      res.json({
        success: true,
        message: 'Producto restaurado en el pedido exitosamente',
        data: { productoPedido }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar cantidad
  async updateCantidad(req, res, next) {
    try {
      const { id } = req.params;
      const { cantidad } = req.body;

      const productoPedido = await ProductoPedido.findByPk(id);
      
      if (!productoPedido) {
        return res.status(404).json({
          success: false,
          message: 'Producto de pedido no encontrado'
        });
      }

      await productoPedido.updateCantidad(cantidad);

      // Actualizar subtotal del pedido
      const pedido = await Pedido.findByPk(productoPedido.fkid_pedido);
      const totalProductos = await ProductoPedido.getTotalByPedido(productoPedido.fkid_pedido);
      const nuevoSubtotal = parseFloat(totalProductos[0].total_pedido);
      await pedido.actualizarSubtotal(nuevoSubtotal);

      res.json({
        success: true,
        message: 'Cantidad actualizada exitosamente',
        data: { productoPedido }
      });
    } catch (error) {
      next(error);
    }
  }

  // Aplicar descuento
  async aplicarDescuento(req, res, next) {
    try {
      const { id } = req.params;
      const { descuento_producto } = req.body;

      const productoPedido = await ProductoPedido.findByPk(id);
      
      if (!productoPedido) {
        return res.status(404).json({
          success: false,
          message: 'Producto de pedido no encontrado'
        });
      }

      await productoPedido.aplicarDescuento(descuento_producto);

      // Actualizar subtotal del pedido
      const pedido = await Pedido.findByPk(productoPedido.fkid_pedido);
      const totalProductos = await ProductoPedido.getTotalByPedido(productoPedido.fkid_pedido);
      const nuevoSubtotal = parseFloat(totalProductos[0].total_pedido);
      await pedido.actualizarSubtotal(nuevoSubtotal);

      res.json({
        success: true,
        message: 'Descuento aplicado exitosamente',
        data: { productoPedido }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener productos por pedido
  async getProductosByPedido(req, res, next) {
    try {
      const { pedidoId } = req.params;

      const productos = await ProductoPedido.findByPedido(pedidoId);

      res.json({
        success: true,
        data: {
          productos,
          total: productos.length,
          pedidoId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener productos por producto
  async getProductosByProducto(req, res, next) {
    try {
      const { productoId } = req.params;

      const productos = await ProductoPedido.findByProducto(productoId);

      res.json({
        success: true,
        data: {
          productos,
          total: productos.length,
          productoId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener productos con descuento
  async getProductosConDescuento(req, res, next) {
    try {
      const productos = await ProductoPedido.findConDescuento();

      res.json({
        success: true,
        data: {
          productos,
          total: productos.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de productos de pedido
  async getProductoPedidoStats(req, res, next) {
    try {
      const { pedidoId } = req.query;

      const totalProductos = await ProductoPedido.count({
        where: { 
          baja_logica: false,
          ...(pedidoId && { fkid_pedido: pedidoId })
        }
      });

      const totalCantidad = await ProductoPedido.sum('cantidad', {
        where: { 
          baja_logica: false,
          ...(pedidoId && { fkid_pedido: pedidoId })
        }
      });

      const totalVentas = await ProductoPedido.sum('precio_total', {
        where: { 
          baja_logica: false,
          ...(pedidoId && { fkid_pedido: pedidoId })
        }
      });

      const precioPromedio = await ProductoPedido.findOne({
        attributes: [
          [ProductoPedido.sequelize.fn('AVG', ProductoPedido.sequelize.col('precio_unidad')), 'precio_promedio']
        ],
        where: { 
          baja_logica: false,
          ...(pedidoId && { fkid_pedido: pedidoId })
        }
      });

      const cantidadPromedio = await ProductoPedido.findOne({
        attributes: [
          [ProductoPedido.sequelize.fn('AVG', ProductoPedido.sequelize.col('cantidad')), 'cantidad_promedio']
        ],
        where: { 
          baja_logica: false,
          ...(pedidoId && { fkid_pedido: pedidoId })
        }
      });

      const productosMasVendidos = await ProductoPedido.getProductosMasVendidos(10);
      const productosPorPedido = await ProductoPedido.getProductosPorPedido();
      const descuentosAplicados = await ProductoPedido.getDescuentosAplicados();

      res.json({
        success: true,
        data: {
          totalProductos,
          totalCantidad: totalCantidad || 0,
          totalVentas: totalVentas || 0,
          precioPromedio: parseFloat(precioPromedio?.precio_promedio) || 0,
          cantidadPromedio: parseFloat(cantidadPromedio?.cantidad_promedio) || 0,
          productosMasVendidos,
          productosPorPedido,
          descuentosAplicados
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener productos recientes
  async getRecentProductosPedido(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      const productos = await ProductoPedido.getRecentProductosPedido(parseInt(limit));

      res.json({
        success: true,
        data: {
          productos,
          total: productos.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener productos más vendidos
  async getProductosMasVendidos(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      const productos = await ProductoPedido.getProductosMasVendidos(parseInt(limit));

      res.json({
        success: true,
        data: {
          productos,
          total: productos.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductoPedidoController();
