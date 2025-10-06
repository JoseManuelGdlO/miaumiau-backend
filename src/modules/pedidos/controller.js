const { Pedido, Cliente, City, ProductoPedido, Inventario, Promotion } = require('../../models');
const { Op } = require('sequelize');

class PedidoController {
  // Obtener todos los pedidos
  async getAllPedidos(req, res, next) {
    try {
      const { 
        fkid_cliente,
        fkid_ciudad,
        estado,
        metodo_pago,
        activos = 'true',
        search,
        start_date,
        end_date,
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
      
      // Filtrar por cliente
      if (fkid_cliente) {
        whereClause.fkid_cliente = fkid_cliente;
      }
      
      // Filtrar por ciudad
      if (fkid_ciudad) {
        whereClause.fkid_ciudad = fkid_ciudad;
      }
      
      // Filtrar por estado
      if (estado) {
        whereClause.estado = estado;
      }

      // Filtrar por método de pago
      if (metodo_pago) {
        whereClause.metodo_pago = metodo_pago;
      }

      // Filtrar por rango de fechas
      if (start_date && end_date) {
        whereClause.fecha_pedido = {
          [Op.between]: [new Date(start_date), new Date(end_date)]
        };
      }

      // Búsqueda por número de pedido
      if (search) {
        whereClause.numero_pedido = {
          [Op.iLike]: `%${search}%`
        };
      }

      const offset = (page - 1) * limit;

      const { count, rows: pedidos } = await Pedido.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email'],
            required: false
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre'],
            required: false
          },
          {
            model: ProductoPedido,
            as: 'productos',
            attributes: ['id', 'cantidad', 'precio_unidad', 'precio_total'],
            include: [
              {
                model: Inventario,
                as: 'producto',
                attributes: ['id', 'nombre', 'sku'],
                required: false
              }
            ],
            required: false
          }
        ],
        order: [['fecha_pedido', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          pedidos,
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

  // Obtener un pedido por ID
  async getPedidoById(req, res, next) {
    try {
      const { id } = req.params;
      
      const pedido = await Pedido.findByPk(id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email', 'telefono'],
            required: false
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre'],
            required: false
          },
          {
            model: ProductoPedido,
            as: 'productos',
            attributes: ['id', 'cantidad', 'precio_unidad', 'precio_total', 'descuento_producto', 'notas_producto'],
            include: [
              {
                model: Inventario,
                as: 'producto',
                attributes: ['id', 'nombre', 'sku', 'descripcion'],
                required: false
              }
            ],
            required: false
          }
        ]
      });
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }

      res.json({
        success: true,
        data: { pedido }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo pedido
  async createPedido(req, res, next) {
    try {
      const {
        fkid_cliente,
        telefono_referencia,
        email_referencia,
        direccion_entrega,
        fkid_ciudad,
        fecha_entrega_estimada,
        metodo_pago,
        notas,
        productos = [],
        codigo_promocion
      } = req.body;

      // Verificar que el cliente existe
      const cliente = await Cliente.findByPk(fkid_cliente);
      if (!cliente) {
        return res.status(400).json({
          success: false,
          message: 'El cliente especificado no existe'
        });
      }

      // Verificar que la ciudad existe
      const ciudad = await City.findByPk(fkid_ciudad);
      if (!ciudad) {
        return res.status(400).json({
          success: false,
          message: 'La ciudad especificada no existe'
        });
      }

      // Validar código de promoción si se proporciona
      let promocion = null;
      let descuentoPromocion = 0;
      if (codigo_promocion) {
        promocion = await Promotion.findOne({
          where: {
            codigo: codigo_promocion,
            baja_logica: false
          },
          include: [
            {
              model: City,
              as: 'ciudades',
              where: { id: fkid_ciudad },
              required: false
            }
          ]
        });

        if (!promocion) {
          return res.status(400).json({
            success: false,
            message: 'El código de promoción no es válido'
          });
        }

        // Verificar si la promoción está activa
        const ahora = new Date();
        if (promocion.fecha_inicio > ahora || promocion.fecha_fin < ahora) {
          return res.status(400).json({
            success: false,
            message: 'El código de promoción no está activo'
          });
        }

        // Verificar si la promoción aplica para esta ciudad
        if (promocion.ciudades && promocion.ciudades.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'El código de promoción no aplica para esta ciudad'
          });
        }

        descuentoPromocion = promocion.descuento_porcentaje || 0;
      }

      // Generar número de pedido único
      const numeroPedido = Pedido.generateNumeroPedido();

      const pedido = await Pedido.create({
        fkid_cliente,
        telefono_referencia,
        email_referencia,
        direccion_entrega,
        fkid_ciudad,
        numero_pedido: numeroPedido,
        fecha_entrega_estimada,
        metodo_pago,
        notas,
        codigo_promocion: codigo_promocion || null,
        descuento_promocion: descuentoPromocion
      });

      // Agregar productos al pedido si se proporcionan
      if (productos && productos.length > 0) {
        let subtotal = 0;
        
        for (const producto of productos) {
          const { fkid_producto, cantidad, precio_unidad, descuento_producto = 0, notas_producto } = producto;
          
          // Verificar que el producto existe
          const productoInventario = await Inventario.findByPk(fkid_producto);
          if (!productoInventario) {
            return res.status(400).json({
              success: false,
              message: `El producto con ID ${fkid_producto} no existe`
            });
          }

          const precioTotal = parseFloat(precio_unidad) * parseInt(cantidad);
          const descuento = (precioTotal * parseFloat(descuento_producto)) / 100;
          const precioFinal = precioTotal - descuento;

          await ProductoPedido.create({
            fkid_pedido: pedido.id,
            fkid_producto,
            cantidad,
            precio_unidad,
            precio_total: precioFinal,
            descuento_producto,
            notas_producto
          });

          subtotal += precioFinal;
        }

        // Aplicar descuento de promoción al subtotal
        let totalConDescuento = subtotal;
        if (descuentoPromocion > 0) {
          const descuento = (subtotal * descuentoPromocion) / 100;
          totalConDescuento = subtotal - descuento;
        }

        // Actualizar subtotal del pedido
        await pedido.actualizarSubtotal(totalConDescuento);
      }

      // Obtener el pedido creado con sus relaciones
      const pedidoCompleto = await Pedido.findByPk(pedido.id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email'],
            required: false
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre'],
            required: false
          },
          {
            model: ProductoPedido,
            as: 'productos',
            attributes: ['id', 'cantidad', 'precio_unidad', 'precio_total'],
            include: [
              {
                model: Inventario,
                as: 'producto',
                attributes: ['id', 'nombre', 'sku'],
                required: false
              }
            ],
            required: false
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Pedido creado exitosamente',
        data: { pedido: pedidoCompleto }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar pedido
  async updatePedido(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const pedido = await Pedido.findByPk(id);
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }

      // Verificar que el cliente existe si se está actualizando
      if (updateData.fkid_cliente) {
        const cliente = await Cliente.findByPk(updateData.fkid_cliente);
        if (!cliente) {
          return res.status(400).json({
            success: false,
            message: 'El cliente especificado no existe'
          });
        }
      }

      // Verificar que la ciudad existe si se está actualizando
      if (updateData.fkid_ciudad) {
        const ciudad = await City.findByPk(updateData.fkid_ciudad);
        if (!ciudad) {
          return res.status(400).json({
            success: false,
            message: 'La ciudad especificada no existe'
          });
        }
      }

      await pedido.update(updateData);

      // Obtener el pedido actualizado con sus relaciones
      const pedidoActualizado = await Pedido.findByPk(id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email'],
            required: false
          },
          {
            model: City,
            as: 'ciudad',
            attributes: ['id', 'nombre'],
            required: false
          },
          {
            model: ProductoPedido,
            as: 'productos',
            attributes: ['id', 'cantidad', 'precio_unidad', 'precio_total'],
            include: [
              {
                model: Inventario,
                as: 'producto',
                attributes: ['id', 'nombre', 'sku'],
                required: false
              }
            ],
            required: false
          }
        ]
      });

      res.json({
        success: true,
        message: 'Pedido actualizado exitosamente',
        data: { pedido: pedidoActualizado }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar pedido (baja lógica)
  async deletePedido(req, res, next) {
    try {
      const { id } = req.params;

      const pedido = await Pedido.findByPk(id);
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }

      await pedido.softDelete();

      res.json({
        success: true,
        message: 'Pedido eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar pedido
  async restorePedido(req, res, next) {
    try {
      const { id } = req.params;

      const pedido = await Pedido.findByPk(id);
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }

      await pedido.restore();

      res.json({
        success: true,
        message: 'Pedido restaurado exitosamente',
        data: { pedido }
      });
    } catch (error) {
      next(error);
    }
  }

  // Cambiar estado del pedido
  async changeEstado(req, res, next) {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      const pedido = await Pedido.findByPk(id);
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }

      const estadoAnterior = pedido.estado;
      pedido.estado = estado;
      await pedido.save();

      res.json({
        success: true,
        message: `Estado cambiado de ${estadoAnterior} a ${estado} exitosamente`,
        data: { pedido }
      });
    } catch (error) {
      next(error);
    }
  }

  // Confirmar pedido
  async confirmarPedido(req, res, next) {
    try {
      const { id } = req.params;

      const pedido = await Pedido.findByPk(id);
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }

      await pedido.confirmar();

      res.json({
        success: true,
        message: 'Pedido confirmado exitosamente',
        data: { pedido }
      });
    } catch (error) {
      next(error);
    }
  }

  // Marcar como entregado
  async entregarPedido(req, res, next) {
    try {
      const { id } = req.params;

      const pedido = await Pedido.findByPk(id);
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }

      await pedido.entregar();

      res.json({
        success: true,
        message: 'Pedido marcado como entregado exitosamente',
        data: { pedido }
      });
    } catch (error) {
      next(error);
    }
  }

  // Cancelar pedido
  async cancelarPedido(req, res, next) {
    try {
      const { id } = req.params;

      const pedido = await Pedido.findByPk(id);
      
      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }

      await pedido.cancelar();

      res.json({
        success: true,
        message: 'Pedido cancelado exitosamente',
        data: { pedido }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener pedidos por cliente
  async getPedidosByCliente(req, res, next) {
    try {
      const { clientId } = req.params;

      const pedidos = await Pedido.findByCliente(clientId);

      res.json({
        success: true,
        data: {
          pedidos,
          total: pedidos.length,
          clientId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener pedidos por estado
  async getPedidosByEstado(req, res, next) {
    try {
      const { estado } = req.params;

      const pedidos = await Pedido.findByEstado(estado);

      res.json({
        success: true,
        data: {
          pedidos,
          total: pedidos.length,
          estado
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener pedidos por ciudad
  async getPedidosByCiudad(req, res, next) {
    try {
      const { ciudadId } = req.params;

      const pedidos = await Pedido.findByCiudad(ciudadId);

      res.json({
        success: true,
        data: {
          pedidos,
          total: pedidos.length,
          ciudadId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Buscar pedido por número
  async searchPedidoByNumero(req, res, next) {
    try {
      const { numero } = req.params;

      const pedido = await Pedido.findByNumero(numero);

      if (!pedido) {
        return res.status(404).json({
          success: false,
          message: 'Pedido no encontrado'
        });
      }

      res.json({
        success: true,
        data: { pedido }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener pedidos pendientes
  async getPedidosPendientes(req, res, next) {
    try {
      const pedidos = await Pedido.findPendientes();

      res.json({
        success: true,
        data: {
          pedidos,
          total: pedidos.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener pedidos en preparación
  async getPedidosEnPreparacion(req, res, next) {
    try {
      const pedidos = await Pedido.findEnPreparacion();

      res.json({
        success: true,
        data: {
          pedidos,
          total: pedidos.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener pedidos en camino
  async getPedidosEnCamino(req, res, next) {
    try {
      const pedidos = await Pedido.findEnCamino();

      res.json({
        success: true,
        data: {
          pedidos,
          total: pedidos.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de pedidos
  async getPedidoStats(req, res, next) {
    try {
      const totalPedidos = await Pedido.count({
        where: { baja_logica: false }
      });

      const pedidosPendientes = await Pedido.count({
        where: { 
          estado: 'pendiente',
          baja_logica: false
        }
      });

      const pedidosConfirmados = await Pedido.count({
        where: { 
          estado: 'confirmado',
          baja_logica: false
        }
      });

      const pedidosEnPreparacion = await Pedido.count({
        where: { 
          estado: 'en_preparacion',
          baja_logica: false
        }
      });

      const pedidosEnCamino = await Pedido.count({
        where: { 
          estado: 'en_camino',
          baja_logica: false
        }
      });

      const pedidosEntregados = await Pedido.count({
        where: { 
          estado: 'entregado',
          baja_logica: false
        }
      });

      const pedidosCancelados = await Pedido.count({
        where: { 
          estado: 'cancelado',
          baja_logica: false
        }
      });

      const totalVentas = await Pedido.sum('total', {
        where: { 
          baja_logica: false,
          estado: {
            [Op.ne]: 'cancelado'
          }
        }
      });

      const pedidosPorEstado = await Pedido.getPedidosByEstado();
      const pedidosPorMetodoPago = await Pedido.getPedidosByMetodoPago();
      const pedidosPorCiudad = await Pedido.getPedidosByCiudad();

      res.json({
        success: true,
        data: {
          totalPedidos,
          pedidosPendientes,
          pedidosConfirmados,
          pedidosEnPreparacion,
          pedidosEnCamino,
          pedidosEntregados,
          pedidosCancelados,
          totalVentas: totalVentas || 0,
          pedidosPorEstado,
          pedidosPorMetodoPago,
          pedidosPorCiudad
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener pedidos recientes
  async getRecentPedidos(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      const pedidos = await Pedido.getRecentPedidos(parseInt(limit));

      res.json({
        success: true,
        data: {
          pedidos,
          total: pedidos.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PedidoController();
