const { Pedido, Cliente, City, ProductoPedido, Inventario, PaquetePedido, Paquete, ProductoPaquete, Promotion, PromotionUsage, Conversacion, ConversacionLog } = require('../../models');
const { Op } = require('sequelize');
const { applyCityFilter } = require('../../utils/cityFilter');
const { mapCityNameToId, validateAndGetCity } = require('../../utils/cityMapper');

// Funciones helper para normalizar teléfonos
const normalizePhone = (value) => {
  if (!value) return null;
  const normalized = String(value).replace(/\D/g, '');
  return normalized || null;
};

const extractPhone = (value) => {
  if (!value) return null;
  const match = String(value).match(/\+?\d+/);
  return match ? match[0] : null;
};

// Función helper para actualizar conversaciones con el cliente real
const updateConversacionesWithCliente = async (telefono, id_cliente, id_pedido = null) => {
  if (!telefono || !id_cliente) return;
  
  try {
    // Normalizar el teléfono
    const telefonoNormalizado = normalizePhone(telefono);
    if (!telefonoNormalizado) return;
    
    // Buscar conversaciones activas que tengan este teléfono en 'from' y no tengan cliente asignado
    const conversaciones = await Conversacion.findAll({
      where: {
        from: {
          [Op.like]: `%${telefonoNormalizado}%`
        },
        id_cliente: null,
        baja_logica: false
      }
    });
    
    // Actualizar cada conversación encontrada
    for (const conversacion of conversaciones) {
      const updateData = { id_cliente };
      
      // Si se proporciona id_pedido y la conversación no tiene uno, actualizarlo
      if (id_pedido && !conversacion.id_pedido) {
        updateData.id_pedido = id_pedido;
      }
      
      await conversacion.update(updateData);
      
      // Crear log de la actualización
      await ConversacionLog.createLog(
        conversacion.id,
        { 
          cliente_anterior: null,
          cliente_nuevo: id_cliente,
          pedido_id: id_pedido || null,
          updated_by: 'sistema',
          motivo: 'Cliente identificado al crear pedido'
        },
        'sistema',
        'info',
        `Conversación actualizada con cliente ${id_cliente}${id_pedido ? ` y pedido ${id_pedido}` : ''}`
      );
    }
    
    return conversaciones.length;
  } catch (error) {
    // No fallar el proceso si hay error al actualizar conversaciones
    // Solo loguear el error para debugging
    console.error('Error al actualizar conversaciones con cliente:', error);
    return 0;
  }
};

