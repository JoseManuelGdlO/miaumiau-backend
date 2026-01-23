const { Conversacion, ConversacionChat, ConversacionLog, Cliente } = require('../../models');
const { sendWhatsAppMessage } = require('../../utils/whatsapp');
const { Sequelize } = require('sequelize');

const extractPhoneFromConversation = (conversacion) => {
  if (conversacion?.cliente?.telefono) {
    return conversacion.cliente.telefono;
  }

  if (typeof conversacion?.from === 'string') {
    const match = conversacion.from.match(/\+?\d+/);
    if (match) {
      return match[0];
    }
  }

  return null;
};

class MensajeriaController {
  async sendWhatsAppMessage(req, res, next) {
    try {
      const { conversacionId, mensaje } = req.body;

      const conversacion = await Conversacion.findByPk(conversacionId, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'telefono'],
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

      const telefono = extractPhoneFromConversation(conversacion);
      if (!telefono) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró un teléfono válido para la conversación'
        });
      }

      const phoneNumberId = conversacion.whatsapp_phone_number_id;
      if (!phoneNumberId) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró el phone_number_id para la conversación'
        });
      }

      const sendResult = await sendWhatsAppMessage(telefono, mensaje, phoneNumberId);
      if (!sendResult.success) {
        return res.status(502).json({
          success: false,
          message: 'No se pudo enviar el mensaje por WhatsApp',
          error: sendResult.error || sendResult.data
        });
      }

      const now = new Date();
      const fecha = now.toISOString().split('T')[0];
      const hora = now.toTimeString().split(' ')[0];

      // Determinar el estado inicial del mensaje
      // Si tenemos message_id, el mensaje fue aceptado por WhatsApp (sent)
      // Si no, puede estar en pending o failed
      let whatsappStatus = 'pending';
      if (sendResult.messageId) {
        whatsappStatus = 'sent';
      } else if (!sendResult.success) {
        whatsappStatus = 'failed';
      }

      const chat = await ConversacionChat.create({
        fkid_conversacion: conversacion.id,
        fecha,
        hora,
        from: 'agente',
        mensaje,
        tipo_mensaje: 'texto',
        metadata: {
          canal: 'whatsapp',
          status: sendResult.status,
          whatsapp_message_id: sendResult.messageId || null,
          whatsapp_status: whatsappStatus,
          whatsapp_status_updated_at: now.toISOString()
        }
      });

      await ConversacionLog.createLog(
        conversacion.id,
        {
          mensaje_id: chat.id,
          from: 'agente',
          tipo_mensaje: 'texto',
          telefono
        },
        'mensaje',
        'info',
        `Mensaje enviado por agente: ${mensaje.substring(0, 50)}...`
      );

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

  async handleWhatsAppWebhook(req, res, next) {
    try {
      // Verificación del webhook (GET request de Meta/Facebook)
      if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

        if (mode === 'subscribe' && token === verifyToken) {
          console.log('Webhook verificado');
          return res.status(200).send(challenge);
        } else {
          return res.status(403).send('Forbidden');
        }
      }

      // Procesar actualizaciones de estado (POST request)
      const body = req.body;
      
      // Estructura esperada del webhook de WhatsApp:
      // {
      //   "entry": [{
      //     "changes": [{
      //       "value": {
      //         "statuses": [{
      //           "id": "wamid.xxx",
      //           "status": "sent|delivered|read|failed",
      //           "timestamp": "1234567890"
      //         }]
      //       }
      //     }]
      //   }]
      // }

      if (!body?.entry || !Array.isArray(body.entry)) {
        return res.status(200).json({ success: true, message: 'No entries to process' });
      }

      let updatedCount = 0;

      for (const entry of body.entry) {
        if (!entry?.changes || !Array.isArray(entry.changes)) {
          continue;
        }

        for (const change of entry.changes) {
          const value = change?.value;
          
          // Procesar actualizaciones de estado
          if (value?.statuses && Array.isArray(value.statuses)) {
            for (const statusUpdate of value.statuses) {
              const messageId = statusUpdate?.id;
              const status = statusUpdate?.status; // sent, delivered, read, failed
              const timestamp = statusUpdate?.timestamp;

              if (!messageId || !status) {
                continue;
              }

              // Buscar el mensaje por whatsapp_message_id en metadata
              // Buscar en mensajes recientes (últimos 7 días) para mejorar rendimiento
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              
              const chats = await ConversacionChat.findAll({
                where: {
                  baja_logica: false,
                  created_at: {
                    [Sequelize.Op.gte]: sevenDaysAgo
                  }
                },
                limit: 1000 // Limitar a los 1000 más recientes
              });

              // Buscar el mensaje con el message_id correspondiente
              const chat = chats.find(c => {
                const metadata = c.metadata || {};
                return metadata.whatsapp_message_id === messageId;
              });

              if (chat) {
                const metadata = chat.metadata || {};
                // Actualizar el estado del mensaje
                const updatedMetadata = {
                  ...metadata,
                  whatsapp_status: status,
                  whatsapp_status_updated_at: timestamp 
                    ? new Date(parseInt(timestamp) * 1000).toISOString()
                    : new Date().toISOString()
                };

                await chat.update({ metadata: updatedMetadata });

                updatedCount++;

                // Log de la actualización
                await ConversacionLog.createLog(
                  chat.fkid_conversacion,
                  {
                    mensaje_id: chat.id,
                    whatsapp_message_id: messageId,
                    status_anterior: metadata.whatsapp_status || 'unknown',
                    status_nuevo: status
                  },
                  'mensaje',
                  status === 'failed' ? 'error' : 'info',
                  `Estado de WhatsApp actualizado: ${status}`
                );
              }
            }
          }

          // También procesar mensajes entrantes si es necesario (opcional)
          // if (value?.messages && Array.isArray(value.messages)) {
          //   // Procesar mensajes entrantes aquí si es necesario
          // }
        }
      }

      res.status(200).json({
        success: true,
        message: `Webhook procesado. ${updatedCount} mensaje(s) actualizado(s).`
      });
    } catch (error) {
      console.error('Error procesando webhook de WhatsApp:', error);
      // Responder 200 para que WhatsApp no reintente
      res.status(200).json({
        success: false,
        message: 'Error procesando webhook',
        error: error.message
      });
    }
  }

  /**
   * Endpoint para que n8n (u otros servicios externos) actualicen el estado de mensajes
   * Este endpoint recibe actualizaciones de estado de forma directa desde n8n
   */
  async updateMessageStatus(req, res, next) {
    try {
      const { messageId, status, timestamp } = req.body;

      if (!messageId || !status) {
        return res.status(400).json({
          success: false,
          message: 'messageId y status son requeridos'
        });
      }

      // Validar que el status sea uno de los valores permitidos
      const validStatuses = ['sent', 'delivered', 'read', 'failed', 'pending'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status inválido. Debe ser uno de: ${validStatuses.join(', ')}`
        });
      }

      // Buscar el mensaje por whatsapp_message_id en metadata
      // Buscar en mensajes recientes (últimos 7 días) para mejorar rendimiento
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const chats = await ConversacionChat.findAll({
        where: {
          baja_logica: false,
          created_at: {
            [Sequelize.Op.gte]: sevenDaysAgo
          }
        },
        limit: 1000 // Limitar a los 1000 más recientes
      });

      // Buscar el mensaje con el message_id correspondiente
      const chat = chats.find(c => {
        const metadata = c.metadata || {};
        return metadata.whatsapp_message_id === messageId;
      });

      if (!chat) {
        return res.status(404).json({
          success: false,
          message: `Mensaje con whatsapp_message_id "${messageId}" no encontrado. El mensaje puede ser muy antiguo (más de 7 días) o no existe en la base de datos.`
        });
      }

      const metadata = chat.metadata || {};
      const previousStatus = metadata.whatsapp_status || 'unknown';

      // Actualizar el estado del mensaje
      const updatedMetadata = {
        ...metadata,
        whatsapp_status: status,
        whatsapp_status_updated_at: timestamp 
          ? new Date(parseInt(timestamp) * 1000).toISOString()
          : new Date().toISOString()
      };

      await chat.update({ metadata: updatedMetadata });

      // Obtener información de la conversación para la respuesta
      const conversacion = await Conversacion.findByPk(chat.fkid_conversacion, {
        attributes: ['id', 'from', 'status']
      });

      // Log de la actualización
      await ConversacionLog.createLog(
        chat.fkid_conversacion,
        {
          mensaje_id: chat.id,
          whatsapp_message_id: messageId,
          status_anterior: previousStatus,
          status_nuevo: status,
          fuente: 'n8n'
        },
        'mensaje',
        status === 'failed' ? 'error' : 'info',
        `Estado de WhatsApp actualizado desde n8n: ${status}`
      );

      res.status(200).json({
        success: true,
        message: 'Estado actualizado exitosamente',
        data: {
          chatId: chat.id,
          conversacionId: chat.fkid_conversacion,
          conversacion: conversacion ? {
            id: conversacion.id,
            from: conversacion.from,
            status: conversacion.status
          } : null,
          previousStatus,
          newStatus: status,
          whatsappMessageId: messageId
        }
      });
    } catch (error) {
      console.error('Error actualizando estado de mensaje:', error);
      next(error);
    }
  }

  /**
   * Endpoint para actualizar múltiples estados a la vez (útil para n8n)
   */
  async updateMultipleMessageStatuses(req, res, next) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'updates debe ser un array no vacío'
        });
      }

      const results = [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Obtener todos los mensajes recientes una sola vez
      const chats = await ConversacionChat.findAll({
        where: {
          baja_logica: false,
          created_at: {
            [Sequelize.Op.gte]: sevenDaysAgo
          }
        },
        limit: 1000
      });

      for (const update of updates) {
        const { messageId, status, timestamp } = update;

        if (!messageId || !status) {
          results.push({
            messageId: messageId || 'unknown',
            success: false,
            error: 'messageId y status son requeridos'
          });
          continue;
        }

        const validStatuses = ['sent', 'delivered', 'read', 'failed', 'pending'];
        if (!validStatuses.includes(status)) {
          results.push({
            messageId,
            success: false,
            error: `Status inválido: ${status}`
          });
          continue;
        }

        // Buscar el mensaje
        const chat = chats.find(c => {
          const metadata = c.metadata || {};
          return metadata.whatsapp_message_id === messageId;
        });

        if (!chat) {
          results.push({
            messageId,
            success: false,
            error: 'Mensaje no encontrado'
          });
          continue;
        }

        const metadata = chat.metadata || {};
        const previousStatus = metadata.whatsapp_status || 'unknown';

        // Actualizar el estado
        const updatedMetadata = {
          ...metadata,
          whatsapp_status: status,
          whatsapp_status_updated_at: timestamp 
            ? new Date(parseInt(timestamp) * 1000).toISOString()
            : new Date().toISOString()
        };

        await chat.update({ metadata: updatedMetadata });

        // Log de la actualización
        await ConversacionLog.createLog(
          chat.fkid_conversacion,
          {
            mensaje_id: chat.id,
            whatsapp_message_id: messageId,
            status_anterior: previousStatus,
            status_nuevo: status,
            fuente: 'n8n'
          },
          'mensaje',
          status === 'failed' ? 'error' : 'info',
          `Estado de WhatsApp actualizado desde n8n: ${status}`
        );

        // Obtener información de la conversación
        const conversacion = await Conversacion.findByPk(chat.fkid_conversacion, {
          attributes: ['id', 'from', 'status']
        });

        results.push({
          messageId,
          success: true,
          chatId: chat.id,
          conversacionId: chat.fkid_conversacion,
          conversacion: conversacion ? {
            id: conversacion.id,
            from: conversacion.from,
            status: conversacion.status
          } : null,
          previousStatus,
          newStatus: status
        });
      }

      res.status(200).json({
        success: true,
        message: `Procesados ${results.length} actualizaciones`,
        data: results
      });
    } catch (error) {
      console.error('Error actualizando estados de mensajes:', error);
      next(error);
    }
  }
}

module.exports = new MensajeriaController();
