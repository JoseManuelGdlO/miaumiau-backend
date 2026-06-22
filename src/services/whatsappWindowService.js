const { Sequelize } = require('sequelize');
const { Op } = Sequelize;
const moment = require('moment-timezone');
const { Conversacion, ConversacionChat, ConversacionLog, Cliente } = require('../models');
const {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  WHATSAPP_REOPEN_TEMPLATE_NAME,
} = require('../utils/whatsapp');
const { getTimezoneForConversationId } = require('../utils/conversationTimezone');

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const normalizePhone = (value) => {
  if (!value) return null;
  const normalized = String(value).replace(/\D/g, '');
  return normalized || null;
};

const formatPhoneForWhatsApp = (phone) => {
  if (!phone) return null;

  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  if (normalized.startsWith('52')) {
    if (normalized.length >= 12) {
      return normalized;
    }
  }

  if (normalized.length === 10 && normalized.startsWith('1')) {
    return `52${normalized}`;
  }

  if (normalized.startsWith('0')) {
    const withoutZero = normalized.substring(1);
    if (withoutZero.length === 10 && withoutZero.startsWith('1')) {
      return `52${withoutZero}`;
    }
    return `52${withoutZero}`;
  }

  if (normalized.length === 10) {
    return `52${normalized}`;
  }

  if (normalized.length < 10) {
    const withoutLeadingZero = normalized.replace(/^0+/, '');
    return `52${withoutLeadingZero}`;
  }

  return normalized;
};

const extractPhoneFromConversation = (conversacion) => {
  let rawPhone = null;

  if (typeof conversacion?.from === 'string' && conversacion.from.trim()) {
    rawPhone = conversacion.from;
  } else if (conversacion?.cliente?.telefono) {
    rawPhone = conversacion.cliente.telefono;
  }

  if (!rawPhone) {
    return null;
  }

  return formatPhoneForWhatsApp(rawPhone);
};

async function findLastInboundClientMessageAt(conversacionId) {
  const lastMessage = await ConversacionChat.findOne({
    where: {
      fkid_conversacion: conversacionId,
      from: 'usuario',
      baja_logica: false,
    },
    order: [['created_at', 'DESC']],
    attributes: ['created_at'],
  });

  return lastMessage?.created_at || null;
}

async function isWhatsAppWindowOpen(conversacionId) {
  const lastClientAt = await findLastInboundClientMessageAt(conversacionId);
  if (!lastClientAt) {
    return false;
  }
  return Date.now() - new Date(lastClientAt).getTime() < TWENTY_FOUR_HOURS_MS;
}

async function findPendingAgentTextMessages(conversacionId) {
  const messages = await ConversacionChat.findAll({
    where: {
      fkid_conversacion: conversacionId,
      from: 'agente',
      tipo_mensaje: 'texto',
      baja_logica: false,
      [Op.and]: [
        Sequelize.where(
          Sequelize.literal("metadata->>'$.whatsapp_pending_delivery'"),
          'true'
        ),
      ],
    },
    order: [['created_at', 'ASC']],
  });

  return messages;
}

async function loadConversationForWhatsApp(conversacionId) {
  return Conversacion.findByPk(conversacionId, {
    include: [
      {
        model: Cliente,
        as: 'cliente',
        attributes: ['id', 'telefono'],
        required: false,
      },
    ],
  });
}

async function flushPendingAgentMessages(conversacionId) {
  try {
    const pendingMessages = await findPendingAgentTextMessages(conversacionId);
    if (pendingMessages.length === 0) {
      return { flushed: 0, failed: 0 };
    }

    const conversacion = await loadConversationForWhatsApp(conversacionId);
    if (!conversacion) {
      console.warn('[WhatsApp] flushPending: conversación no encontrada', { conversacionId });
      return { flushed: 0, failed: pendingMessages.length };
    }

    const telefono = extractPhoneFromConversation(conversacion);
    const phoneNumberId = conversacion.whatsapp_phone_number_id;

    if (!telefono || !phoneNumberId) {
      console.warn('[WhatsApp] flushPending: teléfono o phone_number_id faltante', {
        conversacionId,
        telefono,
        phoneNumberId,
      });
      return { flushed: 0, failed: pendingMessages.length };
    }

    const timezone = await getTimezoneForConversationId(conversacionId);
    const nowInTz = moment().tz(timezone);
    const nowAsDate = nowInTz.toDate();

    let flushed = 0;
    let failed = 0;

    for (const pending of pendingMessages) {
      const sendResult = await sendWhatsAppMessage(telefono, pending.mensaje, phoneNumberId);

      if (sendResult.errors?.length > 0 || !sendResult.success) {
        failed += 1;
        const errorMessages = sendResult.errors
          ? sendResult.errors.map((e) => `${e.code}: ${e.title} - ${e.message}`).join('; ')
          : (sendResult.error || sendResult.data);

        console.error('[WhatsApp] flushPending: fallo al reenviar mensaje', {
          conversacionId,
          mensajeId: pending.id,
          error: errorMessages,
        });

        await ConversacionLog.createLog(
          conversacionId,
          {
            mensaje_id: pending.id,
            telefono,
            error: errorMessages,
          },
          'mensaje',
          'error',
          `No se pudo reenviar mensaje pendiente del agente (id ${pending.id})`
        );
        continue;
      }

      const metadata = pending.metadata || {};
      await pending.update({
        metadata: {
          ...metadata,
          whatsapp_pending_delivery: false,
          whatsapp_delivered: true,
          operator_whatsapp_text_sent: true,
          whatsapp_message_id: sendResult.messageId || null,
          whatsapp_status: sendResult.messageId ? 'sent' : 'pending',
          whatsapp_status_updated_at: nowAsDate.toISOString(),
          whatsapp_flushed_at: nowAsDate.toISOString(),
        },
      });

      await ConversacionLog.createLog(
        conversacionId,
        {
          mensaje_id: pending.id,
          from: 'agente',
          tipo_mensaje: 'texto',
          telefono,
          whatsapp_message_id: sendResult.messageId || null,
        },
        'mensaje',
        'info',
        `Mensaje pendiente del agente reenviado por WhatsApp: ${pending.mensaje.substring(0, 50)}...`
      );

      flushed += 1;
    }

    if (flushed > 0) {
      await Conversacion.update(
        { updatedAt: nowAsDate },
        { where: { id: conversacionId } }
      );
    }

    return { flushed, failed };
  } catch (error) {
    console.error('[WhatsApp] flushPending: error inesperado', {
      conversacionId,
      error: error.message,
    });
    return { flushed: 0, failed: 0, error: error.message };
  }
}

module.exports = {
  TWENTY_FOUR_HOURS_MS,
  normalizePhone,
  formatPhoneForWhatsApp,
  extractPhoneFromConversation,
  findLastInboundClientMessageAt,
  isWhatsAppWindowOpen,
  findPendingAgentTextMessages,
  flushPendingAgentMessages,
  WHATSAPP_REOPEN_TEMPLATE_NAME,
};
