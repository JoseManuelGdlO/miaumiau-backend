const { Conversacion, ConversacionChat, ConversacionLog, Cliente } = require('../../models');
const { sendWhatsAppMessage } = require('../../utils/whatsapp');
const { Sequelize } = require('sequelize');
const { Op } = Sequelize;

/**
 * Busca un mensaje por whatsapp_message_id usando consulta SQL directa
 * Esto es más eficiente que traer todos los mensajes y filtrar en memoria
 * @param {string} whatsappMessageId - El ID del mensaje de WhatsApp
 * @param {Date} [sinceDate] - Fecha opcional para limitar la búsqueda (últimos N días)
 * @returns {Promise<ConversacionChat|null>} - El mensaje encontrado o null
 */
async function findChatByWhatsAppMessageId(whatsappMessageId, sinceDate = null) {
  // Usar JSON_UNQUOTE con JSON_EXTRACT para obtener el valor sin comillas
  // O usar la sintaxis moderna metadata->>'$.whatsapp_message_id' (MySQL 5.7+)
  // La sintaxis ->' devuelve con comillas, ->' devuelve sin comillas (texto plano)
  const whereClause = {
    baja_logica: false,
    [Op.and]: [
      Sequelize.where(
        Sequelize.fn('JSON_UNQUOTE', 
          Sequelize.fn('JSON_EXTRACT', Sequelize.col('metadata'), '$.whatsapp_message_id')
        ),
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

// Función para normalizar números de teléfono (solo números)
const normalizePhone = (value) => {
  if (!value) return null;
  const normalized = String(value).replace(/\D/g, '');
  return normalized || null;
};

// Función para formatear número para WhatsApp (con código de país)
// Sistema mexicano: código de país 52
const formatPhoneForWhatsApp = (phone) => {
  if (!phone) return null;
  
  // Normalizar: solo números
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  
  // Si el número ya tiene código de país (México: 52), asegurar formato correcto
  // Si empieza con 52, ya tiene código de país
  if (normalized.startsWith('52')) {
    // Verificar que tenga al menos 12 dígitos (52 + 10 dígitos mexicanos)
    if (normalized.length >= 12) {
      return normalized;
    }
  }
  
  // Si empieza con 1 (código de país de México para móviles), ya está completo
  // Los números mexicanos móviles tienen 10 dígitos y empiezan con 1
  if (normalized.length === 10 && normalized.startsWith('1')) {
    return '52' + normalized;
  }
  
  // Si empieza con 0, remover el 0 y agregar código de país
  if (normalized.startsWith('0')) {
    const withoutZero = normalized.substring(1);
    // Si después de quitar el 0 tiene 10 dígitos y empieza con 1, agregar 52
    if (withoutZero.length === 10 && withoutZero.startsWith('1')) {
      return '52' + withoutZero;
    }
    return '52' + withoutZero;
  }
  
  // Si tiene 10 dígitos (formato local mexicano), agregar código de país
  if (normalized.length === 10) {
    return '52' + normalized;
  }
  
  // Si tiene menos de 10 dígitos, asumir que es número local y agregar código de país
  if (normalized.length < 10) {
    // Remover cualquier 0 inicial y agregar código de país
    const withoutLeadingZero = normalized.replace(/^0+/, '');
    return '52' + withoutLeadingZero;
  }
  
  // Si ya tiene más de 11 dígitos, asumir que ya tiene código de país
  return normalized;
};

const extractPhoneFromConversation = (conversacion) => {
  let rawPhone = null;
  
  // Prioridad 1: SIEMPRE usar el campo 'from' de la conversación
  // Esto es crítico porque los clientes nuevos usan un cliente dummy (id=1)
  // y el teléfono real está en el campo 'from' de la conversación
  if (typeof conversacion?.from === 'string' && conversacion.from.trim()) {
    rawPhone = conversacion.from;
  }
  // Prioridad 2: solo usar teléfono del cliente como fallback si no hay 'from'
  else if (conversacion?.cliente?.telefono) {
    rawPhone = conversacion.cliente.telefono;
  }
  
  if (!rawPhone) {
    return null;
  }
  
  // Formatear el número para WhatsApp
  const formattedPhone = formatPhoneForWhatsApp(rawPhone);
  
  // Verificar si el número podría estar en formato incorrecto
  const normalized = normalizePhone(rawPhone);
  const isMexicanFormat = normalized && normalized.startsWith('52') && normalized.length >= 12;
  const isValidMexicanLength = normalized && normalized.length >= 12 && normalized.length <= 13;
  
  // Log para debugging
  console.log('[WhatsApp] Extracción de teléfono:', {
    conversacionId: conversacion?.id,
    rawPhone,
    formattedPhone,
    clienteTelefono: conversacion?.cliente?.telefono,
    from: conversacion?.from,
    fuente: typeof conversacion?.from === 'string' ? 'from' : 'cliente',
    formatoDetectado: isMexicanFormat ? 'mexicano (52)' : 'formato local',
    longitudNormalizada: normalized?.length,
    longitudFormateada: formattedPhone?.length,
    advertencia: !isValidMexicanLength ? 'Longitud de número puede ser incorrecta' : null
  });
  
  return formattedPhone;
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

      const sendResult = await sendWhatsAppMessage(telefono, mensaje, phoneNumberId);
      
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
      
      // Verificar si hay errores en la respuesta aunque el status sea 200
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
          telefono: telefono // Incluir el teléfono en la respuesta para debugging
        });
      }
      
      // Advertencia si wa_id no coincide con input (puede indicar formato incorrecto)
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
