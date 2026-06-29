const moment = require('moment-timezone');
const { Conversacion } = require('../models');
const { sendWhatsAppMessage } = require('../utils/whatsapp');
const { createConversationChatMessage } = require('./conversacionChatService');
const {
  extractPhoneFromConversation,
  isWhatsAppWindowOpen,
} = require('./whatsappWindowService');
const { getTimezoneForConversationId } = require('../utils/conversationTimezone');

/**
 * Envía un mensaje de texto del bot por WhatsApp y lo persiste en el chat.
 *
 * @param {number} conversacionId
 * @param {string} mensaje
 * @param {{ fuente?: string }} [options]
 * @returns {Promise<{ sent: boolean, chat?: object, error?: string }>}
 */
async function sendBotTextMessage(conversacionId, mensaje, options = {}) {
  const { fuente = 'bot' } = options;

  const conversacion = await Conversacion.findByPk(conversacionId, {
    include: [
      {
        association: 'cliente',
        attributes: ['id', 'telefono'],
        required: false,
      },
    ],
  });

  if (!conversacion) {
    return { sent: false, error: 'Conversación no encontrada' };
  }

  const telefono = extractPhoneFromConversation(conversacion);
  const phoneNumberId = conversacion.whatsapp_phone_number_id;

  if (!telefono || !phoneNumberId) {
    return { sent: false, error: 'Teléfono o phone_number_id no disponible' };
  }

  const windowOpen = await isWhatsAppWindowOpen(conversacionId);
  let sendResult = null;
  let operatorWhatsappTextSent = false;
  let whatsappPendingDelivery = false;

  if (windowOpen) {
    sendResult = await sendWhatsAppMessage(telefono, mensaje, phoneNumberId);
    operatorWhatsappTextSent = Boolean(sendResult?.success);

    if (sendResult?.errors?.length > 0 || !sendResult?.success) {
      const errorMessages = sendResult?.errors
        ? sendResult.errors.map((e) => `${e.code}: ${e.title} - ${e.message}`).join('; ')
        : (sendResult?.error || 'Error desconocido al enviar WhatsApp');

      console.warn('[botWhatsApp] fallo envío', {
        conversacionId,
        telefono,
        error: errorMessages,
      });

      return { sent: false, error: errorMessages };
    }
  } else {
    whatsappPendingDelivery = true;
    console.warn('[botWhatsApp] ventana cerrada, mensaje guardado pendiente', {
      conversacionId,
      telefono,
    });
  }

  const timezone = await getTimezoneForConversationId(conversacionId);
  const nowInTz = moment().tz(timezone);
  const nowAsDate = nowInTz.toDate();

  const metadata = {
    canal: 'whatsapp',
    fuente,
    operator_whatsapp_text_sent: operatorWhatsappTextSent,
    whatsapp_pending_delivery: whatsappPendingDelivery,
    whatsapp_delivered: operatorWhatsappTextSent,
  };

  if (sendResult?.messageId) {
    metadata.whatsapp_message_id = sendResult.messageId;
  }

  if (operatorWhatsappTextSent) {
    metadata.whatsapp_status = 'sent';
    metadata.whatsapp_status_updated_at = nowAsDate.toISOString();
  } else if (whatsappPendingDelivery) {
    metadata.whatsapp_status = 'pending';
    metadata.whatsapp_status_updated_at = nowAsDate.toISOString();
  }

  const chat = await createConversationChatMessage({
    fkid_conversacion: conversacionId,
    from: 'bot',
    mensaje,
    tipo_mensaje: 'texto',
    metadata,
    changed_by: 'sistema',
  });

  return {
    sent: operatorWhatsappTextSent || whatsappPendingDelivery,
    chat,
  };
}

module.exports = {
  sendBotTextMessage,
};
