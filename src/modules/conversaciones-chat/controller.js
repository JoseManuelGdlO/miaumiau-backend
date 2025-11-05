const { ConversacionChat, Conversacion, ConversacionLog } = require('../../models');
const { Op } = require('sequelize');

class ConversacionChatController {
  // Obtener todos los mensajes de chat
  async getAllChats(req, res, next) {
    try {
      const { 
        fkid_conversacion,
        from,
        tipo_mensaje,
        leido,
        activos = 'true',
        search,
        start_date,
        end_date,
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
      
      // Filtrar por conversación
      if (fkid_conversacion) {
        whereClause.fkid_conversacion = fkid_conversacion;
      }
      
      // Filtrar por from
      if (from) {
        whereClause.from = from;
      }
      
      // Filtrar por tipo de mensaje
      if (tipo_mensaje) {
        whereClause.tipo_mensaje = tipo_mensaje;
      }

      // Filtrar por leído
      if (leido !== undefined) {
        whereClause.leido = leido === 'true';
      }

      // Filtrar por rango de fechas
      if (start_date && end_date) {
        whereClause.fecha = {
          [Op.between]: [start_date, end_date]
        };
      }

      // Búsqueda en mensajes
      if (search) {
        whereClause.mensaje = {
          [Op.iLike]: `%${search}%`
        };
      }

      const offset = (page - 1) * limit;

      const { count, rows: chats } = await ConversacionChat.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Conversacion,
            as: 'conversacion',
            attributes: ['id', 'from', 'status', 'tipo_usuario'],
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
          chats,
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

  // Obtener un mensaje por ID
  async getChatById(req, res, next) {
    try {
      const { id } = req.params;
      
      const chat = await ConversacionChat.findByPk(id, {
        include: [
          {
            model: Conversacion,
            as: 'conversacion',
            attributes: ['id', 'from', 'status', 'tipo_usuario'],
            required: false
          }
        ]
      });
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }

      res.json({
        success: true,
        data: { chat }
      });
    } catch (error) {
      next(error);
    }
  }

  // Crear nuevo mensaje
  async createChat(req, res, next) {
    try {
      const {
        fkid_conversacion,
        from = 'usuario',
        mensaje,
        tipo_mensaje = 'texto',
        metadata = null
      } = req.body;

      // Verificar que la conversación existe
      const conversacion = await Conversacion.findByPk(fkid_conversacion);
      if (!conversacion) {
        return res.status(400).json({
          success: false,
          message: 'La conversación especificada no existe'
        });
      }

      // Establecer fecha y hora actuales
      const now = new Date();
      const fecha = now.toISOString().split('T')[0];
      const hora = now.toTimeString().split(' ')[0];

      const chat = await ConversacionChat.create({
        fkid_conversacion,
        fecha,
        hora,
        from,
        mensaje,
        tipo_mensaje,
        metadata
      });

      // Crear log del mensaje
      await ConversacionLog.createLog(
        fkid_conversacion,
        { 
          mensaje_id: chat.id,
          from: from,
          tipo_mensaje: tipo_mensaje,
          mensaje_length: mensaje.length
        },
        'mensaje',
        'info',
        `Nuevo mensaje de ${from}: ${mensaje.substring(0, 50)}...`
      );

      // Obtener el mensaje creado con sus relaciones
      const chatCompleto = await ConversacionChat.findByPk(chat.id, {
        include: [
          {
            model: Conversacion,
            as: 'conversacion',
            attributes: ['id', 'from', 'status', 'tipo_usuario'],
            required: false
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'Mensaje enviado exitosamente',
        data: { chat: chatCompleto }
      });
    } catch (error) {
      next(error);
    }
  }

  // Actualizar mensaje
  async updateChat(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const chat = await ConversacionChat.findByPk(id);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }

      // Guardar el mensaje anterior para el log
      const mensajeAnterior = chat.mensaje;

      await chat.update(updateData);

      // Crear log si cambió el mensaje
      if (updateData.mensaje && updateData.mensaje !== mensajeAnterior) {
        await ConversacionLog.createLog(
          chat.fkid_conversacion,
          { 
            mensaje_id: chat.id,
            mensaje_anterior: mensajeAnterior,
            mensaje_nuevo: updateData.mensaje,
            updated_by: req.user?.id || 'sistema'
          },
          'mensaje',
          'info',
          'Mensaje actualizado'
        );
      }

      // Obtener el mensaje actualizado con sus relaciones
      const chatActualizado = await ConversacionChat.findByPk(id, {
        include: [
          {
            model: Conversacion,
            as: 'conversacion',
            attributes: ['id', 'from', 'status', 'tipo_usuario'],
            required: false
          }
        ]
      });

      res.json({
        success: true,
        message: 'Mensaje actualizado exitosamente',
        data: { chat: chatActualizado }
      });
    } catch (error) {
      next(error);
    }
  }

  // Eliminar mensaje (baja lógica)
  async deleteChat(req, res, next) {
    try {
      const { id } = req.params;

      const chat = await ConversacionChat.findByPk(id);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }

      await chat.softDelete();

      // Crear log de eliminación
      await ConversacionLog.createLog(
        chat.fkid_conversacion,
        { 
          mensaje_id: chat.id,
          mensaje_eliminado: chat.mensaje,
          deleted_by: req.user?.id || 'sistema',
          deleted_at: new Date()
        },
        'sistema',
        'info',
        'Mensaje eliminado (baja lógica)'
      );

      res.json({
        success: true,
        message: 'Mensaje eliminado exitosamente'
      });
    } catch (error) {
      next(error);
    }
  }

  // Restaurar mensaje
  async restoreChat(req, res, next) {
    try {
      const { id } = req.params;

      const chat = await ConversacionChat.findByPk(id);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }

      await chat.restore();

      // Crear log de restauración
      await ConversacionLog.createLog(
        chat.fkid_conversacion,
        { 
          mensaje_id: chat.id,
          restored_by: req.user?.id || 'sistema',
          restored_at: new Date()
        },
        'sistema',
        'info',
        'Mensaje restaurado'
      );

      res.json({
        success: true,
        message: 'Mensaje restaurado exitosamente',
        data: { chat }
      });
    } catch (error) {
      next(error);
    }
  }

