const { ConversacionChat, Conversacion, ConversacionLog } = require('../../models');
const { Op } = require('sequelize');
const { createConversationChatMessage } = require('../../services/conversacionChatService');

const { Logger } = require('../../utils/logger');

const log = new Logger('ConversacionesChat');

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
      log.error('getAllChats falló', { message: error.message });
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
      log.error('getChatById falló', { message: error.message });
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
        metadata: metadataBody
      } = req.body;

      const conversacion = await Conversacion.findByPk(fkid_conversacion);
      if (!conversacion) {
        log.warn('createChat rechazado', { status: 400, reason: "La conversación especificada no existe" });
        return res.status(400).json({
          success: false,
          message: 'La conversación especificada no existe'
        });
      }

      const chatCompleto = await createConversationChatMessage({
        fkid_conversacion,
        from,
        mensaje,
        tipo_mensaje,
        metadata: metadataBody,
        changed_by: req.user?.id || 'sistema',
      });

      log.info('createChat', { id: req.user && req.user.id });
      res.status(201).json({
        success: true,
        message: 'Mensaje enviado exitosamente',
        data: { chat: chatCompleto }
      });
    } catch (error) {
      log.error('createChat falló', { message: error.message });
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
        log.warn('updateChat rechazado', { status: 404, reason: "Mensaje no encontrado" });
        return res.status(404).json({
          success: false,
          message: 'Mensaje no encontrado'
        });
      }

      await chat.update(updateData);

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

      log.info('updateChat', { id: id });
      res.json({
        success: true,
        message: 'Mensaje actualizado exitosamente',
        data: { chat: chatActualizado }
      });
    } catch (error) {
      log.error('updateChat falló', { message: error.message });
      next(error);
    }
  }

  // Eliminar mensaje (baja lógica)
  async deleteChat(req, res, next) {
    try {
      const { id } = req.params;

      const chat = await ConversacionChat.findByPk(id);
      
      if (!chat) {
        log.warn('deleteChat rechazado', { status: 404, reason: "Mensaje no encontrado" });
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

      log.info('deleteChat', { id: id });
      res.json({
        success: true,
        message: 'Mensaje eliminado exitosamente'
      });
    } catch (error) {
      log.error('deleteChat falló', { message: error.message });
      next(error);
    }
  }

  // Restaurar mensaje
  async restoreChat(req, res, next) {
    try {
      const { id } = req.params;

      const chat = await ConversacionChat.findByPk(id);
      
      if (!chat) {
        log.warn('restoreChat rechazado', { status: 404, reason: "Mensaje no encontrado" });
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

      log.info('restoreChat', { id: id });
      res.json({
        success: true,
        message: 'Mensaje restaurado exitosamente',
        data: { chat }
      });
    } catch (error) {
      log.error('restoreChat falló', { message: error.message });
      next(error);
    }
  }

  // Marcar mensaje como leído
  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;

      const chat = await ConversacionChat.findByPk(id);
      
      if (!chat) {
        log.warn('markAsRead rechazado', { status: 404, reason: "Mensaje no encontrado" });
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
      log.error('markAsRead falló', { message: error.message });
      next(error);
    }
  }

  // Marcar mensaje como no leído
  async markAsUnread(req, res, next) {
    try {
      const { id } = req.params;

      const chat = await ConversacionChat.findByPk(id);
      
      if (!chat) {
        log.warn('markAsUnread rechazado', { status: 404, reason: "Mensaje no encontrado" });
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
      log.error('markAsUnread falló', { message: error.message });
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
      log.error('getChatsByConversacion falló', { message: error.message });
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
      log.error('getChatsByFrom falló', { message: error.message });
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
      log.error('getUnreadChats falló', { message: error.message });
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
      log.error('getChatsByDate falló', { message: error.message });
      next(error);
    }
  }

  // Buscar mensajes
  async searchChats(req, res, next) {
    try {
      const { search, conversacionId } = req.query;

      if (!search) {
        log.warn('searchChats rechazado', { status: 400, reason: "Se requiere el parámetro de búsqueda" });
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
      log.error('searchChats falló', { message: error.message });
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
      log.error('getChatStats falló', { message: error.message });
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
      log.error('getRecentChats falló', { message: error.message });
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
      log.error('getChatsByHour falló', { message: error.message });
      next(error);
    }
  }
}

module.exports = new ConversacionChatController();