class PedidoController {
  // Obtener todos los pedidos
  async getAllPedidos(req, res, next) {
    try {
      const { 
        fkid_cliente,
        fkid_ciudad,
        estado,
        metodo_pago,
        activos,
        search,
        fecha_pedido,
        fecha_entrega,
        page = 1,
        limit = 10
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por activos/inactivos
      // Por defecto, solo mostrar pedidos activos (baja_logica: false)
      if (activos === 'false') {
        whereClause.baja_logica = true; // Solo inactivos
      } else {
        // Por defecto o si activos === 'true', solo mostrar activos
        whereClause.baja_logica = false;
      }
      
      // Filtrar por cliente
      if (fkid_cliente) {
        whereClause.fkid_cliente = fkid_cliente;
      }
      
      // Filtrar por ciudad (si viene en query params)
      if (fkid_ciudad) {
        whereClause.fkid_ciudad = fkid_ciudad;
      }

      // Aplicar filtro de ciudad según el usuario autenticado
      // Si el usuario tiene ciudad asignada, solo puede ver pedidos de su ciudad
      // Si no tiene ciudad asignada, puede ver todos los pedidos
      applyCityFilter(req, whereClause, 'fkid_ciudad');
      
      // Filtrar por estado
      if (estado) {
        whereClause.estado = estado;
      }

      // Filtrar por método de pago
      if (metodo_pago) {
        whereClause.metodo_pago = metodo_pago;
      }

      // Filtrar por fecha de pedido (día completo)
      if (fecha_pedido) {
        // Crear fechas usando el inicio del día y el inicio del día siguiente en UTC
        // Esto evita problemas de zona horaria al usar UTC explícitamente
        const fechaInicio = new Date(fecha_pedido + 'T00:00:00.000Z');
        const fechaSiguiente = new Date(fechaInicio);
        fechaSiguiente.setUTCDate(fechaSiguiente.getUTCDate() + 1);
        
        whereClause.fecha_pedido = {
          [Op.gte]: fechaInicio,
          [Op.lt]: fechaSiguiente
        };
      }

      // Filtrar por fecha de entrega estimada (día completo)
      if (fecha_entrega) {
        // Crear fechas usando el inicio del día y el inicio del día siguiente en UTC
        // Esto asegura que una fecha como 2024-11-30 17:17 (almacenada en cualquier formato)
        // se compare correctamente con el rango del día 30 en UTC
        // Usamos >= inicio del día y < inicio del día siguiente para incluir todo el día
        const fechaInicio = new Date(fecha_entrega + 'T00:00:00.000Z');
        const fechaSiguiente = new Date(fechaInicio);
        fechaSiguiente.setUTCDate(fechaSiguiente.getUTCDate() + 1);
        
        whereClause.fecha_entrega_estimada = {
          [Op.gte]: fechaInicio,
          [Op.lt]: fechaSiguiente
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
            attributes: ['id', 'fkid_producto', 'cantidad', 'precio_unidad', 'precio_total', 'descuento_producto', 'notas_producto'],
            include: [
              {
                model: Inventario,
                as: 'producto',
                attributes: ['id', 'nombre', 'sku', 'descripcion'],
                required: false
              }
            ],
            required: false
          },
          {
            model: PaquetePedido,
            as: 'paquetes',
            attributes: ['id', 'fkid_paquete', 'cantidad', 'precio_unidad', 'precio_total', 'descuento_paquete', 'notas_paquete'],
            include: [
              {
                model: Paquete,
                as: 'paquete',
                attributes: ['id', 'nombre', 'descripcion', 'precio_final'],
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
            attributes: ['id', 'fkid_producto', 'cantidad', 'precio_unidad', 'precio_total', 'descuento_producto', 'notas_producto'],
            include: [
              {
                model: Inventario,
                as: 'producto',
                attributes: ['id', 'nombre', 'sku', 'descripcion'],
                required: false
              }
            ],
            required: false
          },
          {
            model: PaquetePedido,
            as: 'paquetes',
            attributes: ['id', 'fkid_paquete', 'cantidad', 'precio_unidad', 'precio_total', 'descuento_paquete', 'notas_paquete'],
            include: [
              {
                model: Paquete,
                as: 'paquete',
                attributes: ['id', 'nombre', 'descripcion', 'precio_final'],
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
        paquetes = [],
        codigo_promocion,
        nombre_cliente, // Opcional: nombre del cliente si se va a crear
        stripe_link_id // Opcional: ID del link de pago de Stripe
      } = req.body;

      // Convertir fkid_ciudad de string a ID si es necesario usando el utility
      const ciudadIdFinal = await mapCityNameToId(fkid_ciudad);
      if (!ciudadIdFinal) {
        // Obtener lista de ciudades disponibles para el mensaje de error
        const todasLasCiudades = await City.findAll({
          where: { baja_logica: false },
          attributes: ['nombre']
        });
        const ciudadesDisponibles = todasLasCiudades.map(c => c.nombre).join(', ');
        
        return res.status(400).json({
          success: false,
          message: `La ciudad especificada "${fkid_ciudad}" no existe. Ciudades disponibles: ${ciudadesDisponibles}`
        });
      }

      let cliente = null;
      let clienteId = fkid_cliente;

      // Si se proporciona un fkid_cliente, verificar que existe
      if (fkid_cliente) {
        cliente = await Cliente.findByPk(fkid_cliente);
        if (!cliente) {
          // Si el cliente no existe, intentar buscar o crear uno nuevo
          clienteId = null;
        } else {
          // Verificar que el cliente tiene telefono válido (requerido por el modelo)
          if (!cliente.telefono) {
            return res.status(400).json({
              success: false,
              message: 'El cliente no tiene un teléfono válido registrado'
            });
          }
        }
      }

      // Si no hay cliente válido, buscar o crear uno nuevo
      if (!cliente) {
        // Buscar cliente por teléfono o email
        const searchConditions = [];
        if (telefono_referencia) {
          searchConditions.push({ telefono: telefono_referencia });
        }
        if (email_referencia) {
          searchConditions.push({ email: email_referencia });
        }

        if (searchConditions.length > 0) {
          cliente = await Cliente.findOne({
            where: {
              [Op.or]: searchConditions
            }
          });
        }

        // Si no se encuentra el cliente, crear uno nuevo
        if (!cliente) {
          // Validar que tenemos los datos mínimos para crear un cliente
          if (!telefono_referencia) {
            return res.status(400).json({
              success: false,
              message: 'Se requiere un teléfono de referencia para crear un nuevo cliente'
            });
          }

          // ciudadIdFinal ya fue validado al inicio del método
          if (!ciudadIdFinal) {
            return res.status(400).json({
              success: false,
              message: 'Se requiere una ciudad para crear un nuevo cliente'
            });
          }

          // Verificar que no existe otro cliente con el mismo teléfono
          const existingCliente = await Cliente.findOne({
            where: { telefono: telefono_referencia }
          });

          if (existingCliente) {
            cliente = existingCliente;
            clienteId = cliente.id;
          } else {
            // Crear nuevo cliente
            const nombreCompleto = nombre_cliente || `Cliente ${telefono_referencia}`;
            
            cliente = await Cliente.create({
              nombre_completo: nombreCompleto,
              telefono: telefono_referencia,
              email: email_referencia || null,
              fkid_ciudad: ciudadIdFinal,
              canal_contacto: 'WhatsApp', // Valor por defecto
              direccion_entrega: direccion_entrega || null
            });

            clienteId = cliente.id;
          }
        } else {
          clienteId = cliente.id;
        }
      }

      // Actualizar conversaciones relacionadas con el cliente
      // Buscar conversaciones que tengan el teléfono del cliente pero no tengan cliente asignado
      const telefonoParaBuscar = telefono_referencia || cliente?.telefono;
      if (telefonoParaBuscar && clienteId) {
        await updateConversacionesWithCliente(telefonoParaBuscar, clienteId);
      }

      // Obtener la ciudad (ya validada en el mapeo inicial)
      const ciudad = await City.findByPk(ciudadIdFinal);

      // Normalizar código de promoción (solo guardarlo, sin validar)
      // Los descuentos ahora se aplican mediante el endpoint /aplicarCodigo
      let codigoPromocionNormalizado = null;
      if (codigo_promocion && 
          codigo_promocion !== 'null' && 
          codigo_promocion !== '' && 
          typeof codigo_promocion === 'string' && 
          codigo_promocion.trim().length > 0) {
        codigoPromocionNormalizado = codigo_promocion.trim();
      }

      // Generar número de pedido único
      const numeroPedido = Pedido.generateNumeroPedido();

      const pedido = await Pedido.create({
        fkid_cliente: clienteId,
        telefono_referencia: telefono_referencia || null,
        email_referencia: email_referencia || null,
        direccion_entrega,
        fkid_ciudad: ciudadIdFinal,
        numero_pedido: numeroPedido,
        estado: 'pendiente', // Estado inicial siempre pendiente
        fecha_entrega_estimada: fecha_entrega_estimada || null,
        metodo_pago: metodo_pago || null,
        notas: notas || null,
        codigo_promocion: codigoPromocionNormalizado,
        descuento_promocion: 0, // Los descuentos se aplican antes de crear el pedido
        stripe_link_id: stripe_link_id || null
      });

      // Calcular subtotal inicial
      let subtotal = 0;
      let productosAProcesar = [];

      // Agregar productos al pedido si se proporcionan
      if (productos && productos.length > 0) {
        // Detectar si la estructura es anidada (objetos con propiedad 'productos' dentro)
        // o plana (productos directos)
        const esEstructuraAnidada = typeof productos[0] === 'object' && 
          productos[0] !== null &&
          Array.isArray(productos[0].productos);
        
        // Si es estructura anidada, extraer los productos de cada objeto
        productosAProcesar = esEstructuraAnidada 
          ? productos.flatMap(item => item.productos || [])
          : productos;
        
        for (const producto of productosAProcesar) {
          const { fkid_producto, cantidad, precio_unidad, descuento_producto = 0, notas_producto, es_regalo } = producto;
          
          // Para productos regalo, permitir fkid_producto null
          // Para productos normales, verificar que el producto existe
          if (!es_regalo && fkid_producto) {
            const productoInventario = await Inventario.findByPk(fkid_producto);
            if (!productoInventario) {
              return res.status(400).json({
                success: false,
                message: `El producto con ID ${fkid_producto} no existe`
              });
            }
          }

          // Los precios ya vienen aplicados desde aplicarCodigo, no calcular descuentos aquí
          const precioUnidad = parseFloat(precio_unidad) || 0;
          const precioTotal = precioUnidad * parseInt(cantidad);
          
          // El descuento_producto debe ser 0 ya que los descuentos se aplicaron en aplicarCodigo
          // Solo usar descuento_producto si viene explícitamente en el request (para compatibilidad)
          const descuentoProducto = parseFloat(descuento_producto) || 0;

          await ProductoPedido.create({
            fkid_pedido: pedido.id,
            fkid_producto: fkid_producto || null,
            cantidad,
            precio_unidad: precioUnidad,
            precio_total: precioTotal, // Precio ya viene con descuentos aplicados
            descuento_producto: descuentoProducto,
            notas_producto
          });

          subtotal += precioTotal;
        }
      }

      // Agregar paquetes al pedido si se proporcionan
      if (paquetes && paquetes.length > 0) {
        for (const paquete of paquetes) {
          const { fkid_paquete, cantidad, precio_unidad, descuento_paquete = 0, notas_paquete } = paquete;
          
          // Verificar que el paquete existe y está activo
          const paqueteData = await Paquete.findByPk(fkid_paquete);
          if (!paqueteData) {
            return res.status(400).json({
              success: false,
              message: `El paquete con ID ${fkid_paquete} no existe`
            });
          }

          if (!paqueteData.is_active) {
            return res.status(400).json({
              success: false,
              message: `El paquete con ID ${fkid_paquete} no está activo`
            });
          }

          // Usar el precio del paquete si no se proporciona precio_unidad
          const precioPaquete = precio_unidad || parseFloat(paqueteData.precio_final);
          const precioTotal = precioPaquete * parseInt(cantidad);
          const descuento = (precioTotal * parseFloat(descuento_paquete)) / 100;
          const precioFinal = precioTotal - descuento;

          await PaquetePedido.create({
            fkid_pedido: pedido.id,
            fkid_paquete,
            cantidad,
            precio_unidad: precioPaquete,
            precio_total: precioFinal,
            descuento_paquete,
            notas_paquete
          });

          subtotal += precioFinal;
        }
      }

      // Validar que hay al menos un producto o paquete
      if (subtotal === 0) {
        return res.status(400).json({
          success: false,
          message: 'El pedido debe contener al menos un producto o paquete'
        });
      }

      // Función helper para calcular productos por paquete
      const calcularProductosPorPaquete = async (paquetesArray) => {
        const productosPorPaquete = {};
        for (const paqueteItem of paquetesArray) {
          if (!paqueteItem.fkid_paquete) continue;
          
          const productosPaquete = await ProductoPaquete.findAll({
            where: {
              fkid_paquete: paqueteItem.fkid_paquete
            }
          });

          for (const productoPaquete of productosPaquete) {
            const cantidadTotal = paqueteItem.cantidad * productoPaquete.cantidad;
            if (!productosPorPaquete[productoPaquete.fkid_producto]) {
              productosPorPaquete[productoPaquete.fkid_producto] = 0;
            }
            productosPorPaquete[productoPaquete.fkid_producto] += cantidadTotal;
          }
        }
        return productosPorPaquete;
      };

      // Calcular cantidad de productos por paquete
      const productosPorPaquete = paquetes && paquetes.length > 0 
        ? await calcularProductosPorPaquete(paquetes) 
        : {};

      // Validar y restar stock al crear el pedido
      const erroresStock = [];
      
      // Validar stock de productos directos (sumando si también están en paquetes)
      for (const producto of productosAProcesar) {
        if (!producto.fkid_producto) {
          // Producto regalo sin ID - omitir (se registra pero no se puede actualizar stock)
          continue;
        }

        const productoInventario = await Inventario.findByPk(producto.fkid_producto);
        if (!productoInventario) {
          erroresStock.push(`Producto con ID ${producto.fkid_producto} no encontrado en inventario`);
          continue;
        }

        const cantidadDirecta = parseInt(producto.cantidad);
        const cantidadDePaquetes = productosPorPaquete[producto.fkid_producto] || 0;
        const cantidadRequerida = cantidadDirecta + cantidadDePaquetes;

        if (productoInventario.stock_inicial < cantidadRequerida) {
          erroresStock.push(
            `Stock insuficiente para ${productoInventario.nombre} (SKU: ${productoInventario.sku}). Disponible: ${productoInventario.stock_inicial}, Requerido: ${cantidadRequerida}`
          );
        }
      }

      // Validar stock de productos solo en paquetes (que no están como productos directos)
      const productosDirectosIds = productosAProcesar
        .map(p => p.fkid_producto)
        .filter(id => id !== null);
      
      for (const [productoId, cantidadTotal] of Object.entries(productosPorPaquete)) {
        // Solo validar si no está ya como producto directo
        if (productosDirectosIds.includes(parseInt(productoId))) {
          continue; // Ya se validó arriba
        }

        const producto = await Inventario.findByPk(productoId);
        if (!producto) {
          erroresStock.push(`Producto con ID ${productoId} no encontrado en inventario`);
          continue;
        }

        if (producto.stock_inicial < cantidadTotal) {
          erroresStock.push(
            `Stock insuficiente para ${producto.nombre} (SKU: ${producto.sku}) en paquetes. Disponible: ${producto.stock_inicial}, Requerido: ${cantidadTotal}`
          );
        }
      }

      // Si hay errores de stock, retornar error y eliminar el pedido creado
      if (erroresStock.length > 0) {
        // Eliminar el pedido creado ya que no se puede completar
        await pedido.destroy();
        return res.status(400).json({
          success: false,
          message: 'Stock insuficiente para crear el pedido',
          errors: erroresStock
        });
      }

      // Recalcular productos por paquete para restar stock
      const productosPorPaqueteParaRestar = paquetes && paquetes.length > 0 
        ? await calcularProductosPorPaquete(paquetes) 
        : {};

      // Restar stock de productos directos
      for (const producto of productosAProcesar) {
        if (!producto.fkid_producto) continue; // Omitir productos regalo sin ID

        const productoInventario = await Inventario.findByPk(producto.fkid_producto);
        if (!productoInventario) continue;

        const cantidadDirecta = parseInt(producto.cantidad);
        if (cantidadDirecta > 0) {
          await productoInventario.reducirStock(cantidadDirecta);
        }
      }

      // Restar stock de productos en paquetes (sin importar si también están como directos)
      for (const [productoId, cantidadTotal] of Object.entries(productosPorPaqueteParaRestar)) {
        const producto = await Inventario.findByPk(productoId);
        if (producto && cantidadTotal > 0) {
          await producto.reducirStock(cantidadTotal);
        }
      }

      // Registrar uso del código de promoción si existe
      if (codigoPromocionNormalizado) {
        try {
          const promotion = await Promotion.findByCode(codigoPromocionNormalizado);
          if (promotion) {
            await PromotionUsage.create({
              promotion_id: promotion.id,
              telefono: telefono_referencia || cliente?.telefono,
              fkid_cliente: clienteId,
              fkid_pedido: pedido.id
            });
          }
        } catch (usageError) {
          // No fallar el pedido si hay error al registrar el uso
          // Solo loguear el error para debugging
          console.error('Error al registrar uso de promoción:', usageError);
        }
      }

      // Actualizar subtotal del pedido
      // Los descuentos ya fueron aplicados a los productos antes de crear el pedido
      await pedido.actualizarSubtotal(subtotal);

      // Actualizar conversaciones relacionadas con el pedido creado
      // Buscar conversaciones que tengan el teléfono del cliente y actualizarlas con el id_pedido
      const telefonoParaBuscarPedido = telefono_referencia || cliente?.telefono;
      if (telefonoParaBuscarPedido && clienteId && pedido.id) {
        await updateConversacionesWithCliente(telefonoParaBuscarPedido, clienteId, pedido.id);
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
          },
          {
            model: PaquetePedido,
            as: 'paquetes',
            attributes: ['id', 'cantidad', 'precio_unidad', 'precio_total'],
            include: [
              {
                model: Paquete,
                as: 'paquete',
                attributes: ['id', 'nombre', 'descripcion', 'precio_final'],
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

      // Actualizar productos si se proporcionan
      if (updateData.productos && Array.isArray(updateData.productos)) {
        // Eliminar productos existentes
        await ProductoPedido.destroy({
          where: { fkid_pedido: id }
        });

        // Crear nuevos productos
        let subtotal = 0;
        for (const producto of updateData.productos) {
          const { fkid_producto, cantidad, precio_unidad, descuento_producto = 0, notas_producto } = producto;
          
          const productoInventario = await Inventario.findByPk(fkid_producto);
          if (!productoInventario) {
            continue; // Saltar productos inválidos
          }

          const precioTotal = parseFloat(precio_unidad) * parseInt(cantidad);
          const descuento = (precioTotal * parseFloat(descuento_producto)) / 100;
          const precioFinal = precioTotal - descuento;

          await ProductoPedido.create({
            fkid_pedido: id,
            fkid_producto,
            cantidad,
            precio_unidad,
            precio_total: precioFinal,
            descuento_producto,
            notas_producto
          });

          subtotal += precioFinal;
        }

        // Actualizar subtotal del pedido
        await pedido.actualizarSubtotal(subtotal);
      }

      // Actualizar paquetes si se proporcionan (incluso si es un array vacío)
      if (updateData.paquetes !== undefined && Array.isArray(updateData.paquetes)) {
        // Eliminar paquetes existentes
        await PaquetePedido.destroy({
          where: { fkid_pedido: id }
        });

        // Crear nuevos paquetes solo si el array no está vacío
        let subtotalPaquetes = 0;
        if (updateData.paquetes.length > 0) {
          for (const paquete of updateData.paquetes) {
            const { fkid_paquete, cantidad, precio_unidad, descuento_paquete = 0, notas_paquete } = paquete;
            
            const paqueteData = await Paquete.findByPk(fkid_paquete);
            if (!paqueteData || !paqueteData.is_active) {
              continue; // Saltar paquetes inválidos o inactivos
            }

            const precioPaquete = precio_unidad || parseFloat(paqueteData.precio_final);
            const precioTotal = precioPaquete * parseInt(cantidad);
            const descuento = (precioTotal * parseFloat(descuento_paquete)) / 100;
            const precioFinal = precioTotal - descuento;

            await PaquetePedido.create({
              fkid_pedido: id,
              fkid_paquete,
              cantidad,
              precio_unidad: precioPaquete,
              precio_total: precioFinal,
              descuento_paquete,
              notas_paquete
            });

            subtotalPaquetes += precioFinal;
          }
        }

        // Actualizar subtotal: si hay productos, sumar ambos; si no, solo paquetes
        if (updateData.productos && Array.isArray(updateData.productos) && updateData.productos.length > 0) {
          // Los productos ya fueron procesados arriba, obtener su subtotal
          const productosTotal = await ProductoPedido.findAll({
            attributes: [
              [ProductoPedido.sequelize.fn('SUM', ProductoPedido.sequelize.col('precio_total')), 'total']
            ],
            where: { 
              fkid_pedido: id,
              baja_logica: false
            }
          });
          const productosSum = parseFloat(productosTotal[0]?.dataValues?.total || 0);
          await pedido.actualizarSubtotal(productosSum + subtotalPaquetes);
        } else {
          // Solo paquetes o sin productos
          await pedido.actualizarSubtotal(subtotalPaquetes);
        }
      }

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
          },
          {
            model: PaquetePedido,
            as: 'paquetes',
            attributes: ['id', 'cantidad', 'precio_unidad', 'precio_total'],
            include: [
              {
                model: Paquete,
                as: 'paquete',
                attributes: ['id', 'nombre', 'descripcion', 'precio_final'],
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

      // Guardar estado anterior antes de cancelar
      const estadoAnterior = pedido.estado;

      // Restaurar stock si el pedido estaba en pendiente o confirmado
      // (ya que el stock se resta al crear el pedido)
      if (estadoAnterior === 'pendiente' || estadoAnterior === 'confirmado') {
        // Obtener todos los productos del pedido
        const productosPedido = await ProductoPedido.findAll({
          where: {
            fkid_pedido: id,
            baja_logica: false
          },
          include: [
            {
              model: Inventario,
              as: 'producto',
              required: false
            }
          ]
        });

        // Obtener todos los paquetes del pedido
        const paquetesPedido = await PaquetePedido.findAll({
          where: {
            fkid_pedido: id
          },
          include: [
            {
              model: Paquete,
              as: 'paquete',
              required: false
            }
          ]
        });

        // Calcular cantidad de productos por paquete
        const productosPorPaquete = {};
        for (const paquetePedido of paquetesPedido) {
          if (!paquetePedido.fkid_paquete) continue;
          
          const productosPaquete = await ProductoPaquete.findAll({
            where: {
              fkid_paquete: paquetePedido.fkid_paquete
            }
          });

          for (const productoPaquete of productosPaquete) {
            const cantidadTotal = paquetePedido.cantidad * productoPaquete.cantidad;
            if (!productosPorPaquete[productoPaquete.fkid_producto]) {
              productosPorPaquete[productoPaquete.fkid_producto] = 0;
            }
            productosPorPaquete[productoPaquete.fkid_producto] += cantidadTotal;
          }
        }

        // Restaurar stock de productos directos
        for (const productoPedido of productosPedido) {
          if (!productoPedido.fkid_producto) continue; // Omitir productos regalo sin ID

          const producto = productoPedido.producto;
          if (!producto) continue;

          const cantidadARestaurar = productoPedido.cantidad;
          if (cantidadARestaurar > 0) {
            try {
              await producto.restaurarStock(cantidadARestaurar);
            } catch (error) {
              // Log error pero continuar restaurando otros productos
              console.error(`Error al restaurar stock del producto ${producto.id}:`, error.message);
            }
          }
        }

        // Restaurar stock de productos en paquetes
        for (const [productoId, cantidadTotal] of Object.entries(productosPorPaquete)) {
          const producto = await Inventario.findByPk(productoId);
          if (producto && cantidadTotal > 0) {
            try {
              await producto.restaurarStock(cantidadTotal);
            } catch (error) {
              // Log error pero continuar restaurando otros productos
              console.error(`Error al restaurar stock del producto ${producto.id} desde paquetes:`, error.message);
            }
          }
        }
      }

      // Cancelar el pedido
      await pedido.cancelar();

      // Recargar el pedido para obtener el estado actualizado
      const pedidoActualizado = await Pedido.findByPk(id);

      res.json({
        success: true,
        message: 'Pedido cancelado exitosamente',
        data: { pedido: pedidoActualizado }
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

  // Obtener disponibilidad de entregas por día
  async getDisponibilidadEntregas(req, res, next) {
    try {
      const { fecha_inicio } = req.params;
      const { ciudad_id } = req.query;
      
      // Validar fecha
      const fechaInicio = new Date(fecha_inicio);
      if (isNaN(fechaInicio.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Fecha de inicio inválida'
        });
      }

      // Convertir nombre de ciudad a ID si es necesario
      let ciudadIdFinal = null;
      if (ciudad_id) {
        ciudadIdFinal = await mapCityNameToId(ciudad_id);
        if (!ciudadIdFinal) {
          // Obtener lista de ciudades disponibles para el mensaje de error
          const todasLasCiudades = await City.findAll({
            where: { baja_logica: false },
            attributes: ['nombre']
          });
          const ciudadesDisponibles = todasLasCiudades.map(c => c.nombre).join(', ');
          
          return res.status(400).json({
            success: false,
            message: `La ciudad especificada "${ciudad_id}" no existe. Ciudades disponibles: ${ciudadesDisponibles}`
          });
        }
        
        // Validar que la ciudad existe y está activa (puede ser que el ID sea válido pero la ciudad no exista o esté eliminada)
        const ciudadExiste = await City.findByPk(ciudadIdFinal);
        
        if (!ciudadExiste || ciudadExiste.baja_logica) {
          // Obtener lista de ciudades disponibles para el mensaje de error
          const todasLasCiudades = await City.findAll({
            where: { baja_logica: false },
            attributes: ['id', 'nombre']
          });
          const ciudadesDisponibles = todasLasCiudades.map(c => `${c.nombre} (ID: ${c.id})`).join(', ');
          
          return res.status(400).json({
            success: false,
            message: `La ciudad especificada "${ciudad_id}" no existe o está inactiva. Ciudades disponibles: ${ciudadesDisponibles}`
          });
        }
      }

      // Calcular fecha de inicio (día siguiente)
      const fechaInicioDisponibilidad = new Date(fechaInicio);
      fechaInicioDisponibilidad.setDate(fechaInicioDisponibilidad.getDate() + 1);
      
      // Generar los próximos 7 días
      const disponibilidad = [];
      const maxPedidosPorHorario = 5; // Máximo 5 pedidos por horario
      
      for (let i = 0; i < 7; i++) {
        const fecha = new Date(fechaInicioDisponibilidad);
        fecha.setDate(fecha.getDate() + i);
        
        // Formatear fecha como YYYY-MM-DD
        const fechaStr = fecha.toISOString().split('T')[0];
        
        // Crear rangos de horario
        const inicioManana = new Date(fecha);
        inicioManana.setHours(8, 0, 0, 0); // 8:00 AM
        
        const finManana = new Date(fecha);
        finManana.setHours(12, 0, 0, 0); // 12:00 PM
        
        const inicioTarde = new Date(fecha);
        inicioTarde.setHours(14, 0, 0, 0); // 2:00 PM
        
        const finTarde = new Date(fecha);
        finTarde.setHours(18, 0, 0, 0); // 6:00 PM
        
        // Construir condiciones de búsqueda
        let whereClause = {
          fecha_entrega_estimada: {
            [Op.between]: [inicioManana, finTarde]
          },
          estado: {
            [Op.in]: ['pendiente', 'confirmado', 'en_preparacion', 'en_camino']
          },
          baja_logica: false
        };
        
        // Filtrar por ciudad si se especifica (usar el ID convertido)
        if (ciudadIdFinal) {
          whereClause.fkid_ciudad = ciudadIdFinal;
        }
        
        // Contar pedidos por horario
        const pedidosManana = await Pedido.count({
          where: {
            ...whereClause,
            fecha_entrega_estimada: {
              [Op.between]: [inicioManana, finManana]
            }
          }
        });
        
        const pedidosTarde = await Pedido.count({
          where: {
            ...whereClause,
            fecha_entrega_estimada: {
              [Op.between]: [inicioTarde, finTarde]
            }
          }
        });
        
        disponibilidad.push({
          fecha: fechaStr,
          manana_disponible: pedidosManana < maxPedidosPorHorario,
          tarde_disponible: pedidosTarde < maxPedidosPorHorario,
          pedidos_manana: pedidosManana,
          pedidos_tarde: pedidosTarde,
          capacidad_manana: maxPedidosPorHorario,
          capacidad_tarde: maxPedidosPorHorario
        });
      }

      // Obtener información de la ciudad si se especificó
      let ciudadInfo = null;
      if (ciudadIdFinal) {
        const ciudad = await City.findByPk(ciudadIdFinal, {
          attributes: ['id', 'nombre']
        });
        if (ciudad) {
          ciudadInfo = {
            id: ciudad.id,
            nombre: ciudad.nombre,
            input_original: ciudad_id // Mantener el valor original (puede ser nombre o ID)
          };
        }
      }

      res.json({
        success: true,
        data: {
          disponibilidad,
          fecha_consulta: fecha_inicio,
          ciudad: ciudadInfo || null,
          total_dias: disponibilidad.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PedidoController();