  // Marcar mensaje como leído
  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;

      const chat = await ConversacionChat.findByPk(id);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }

      await chat.markAsRead();

      res.json({
        success: true,
        message: 'Mensaje marcado como leído',
        data: { chat }
      });
    } catch (error) {
      next(error);
    }
  }

  // Marcar mensaje como no leído
  async markAsUnread(req, res, next) {
    try {
      const { id } = req.params;

      const chat = await ConversacionChat.findByPk(id);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }

      await chat.markAsUnread();

      res.json({
        success: true,
        message: 'Mensaje marcado como no leído',
        data: { chat }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener mensajes por conversación
  async getChatsByConversacion(req, res, next) {
    try {
      const { conversacionId } = req.params;

      const chats = await ConversacionChat.findByConversation(conversacionId);

      res.json({
        success: true,
        data: {
          chats,
          total: chats.length,
          conversacionId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener mensajes por from
  async getChatsByFrom(req, res, next) {
    try {
      const { from } = req.params;

      const chats = await ConversacionChat.findByFrom(from);

      res.json({
        success: true,
        data: {
          chats,
          total: chats.length,
          from
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener mensajes no leídos
  async getUnreadChats(req, res, next) {
    try {
      const { conversacionId } = req.query;

      const chats = await ConversacionChat.findUnread(conversacionId);

      res.json({
        success: true,
        data: {
          chats,
          total: chats.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener mensajes por fecha
  async getChatsByDate(req, res, next) {
    try {
      const { fecha } = req.params;

      const chats = await ConversacionChat.findByDate(fecha);

      res.json({
        success: true,
        data: {
          chats,
          total: chats.length,
          fecha
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Buscar mensajes
  async searchChats(req, res, next) {
    try {
      const { search, conversacionId } = req.query;

      if (!search) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el parámetro de búsqueda'
        });
      }

      const chats = await ConversacionChat.searchMessages(search, conversacionId);

      res.json({
        success: true,
        data: {
          chats,
          total: chats.length,
          searchTerm: search
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Estadísticas de chat
  async getChatStats(req, res, next) {
    try {
      const { conversacionId } = req.query;

      const totalMensajes = await ConversacionChat.count({
        where: { 
          baja_logica: false,
          ...(conversacionId && { fkid_conversacion: conversacionId })
        }
      });

      const mensajesUsuario = await ConversacionChat.count({
        where: { 
          from: 'usuario',
          baja_logica: false,
          ...(conversacionId && { fkid_conversacion: conversacionId })
        }
      });

      const mensajesBot = await ConversacionChat.count({
        where: { 
          from: 'bot',
          baja_logica: false,
          ...(conversacionId && { fkid_conversacion: conversacionId })
        }
      });

      const mensajesAgente = await ConversacionChat.count({
        where: { 
          from: 'agente',
          baja_logica: false,
          ...(conversacionId && { fkid_conversacion: conversacionId })
        }
      });

      const mensajesNoLeidos = await ConversacionChat.count({
        where: { 
          leido: false,
          baja_logica: false,
          ...(conversacionId && { fkid_conversacion: conversacionId })
        }
      });

      const mensajesPorTipo = await ConversacionChat.getMessagesByType(conversacionId);

      res.json({
        success: true,
        data: {
          totalMensajes,
          mensajesUsuario,
          mensajesBot,
          mensajesAgente,
          mensajesNoLeidos,
          mensajesPorTipo
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener mensajes recientes
  async getRecentChats(req, res, next) {
    try {
      const { limit = 10, conversacionId } = req.query;

      const chats = await ConversacionChat.getRecentMessages(parseInt(limit), conversacionId);

      res.json({
        success: true,
        data: {
          chats,
          total: chats.length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Obtener mensajes por hora
  async getChatsByHour(req, res, next) {
    try {
      const { fecha } = req.params;

      const chats = await ConversacionChat.getMessagesByHour(fecha);

      res.json({
        success: true,
        data: {
          chats,
          fecha
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ConversacionChatController();
