const { Conversacion, ConversacionChat, ConversacionLog, Cliente } = require('../../models');
const {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  sendWhatsAppImage,
  uploadWhatsAppMedia,
  buildPublicImageUrl,
} = require('../../utils/whatsapp');
const {
  extractPhoneFromConversation,
  isWhatsAppWindowOpen,
  WHATSAPP_REOPEN_TEMPLATE_NAME,
} = require('../../services/whatsappWindowService');
const { Sequelize } = require('sequelize');
const { Op } = Sequelize;
const moment = require('moment-timezone');
const { getTimezoneForConversationId } = require('../../utils/conversationTimezone');

/**
 * Busca un mensaje por whatsapp_message_id usando consulta SQL directa
 * Esto es más eficiente que traer todos los mensajes y filtrar en memoria
 * @param {string} whatsappMessageId - El ID del mensaje de WhatsApp
 * @param {Date} [sinceDate] - Fecha opcional para limitar la búsqueda (últimos N días)
 * @returns {Promise<ConversacionChat|null>} - El mensaje encontrado o null
 */
async function findChatByWhatsAppMessageId(whatsappMessageId, sinceDate = null) {
  // Usar Sequelize.literal con la sintaxis moderna de MySQL (->>)
  // metadata->>'$.whatsapp_message_id' devuelve el valor sin comillas (texto plano)
  // Usar Sequelize.where para comparar de forma segura
  const whereClause = {
    baja_logica: false,
    [Op.and]: [
      Sequelize.where(
        Sequelize.literal("metadata->>'$.whatsapp_message_id'"),
        whatsappMessageId
      )
    ]
  };

  // Si se proporciona una fecha, limitar la búsqueda a mensajes más recientes
  if (sinceDate) {
    whereClause.created_at = {
      [Op.gte]: sinceDate
    };
  }

  return await ConversacionChat.findOne({
    where: whereClause,
    order: [['created_at', 'DESC']] // Obtener el más reciente si hay duplicados
  });
}

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

      await conversacion.reactivateIfClosed({
        motivo: 'mensaje_agente',
        changed_by: req.user?.id || 'sistema',
      });

      const telefono = extractPhoneFromConversation(conversacion);
      if (!telefono) {
        console.error('[WhatsApp] Error: No se encontró teléfono válido', {
          conversacionId: conversacion.id,
          clienteTelefono: conversacion?.cliente?.telefono,
          from: conversacion?.from
        });
        return res.status(400).json({
          success: false,
          message: 'No se encontró un teléfono válido para la conversación'
        });
      }

      const phoneNumberId = conversacion.whatsapp_phone_number_id;
      if (!phoneNumberId) {
        console.error('[WhatsApp] Error: No se encontró phone_number_id', {
          conversacionId: conversacion.id,
          telefono
        });
        return res.status(400).json({
          success: false,
          message: 'No se encontró el phone_number_id para la conversación'
        });
      }

      console.log('[WhatsApp] Enviando mensaje:', {
        conversacionId: conversacion.id,
        telefono,
        phoneNumberId,
        mensajeLength: mensaje.length
      });

      const windowOpen = await isWhatsAppWindowOpen(conversacion.id);
      let templateUsed = false;
      let operatorWhatsappTextSent = false;
      let sendResult = null;

      if (windowOpen) {
        sendResult = await sendWhatsAppMessage(telefono, mensaje, phoneNumberId);
        operatorWhatsappTextSent = true;

        console.log('[WhatsApp] Resultado del envío:', {
          conversacionId: conversacion.id,
          telefono,
          success: sendResult.success,
          status: sendResult.status,
          messageId: sendResult.messageId,
          error: sendResult.error,
          errors: sendResult.errors,
          wa_id: sendResult.parsedData?.contacts?.[0]?.wa_id,
          input: sendResult.parsedData?.contacts?.[0]?.input,
          data: sendResult.data
        });

        if (sendResult.errors && Array.isArray(sendResult.errors) && sendResult.errors.length > 0) {
          const errorMessages = sendResult.errors.map(e => `${e.code}: ${e.title} - ${e.message}`).join('; ');
          console.error('[WhatsApp] Errores en respuesta de WhatsApp:', {
            conversacionId: conversacion.id,
            telefono,
            errors: sendResult.errors,
            errorMessages
          });

          return res.status(502).json({
            success: false,
            message: 'WhatsApp reportó errores al enviar el mensaje',
            error: errorMessages,
            errors: sendResult.errors,
            telefono: telefono
          });
        }

        if (!sendResult.success) {
          return res.status(502).json({
            success: false,
            message: 'No se pudo enviar el mensaje por WhatsApp',
            error: sendResult.error || sendResult.data,
            telefono: telefono
          });
        }

        const wa_id = sendResult.parsedData?.contacts?.[0]?.wa_id;
        const input = sendResult.parsedData?.contacts?.[0]?.input;
        if (wa_id && input && wa_id !== input) {
          console.warn('[WhatsApp] ADVERTENCIA: WhatsApp normalizó el número:', {
            conversacionId: conversacion.id,
            telefonoEnviado: telefono,
            input: input,
            wa_id: wa_id,
            mensaje: 'El número fue normalizado por WhatsApp. Verificar que sea el número correcto.'
          });
        }
      } else {
        templateUsed = true;
        console.log('[WhatsApp] Ventana cerrada, enviando plantilla de apertura:', {
          conversacionId: conversacion.id,
          telefono,
          template: WHATSAPP_REOPEN_TEMPLATE_NAME,
        });

        sendResult = await sendWhatsAppTemplate(telefono, phoneNumberId, WHATSAPP_REOPEN_TEMPLATE_NAME);

        if (sendResult.errors && Array.isArray(sendResult.errors) && sendResult.errors.length > 0) {
          const errorMessages = sendResult.errors.map(e => `${e.code}: ${e.title} - ${e.message}`).join('; ');
          return res.status(502).json({
            success: false,
            message: 'No se pudo enviar la plantilla de apertura de ventana de WhatsApp',
            error: errorMessages,
            errors: sendResult.errors,
            telefono,
          });
        }

        if (!sendResult.success) {
          return res.status(502).json({
            success: false,
            message: 'No se pudo enviar la plantilla de apertura de ventana de WhatsApp',
            error: sendResult.error || sendResult.data,
            telefono,
          });
        }
      }

      // Obtener timezone de la ciudad del mensaje (Cliente o Pedido); default America/Monterrey
      const timezone = await getTimezoneForConversationId(conversacion.id);
      const nowInTz = moment().tz(timezone);
      const fecha = nowInTz.format('YYYY-MM-DD');
      const hora = nowInTz.format('HH:mm:ss');
      const nowAsDate = nowInTz.toDate();

      let whatsappStatus = 'pending';
      if (operatorWhatsappTextSent && sendResult?.messageId) {
        whatsappStatus = 'sent';
      } else if (operatorWhatsappTextSent && !sendResult?.success) {
        whatsappStatus = 'failed';
      }

      const chatMetadata = templateUsed
        ? {
            canal: 'whatsapp',
            whatsapp_pending_delivery: true,
            whatsapp_delivered: false,
            operator_whatsapp_text_sent: false,
            template_used_on_send: true,
            reopen_template_name: WHATSAPP_REOPEN_TEMPLATE_NAME,
          }
        : {
            canal: 'whatsapp',
            status: sendResult.status,
            whatsapp_message_id: sendResult.messageId || null,
            whatsapp_status: whatsappStatus,
            whatsapp_status_updated_at: nowAsDate.toISOString(),
            operator_whatsapp_text_sent: true,
          };

      const chat = await ConversacionChat.create({
        fkid_conversacion: conversacion.id,
        fecha,
        hora,
        from: 'agente',
        mensaje,
        tipo_mensaje: 'texto',
        metadata: chatMetadata,
        createdAt: nowAsDate,
        updatedAt: nowAsDate
      });

      // Actualizar la fecha de última actividad de la conversación
      await Conversacion.update(
        { updatedAt: nowAsDate },
        { where: { id: conversacion.id } }
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
        message: templateUsed
          ? 'Plantilla de apertura enviada; mensaje guardado en el historial'
          : 'Mensaje enviado exitosamente',
        data: {
          chat: chatCompleto,
          template_used: templateUsed,
          operator_whatsapp_text_sent: operatorWhatsappTextSent,
          delivered: true,
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async sendWhatsAppImageMessage(req, res, next) {
    try {
      const conversacionId = Number(req.body.conversacionId);
      const caption = typeof req.body.caption === 'string' ? req.body.caption.trim() : '';

      if (!req.file || !req.file.filename) {
        return res.status(400).json({
          success: false,
          message: 'No se recibió ninguna imagen. Envía el archivo en el campo "imagen".',
        });
      }

      if (req.fileValidationError) {
        return res.status(400).json({
          success: false,
          message: req.fileValidationError,
        });
      }

      const conversacion = await Conversacion.findByPk(conversacionId, {
        include: [
          {
            model: Cliente,
            as: 'cliente',
            attributes: ['id', 'telefono'],
            required: false,
          },
        ],
      });

      if (!conversacion) {
        return res.status(404).json({
          success: false,
          message: 'Conversación no encontrada',
        });
      }

      await conversacion.reactivateIfClosed({
        motivo: 'mensaje_agente',
        changed_by: req.user?.id || 'sistema',
      });

      const telefono = extractPhoneFromConversation(conversacion);
      if (!telefono) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró un teléfono válido para la conversación',
        });
      }

      const phoneNumberId = conversacion.whatsapp_phone_number_id;
      if (!phoneNumberId) {
        return res.status(400).json({
          success: false,
          message: 'No se encontró el phone_number_id para la conversación',
        });
      }

      const imageUrl = buildPublicImageUrl(req.file.filename);
      const filePath = req.file.path;

      const uploadResult = await uploadWhatsAppMedia(phoneNumberId, filePath, req.file.mimetype);
      if (!uploadResult.success) {
        return res.status(502).json({
          success: false,
          message: 'No se pudo subir la imagen a WhatsApp',
          error: uploadResult.error || uploadResult.data,
          telefono,
        });
      }

      const sendResult = await sendWhatsAppImage(telefono, phoneNumberId, {
        id: uploadResult.mediaId,
        caption: caption || undefined,
      });

      if (sendResult.errors?.length > 0) {
        const errorMessages = sendResult.errors.map((e) => `${e.code}: ${e.title} - ${e.message}`).join('; ');
        return res.status(502).json({
          success: false,
          message: 'WhatsApp reportó errores al enviar la imagen',
          error: errorMessages,
          errors: sendResult.errors,
          telefono,
        });
      }

      if (!sendResult.success) {
        return res.status(502).json({
          success: false,
          message: 'No se pudo enviar la imagen por WhatsApp',
          error: sendResult.error || sendResult.data,
          telefono,
        });
      }

      const timezone = await getTimezoneForConversationId(conversacion.id);
      const nowInTz = moment().tz(timezone);
      const fecha = nowInTz.format('YYYY-MM-DD');
      const hora = nowInTz.format('HH:mm:ss');
      const nowAsDate = nowInTz.toDate();

      const mensaje = caption || '[imagen]';
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
        tipo_mensaje: 'imagen',
        metadata: {
          canal: 'whatsapp',
          image_url: imageUrl,
          mime_type: req.file.mimetype,
          filename: req.file.filename,
          status: sendResult.status,
          whatsapp_message_id: sendResult.messageId || null,
          whatsapp_status: whatsappStatus,
          whatsapp_status_updated_at: nowAsDate.toISOString(),
        },
        createdAt: nowAsDate,
        updatedAt: nowAsDate,
      });

      await Conversacion.update(
        { updatedAt: nowAsDate },
        { where: { id: conversacion.id } }
      );

      const chatCompleto = await ConversacionChat.findByPk(chat.id, {
        include: [
          {
            model: Conversacion,
            as: 'conversacion',
            attributes: ['id', 'from', 'status', 'tipo_usuario'],
            required: false,
          },
        ],
      });

      res.status(201).json({
        success: true,
        message: 'Imagen enviada exitosamente',
        data: { chat: chatCompleto },
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
          // La verificación del webhook falló: no es un error de autenticación de usuario
          return res.status(400).send('Verificación del webhook fallida');
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

              // Buscar el mensaje por whatsapp_message_id en metadata usando consulta SQL directa
              // Esto es más eficiente y no tiene límite de 1000 registros
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              
              const chat = await findChatByWhatsAppMessageId(messageId, sevenDaysAgo);

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

                if (status === 'failed') {
                  await ConversacionLog.createLog(
                    chat.fkid_conversacion,
                    {
                      mensaje_id: chat.id,
                      whatsapp_message_id: messageId,
                      status_anterior: metadata.whatsapp_status || 'unknown',
                      status_nuevo: status
                    },
                    'mensaje',
                    'error',
                    `Estado de WhatsApp actualizado: ${status}`
                  );
                }
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

      // Buscar el mensaje por whatsapp_message_id en metadata usando consulta SQL directa
      // Esto es más eficiente y no tiene límite de 1000 registros
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const chat = await findChatByWhatsAppMessageId(messageId, sevenDaysAgo);

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

      if (status === 'failed') {
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
          'error',
          `Estado de WhatsApp actualizado desde n8n: ${status}`
        );
      }

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

        // Buscar el mensaje usando consulta SQL directa (más eficiente)
        const chat = await findChatByWhatsAppMessageId(messageId, sevenDaysAgo);

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

        if (status === 'failed') {
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
            'error',
            `Estado de WhatsApp actualizado desde n8n: ${status}`
          );
        }

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
