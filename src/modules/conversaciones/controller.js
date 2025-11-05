const { Conversacion, Cliente, ConversacionChat, ConversacionLog, Pedido, ProductoPedido, Inventario } = require('../../models');
const { Op } = require('sequelize');

class ConversacionController {
  // Obtener todas las conversaciones
  async getAllConversaciones(req, res, next) {
    try {
      const { 
        status,
        tipo_usuario,
        id_cliente,
        from,
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
      
      // Filtrar por status
      if (status) {
        whereClause.status = status;
      }
      
      // Filtrar por tipo de usuario
      if (tipo_usuario) {
        whereClause.tipo_usuario = tipo_usuario;
      }
      
      // Filtrar por cliente
      if (id_cliente) {
        whereClause.id_cliente = id_cliente;
      }

      // Filtrar por rango de fechas
      if (start_date && end_date) {
        whereClause.created_at = {
          [Op.between]: [new Date(start_date), new Date(end_date)]
        };
      }

      // Búsqueda por from
      if (search) {
        whereClause.from = {
          [Op.iLike]: `%${search}%`
        };
      }

      const offset = (page - 1) * limit;

      const { count, rows: conversaciones } = await Conversacion.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email', 'telefono'],
            required: false
          },
          {
            model: Pedido,
            as: 'pedido',
            attributes: ['id', 'numero_pedido', 'estado', 'total', 'fecha_pedido'],
            required: false
          },
          {
            model: ConversacionChat,
            as: 'chats',
            attributes: ['id', 'fecha', 'hora', 'from', 'mensaje', 'tipo_mensaje', 'leido', 'created_at'],
            limit: 1,
            separate: true,
            order: [['created_at', 'DESC']]
          },
          {
            model: ConversacionLog,
            as: 'logs',
            attributes: ['id', 'fecha', 'hora', 'tipo_log', 'nivel', 'descripcion', 'created_at'],
            limit: 1,
            separate: true,
            order: [['created_at', 'DESC']]
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: {
          conversaciones,
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

  // Obtener una conversación por ID
  async getConversacionById(req, res, next) {
    try {
      const { id } = req.params;
      
      const conversacion = await Conversacion.findByPk(id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email', 'telefono'],
            required: false
          },
          {
            model: Pedido,
            as: 'pedido',
            required: false,
            include: [
              {
                model: ProductoPedido,
                as: 'productos',
                required: false,
                include: [
                  {
                    model: Inventario,
                    as: 'producto',
                    required: false
                  }
                ]
              }
            ]
          },
          {
            model: ConversacionChat,
            as: 'chats',
            attributes: ['id', 'fecha', 'hora', 'from', 'mensaje', 'tipo_mensaje', 'leido', 'created_at'],
            order: [['created_at', 'ASC']],
            required: false
          },
          {
            model: ConversacionLog,
            as: 'logs',
            attributes: ['id', 'fecha', 'hora', 'tipo_log', 'nivel', 'descripcion', 'created_at'],
            order: [['created_at', 'ASC']],
            required: false
          }
        ]
      });
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      res.json({
        success: true,
        data: { conversacion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nueva conversación
  async createConversacion(req, res, next) {
    try {
      const {
        from,
        status = 'activa',
        id_cliente,
        tipo_usuario = 'cliente'
      } = req.body;

      // Verificar que el cliente existe si se proporciona
      if (id_cliente) {
        const cliente = await Cliente.findByPk(id_cliente);
        if (!cliente) {
          return res.status(400).json({
            success: false,
            message: 'El cliente especificado no existe'
          });
        }
      }

      const conversacion = await Conversacion.create({
        from,
        status,
        id_cliente,
        tipo_usuario
      });

      // Crear log de inicio de conversación
      await ConversacionLog.createLog(
        conversacion.id,
        { 
          from: from,
          tipo_usuario: tipo_usuario,
          status_inicial: status
        },
        'inicio',
        'info',
        `Conversación iniciada por ${from}`
      );

      // Obtener la conversación creada con sus relaciones
      const conversacionCompleta = await Conversacion.findByPk(conversacion.id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email', 'telefono'],
            required: false
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Conversación creada exitosamente',
        data: { conversacion: conversacionCompleta }
      });
    } catch (error) {
      next(error);
    }
  }

  // Buscar o crear conversación (findOrCreate)
  async findOrCreateConversacion(req, res, next) {
    try {
      const {
        from,
        status = 'activa',
        id_cliente,
        tipo_usuario = 'cliente'
      } = req.body;

      // Validar que from esté presente
      if (!from) {
        return res.status(400).json({
          success: false,
          message: 'El campo "from" es requerido'
        });
      }

      // Verificar que el cliente existe si se proporciona
      if (id_cliente) {
        const cliente = await Cliente.findByPk(id_cliente);
        if (!cliente) {
          return res.status(400).json({
            success: false,
            message: 'El cliente especificado no existe'
          });
        }
      }

      // Buscar conversación existente por 'from' que esté activa o no eliminada
      let conversacion = await Conversacion.findOne({
        where: {
          from: from,
          baja_logica: false
        },
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email', 'telefono'],
            required: false
          }
        ],
        order: [['created_at', 'DESC']] // Obtener la más reciente
      });

      let fueCreada = false;

      // Si no existe, crear una nueva
      if (!conversacion) {
        conversacion = await Conversacion.create({
          from,
          status,
          id_cliente,
          tipo_usuario
        });

        // Crear log de inicio de conversación
        await ConversacionLog.createLog(
          conversacion.id,
          { 
            from: from,
            tipo_usuario: tipo_usuario,
            status_inicial: status
          },
          'inicio',
          'info',
          `Conversación iniciada por ${from}`
        );

        // Obtener la conversación creada con sus relaciones
        conversacion = await Conversacion.findByPk(conversacion.id, {
          include: [
            {
              model: Cliente,
              as: 'cliente',
              attributes: ['id', 'nombre_completo', 'email', 'telefono'],
              required: false
            }
          ]
        });

        fueCreada = true;
      }

      res.status(fueCreada ? 201 : 200).json({
        success: true,
        message: fueCreada 
          ? 'Conversación creada exitosamente' 
          : 'Conversación encontrada',
        data: { 
          conversacion: conversacion,
          fueCreada: fueCreada
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar conversación
  async updateConversacion(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const conversacion = await Conversacion.findByPk(id);
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      // Verificar que el cliente existe si se está actualizando
      if (updateData.id_cliente) {
        const cliente = await Cliente.findByPk(updateData.id_cliente);
        if (!cliente) {
          return res.status(400).json({
            success: false,
            message: 'El cliente especificado no existe'
          });
        }
      }

      // Guardar el status anterior para el log
      const statusAnterior = conversacion.status;

      await conversacion.update(updateData);

      // Crear log si cambió el status
      if (updateData.status && updateData.status !== statusAnterior) {
        await ConversacionLog.createLog(
          conversacion.id,
          { 
            status_anterior: statusAnterior,
            status_nuevo: updateData.status,
            updated_by: req.user?.id || 'sistema'
          },
          'sistema',
          'info',
          `Status cambiado de ${statusAnterior} a ${updateData.status}`
        );
      }

      // Obtener la conversación actualizada con sus relaciones
      const conversacionActualizada = await Conversacion.findByPk(id, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'nombre_completo', 'email', 'telefono'],
            required: false
          }
        ]
      });

      res.json({
        success: true,
        message: 'Conversación actualizada exitosamente',
        data: { conversacion: conversacionActualizada }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar conversación (baja lógica)
  async deleteConversacion(req, res, next) {
    try {
      const { id } = req.params;

      const conversacion = await Conversacion.findByPk(id);
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      await conversacion.softDelete();

      // Crear log de eliminación
      await ConversacionLog.createLog(
        conversacion.id,
        { 
          deleted_by: req.user?.id || 'sistema',
          deleted_at: new Date()
        },
        'sistema',
        'info',
        'Conversación eliminada (baja lógica)'
      );

      res.json({
        success: true,
        message: 'Conversación eliminada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar conversación
  async restoreConversacion(req, res, next) {
    try {
      const { id } = req.params;

      const conversacion = await Conversacion.findByPk(id);
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      await conversacion.restore();

      // Crear log de restauración
      await ConversacionLog.createLog(
        conversacion.id,
        { 
          restored_by: req.user?.id || 'sistema',
          restored_at: new Date()
        },
        'sistema',
        'info',
        'Conversación restaurada'
      );

      res.json({
        success: true,
        message: 'Conversación restaurada exitosamente',
        data: { conversacion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Cambiar status de conversación
  async changeStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const conversacion = await Conversacion.findByPk(id);
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      const statusAnterior = conversacion.status;
      conversacion.status = status;
      await conversacion.save();

      // Crear log del cambio de status
      await ConversacionLog.createLog(
        conversacion.id,
        { 
          status_anterior: statusAnterior,
          status_nuevo: status,
          changed_by: req.user?.id || 'sistema'
        },
        'sistema',
        'info',
        `Status cambiado de ${statusAnterior} a ${status}`
      );

      res.json({
        success: true,
        message: `Status cambiado a ${status} exitosamente`,
        data: { conversacion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Asignar conversación a cliente
  async assignToClient(req, res, next) {
    try {
      const { id } = req.params;
      const { id_cliente } = req.body;

      const conversacion = await Conversacion.findByPk(id);
      
      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada'
        });
      }

      // Verificar que el cliente existe
      const cliente = await Cliente.findByPk(id_cliente);
      if (!cliente) {
        return res.status(400).json({
          success: false,
          message: 'El cliente especificado no existe'
        });
      }

      const clienteAnterior = conversacion.id_cliente;
      await conversacion.assignToClient(id_cliente);

      // Crear log de asignación
      await ConversacionLog.createLog(
        conversacion.id,
        { 
          cliente_anterior: clienteAnterior,
          cliente_nuevo: id_cliente,
          assigned_by: req.user?.id || 'sistema'
        },
        'transferencia',
        'info',
        `Conversación asignada al cliente ${cliente.nombre_completo}`
      );

      res.json({
        success: true,
        message: 'Conversación asignada exitosamente',
        data: { conversacion }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener conversaciones por status
  async getConversacionesByStatus(req, res, next) {
    try {
      const { status } = req.params;

      const conversaciones = await Conversacion.findByStatus(status);

      res.json({
        success: true,
        data: {
          conversaciones,
          total: conversaciones.length,
          status
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener conversaciones por cliente
  async getConversacionesByClient(req, res, next) {
    try {
      const { clientId } = req.params;

      const conversaciones = await Conversacion.findByClient(clientId);

      res.json({
        success: true,
        data: {
          conversaciones,
          total: conversaciones.length,
          clientId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener conversaciones activas
  async getActiveConversaciones(req, res, next) {
    try {
      const conversaciones = await Conversacion.findActive();

      res.json({
        success: true,
        data: {
          conversaciones,
          total: conversaciones.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Buscar conversaciones
  async searchConversaciones(req, res, next) {
    try {
      const { search } = req.query;

      if (!search) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el parámetro de búsqueda'
        });
      }

      const conversaciones = await Conversacion.findByFrom(search);

      res.json({
        success: true,
        data: {
          conversaciones,
          total: conversaciones.length,
          searchTerm: search
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de conversaciones
  async getConversacionStats(req, res, next) {
    try {
      const totalConversaciones = await Conversacion.count({
        where: { baja_logica: false }
      });

      const conversacionesActivas = await Conversacion.count({
        where: { 
          status: 'activa',
          baja_logica: false
        }
      });

      const conversacionesCerradas = await Conversacion.count({
        where: { 
          status: 'cerrada',
          baja_logica: false
        }
      });

      const conversacionesPausadas = await Conversacion.count({
        where: { 
          status: 'pausada',
          baja_logica: false
        }
      });

      const conversacionesEnEspera = await Conversacion.count({
        where: { 
          status: 'en_espera',
          baja_logica: false
        }
      });

      const conversacionesPorTipo = await Conversacion.getConversationsByUserType();

      res.json({
        success: true,
        data: {
          totalConversaciones,
          conversacionesActivas,
          conversacionesCerradas,
          conversacionesPausadas,
          conversacionesEnEspera,
          conversacionesPorTipo
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ConversacionController();
