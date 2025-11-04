const { Notificacion, Sequelize, Conversacion, Pedido, Cliente, Inventario, City, ProductoPedido } = require('../../models');
const { Op } = require('sequelize');

class NotificacionController {
  // Obtener todas las notificaciones
  async getAllNotificaciones(req, res, next) {
    try {
      const { 
        prioridad,
        leida,
        fecha_inicio,
        fecha_fin,
        search,
        page = 1,
        limit = 10
      } = req.query;
      
      let whereClause = {};
      
      // Filtrar por prioridad
      if (prioridad) {
        whereClause.prioridad = prioridad;
      }
      
      // Filtrar por leída
      if (leida !== undefined) {
        whereClause.leida = leida === 'true' || leida === true;
      }
      
      // Filtrar por rango de fechas
      if (fecha_inicio && fecha_fin) {
        whereClause.fecha_creacion = {
          [Op.between]: [fecha_inicio, fecha_fin]
        };
      } else if (fecha_inicio) {
        whereClause.fecha_creacion = {
          [Op.gte]: fecha_inicio
        };
      } else if (fecha_fin) {
        whereClause.fecha_creacion = {
          [Op.lte]: fecha_fin
        };
      }

      // Búsqueda por nombre o descripción
      if (search) {
        whereClause[Op.or] = [
          { nombre: { [Op.like]: `%${search}%` } },
          { descripcion: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { count, rows: notificaciones } = await Notificacion.findAndCountAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.status(200).json({
        success: true,
        data: notificaciones,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificación por ID
  async getNotificacionById(req, res, next) {
    try {
      const { id } = req.params;

      const notificacion = await Notificacion.findByPk(id);

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      res.status(200).json({
        success: true,
        data: notificacion
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nueva notificación
  async createNotificacion(req, res, next) {
    try {
      const { nombre, descripcion, prioridad, datos } = req.body;

      const notificacion = await Notificacion.create({
        nombre,
        descripcion,
        prioridad: prioridad || 'media',
        leida: false,
        datos: datos || null
      });

      res.status(201).json({
        success: true,
        message: 'Notificación creada exitosamente',
        data: notificacion
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar notificación
  async updateNotificacion(req, res, next) {
    try {
      const { id } = req.params;
      const { nombre, descripcion, prioridad, datos, leida } = req.body;

      const notificacion = await Notificacion.findByPk(id);

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      // Actualizar campos permitidos
      if (nombre !== undefined) notificacion.nombre = nombre;
      if (descripcion !== undefined) notificacion.descripcion = descripcion;
      if (prioridad !== undefined) notificacion.prioridad = prioridad;
      if (datos !== undefined) notificacion.datos = datos;
      if (leida !== undefined) notificacion.leida = leida;

      await notificacion.save();

      res.status(200).json({
        success: true,
        message: 'Notificación actualizada exitosamente',
        data: notificacion
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar notificación
  async deleteNotificacion(req, res, next) {
    try {
      const { id } = req.params;

      const notificacion = await Notificacion.findByPk(id);

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      await notificacion.destroy();

      res.status(200).json({
        success: true,
        message: 'Notificación eliminada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Marcar notificación como leída
  async marcarComoLeida(req, res, next) {
    try {
      const { id } = req.params;

      const notificacion = await Notificacion.findByPk(id);

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      await notificacion.marcarComoLeida();

      res.status(200).json({
        success: true,
        message: 'Notificación marcada como leída',
        data: notificacion
      });
    } catch (error) {
      next(error);
    }
  }

  // Marcar notificación como no leída
  async marcarComoNoLeida(req, res, next) {
    try {
      const { id } = req.params;

      const notificacion = await Notificacion.findByPk(id);

      if (!notificacion) {
        return res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
      }

      await notificacion.marcarComoNoLeida();

      res.status(200).json({
        success: true,
        message: 'Notificación marcada como no leída',
        data: notificacion
      });
    } catch (error) {
      next(error);
    }
  }

  // Marcar todas como leídas
  async marcarTodasComoLeidas(req, res, next) {
    try {
      await Notificacion.update(
        { leida: true },
        { where: { leida: false } }
      );

      res.status(200).json({
        success: true,
        message: 'Todas las notificaciones fueron marcadas como leídas'
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones por prioridad
  async getNotificacionesByPrioridad(req, res, next) {
    try {
      const { prioridad } = req.params;

      const notificaciones = await Notificacion.findByPrioridad(prioridad);

      res.status(200).json({
        success: true,
        data: notificaciones
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones leídas
  async getNotificacionesLeidas(req, res, next) {
    try {
      const notificaciones = await Notificacion.findLeidas();

      res.status(200).json({
        success: true,
        data: notificaciones
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones no leídas
  async getNotificacionesNoLeidas(req, res, next) {
    try {
      const notificaciones = await Notificacion.findNoLeidas();

      res.status(200).json({
        success: true,
        data: notificaciones,
        count: notificaciones.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones urgentes
  async getNotificacionesUrgentes(req, res, next) {
    try {
      const notificaciones = await Notificacion.findUrgentes();

      res.status(200).json({
        success: true,
        data: notificaciones,
        count: notificaciones.length
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones por fecha
  async getNotificacionesByFecha(req, res, next) {
    try {
      const { fecha } = req.params;

      const notificaciones = await Notificacion.findByFecha(fecha);

      res.status(200).json({
        success: true,
        data: notificaciones
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener notificaciones recientes
  async getNotificacionesRecientes(req, res, next) {
    try {
      const { limit = 10 } = req.query;

      const notificaciones = await Notificacion.getRecent(parseInt(limit));

      res.status(200).json({
        success: true,
        data: notificaciones
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener estadísticas de notificaciones
  async getStats(req, res, next) {
    try {
      const stats = await Notificacion.getStats();

      // Obtener estadísticas adicionales
      const total = await Notificacion.count();
      const leidas = await Notificacion.count({ where: { leida: true } });
      const noLeidas = await Notificacion.count({ where: { leida: false } });
      
      const porPrioridad = await Notificacion.findAll({
        attributes: [
          'prioridad',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'total']
        ],
        group: ['prioridad'],
        raw: true
      });

      res.status(200).json({
        success: true,
        data: {
          total,
          leidas,
          noLeidas,
          porPrioridad
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener actividad reciente consolidada de múltiples tablas
  async getActividadReciente(req, res, next) {
    try {
      const { limit = 20, tipo } = req.query;
      const fechaLimite = new Date();
      fechaLimite.setHours(fechaLimite.getHours() - 24); // Últimas 24 horas

      const actividades = [];

      // 1. NUEVAS CONVERSACIONES
      if (!tipo || tipo === 'conversacion') {
        const conversaciones = await Conversacion.findAll({
          where: {
            created_at: {
              [Op.gte]: fechaLimite
            },
            baja_logica: false
          },
          include: [
            {
              model: Cliente,
              as: 'cliente',
              attributes: ['id', 'nombre_completo'],
              required: false,
              include: [
                {
                  model: City,
                  as: 'ciudad',
                  attributes: ['id', 'nombre'],
                  required: false
                }
              ]
            }
          ],
          order: [['created_at', 'DESC']],
          limit: 10
        });

        conversaciones.forEach(conv => {
          const ciudadNombre = conv.cliente?.ciudad?.nombre || 'Ciudad desconocida';
          const descripcion = conv.cliente 
            ? `Cliente en ${ciudadNombre} - Consulta sobre productos Miau Miau`
            : `Nueva conversación desde ${conv.from}`;
          
          actividades.push({
            tipo: 'conversacion',
            id: `conv_${conv.id}`,
            titulo: 'Nueva conversación',
            descripcion: descripcion,
            fecha: conv.created_at,
            status: conv.status,
            statusLabel: conv.status === 'activa' ? 'activa' : conv.status,
            datos: {
              conversacionId: conv.id,
              clienteId: conv.id_cliente,
              clienteNombre: conv.cliente?.nombre_completo,
              ciudad: ciudadNombre
            }
          });
        });
      }

      // 2. VENTAS COMPLETADAS (Pedidos entregados)
      if (!tipo || tipo === 'venta') {
        const pedidosCompletados = await Pedido.findAll({
          where: {
            estado: 'entregado',
            fecha_entrega_real: {
              [Op.gte]: fechaLimite
            },
            baja_logica: false
          },
          include: [
            {
              model: Cliente,
              as: 'cliente',
              attributes: ['id', 'nombre_completo'],
              required: false
            },
            {
              model: ProductoPedido,
              as: 'productos',
              attributes: ['id', 'cantidad', 'precio_total'],
              required: false,
              limit: 1,
              include: [
                {
                  model: Inventario,
                  as: 'producto',
                  attributes: ['id', 'nombre', 'sku'],
                  required: false
                }
              ]
            }
          ],
          order: [['fecha_entrega_real', 'DESC']],
          limit: 10
        });

        pedidosCompletados.forEach(pedido => {
          // Obtener información del primer producto
          const primerProducto = pedido.productos?.[0];
          const nombreProducto = primerProducto?.producto?.nombre || 'Productos Miau Miau';
          const descripcion = `Pedido #${pedido.numero_pedido} - ${nombreProducto}`;

          actividades.push({
            tipo: 'venta',
            id: `pedido_${pedido.id}`,
            titulo: 'Venta completada',
            descripcion: descripcion,
            fecha: pedido.fecha_entrega_real || pedido.created_at,
            status: 'completada',
            statusLabel: 'completada',
            datos: {
              pedidoId: pedido.id,
              numeroPedido: pedido.numero_pedido,
              clienteId: pedido.fkid_cliente,
              clienteNombre: pedido.cliente?.nombre_completo,
              total: pedido.total
            }
          });
        });
      }

      // 3. INVENTARIO BAJO
      if (!tipo || tipo === 'inventario') {
        const inventariosBajos = await Inventario.findAll({
          where: {
            stock_inicial: {
              [Op.lte]: Sequelize.col('stock_minimo')
            },
            baja_logica: false
          },
          include: [
            {
              model: City,
              as: 'ciudad',
              attributes: ['id', 'nombre'],
              required: false
            }
          ],
          order: [['stock_inicial', 'ASC']],
          limit: 10
        });

        inventariosBajos.forEach(inv => {
          const ciudadNombre = inv.ciudad?.nombre || 'Ciudad desconocida';
          actividades.push({
            tipo: 'inventario',
            id: `inv_${inv.id}`,
            titulo: 'Inventario bajo',
            descripcion: `${inv.nombre} en ${ciudadNombre} - Solo ${inv.stock_inicial} unidades`,
            fecha: inv.updated_at || inv.created_at,
            status: 'alerta',
            statusLabel: 'alerta',
            datos: {
              inventarioId: inv.id,
              productoNombre: inv.nombre,
              stockActual: inv.stock_inicial,
              stockMinimo: inv.stock_minimo,
              ciudadId: inv.fkid_ciudad,
              ciudad: ciudadNombre
            }
          });
        });
      }

      // 4. CLIENTES NUEVOS
      if (!tipo || tipo === 'cliente') {
        const clientesNuevos = await Cliente.findAll({
          where: {
            created_at: {
              [Op.gte]: fechaLimite
            },
            isActive: true
          },
          include: [
            {
              model: City,
              as: 'ciudad',
              attributes: ['id', 'nombre'],
              required: false
            }
          ],
          order: [['created_at', 'DESC']],
          limit: 10
        });

        clientesNuevos.forEach(cliente => {
          const ciudadNombre = cliente.ciudad?.nombre || 'Ciudad desconocida';
          const canal = cliente.canal_contacto || 'sistema';
          const descripcion = cliente.canal_contacto === 'whatsapp'
            ? `Registro completado vía WhatsApp - Interesado en productos Miau Miau`
            : `Nuevo cliente registrado en ${ciudadNombre}`;

          actividades.push({
            tipo: 'cliente',
            id: `cliente_${cliente.id}`,
            titulo: 'Cliente nuevo',
            descripcion: descripcion,
            fecha: cliente.created_at,
            status: 'nuevo',
            statusLabel: 'nuevo',
            datos: {
              clienteId: cliente.id,
              clienteNombre: cliente.nombre_completo,
              ciudadId: cliente.fkid_ciudad,
              ciudad: ciudadNombre,
              canalContacto: canal
            }
          });
        });
      }

      // Ordenar todas las actividades por fecha descendente
      actividades.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      // Limitar resultados
      const actividadesLimitadas = actividades.slice(0, parseInt(limit));

      // Calcular tiempo relativo (hace X minutos/horas)
      const actividadesConTiempo = actividadesLimitadas.map(act => {
        const ahora = new Date();
        const fechaAct = new Date(act.fecha);
        const diffMs = ahora - fechaAct;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let tiempoRelativo = '';
        if (diffMins < 1) {
          tiempoRelativo = 'Hace un momento';
        } else if (diffMins < 60) {
          tiempoRelativo = `Hace ${diffMins} min`;
        } else if (diffHours < 24) {
          tiempoRelativo = `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
        } else {
          tiempoRelativo = `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
        }

        return {
          ...act,
          tiempoRelativo,
          fechaFormateada: fechaAct.toISOString()
        };
      });

      res.status(200).json({
        success: true,
        data: actividadesConTiempo,
        total: actividades.length,
        filtros: {
          limiteHoras: 24,
          tipo: tipo || 'todos'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificacionController();

