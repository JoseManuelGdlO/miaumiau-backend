const moment = require('moment-timezone');
const { ConversacionChat, Conversacion } = require('../models');
const { getTimezoneForConversationId } = require('../utils/conversationTimezone');
const { flushPendingAgentMessages } = require('./whatsappWindowService');

async function createConversationChatMessage({
  fkid_conversacion,
  from = 'usuario',
  mensaje,
  tipo_mensaje = 'texto',
  metadata: metadataBody = {},
  changed_by = 'sistema',
}) {
  const conversacion = await Conversacion.findByPk(fkid_conversacion);

  if (conversacion) {
    await conversacion.reactivateIfClosed({
      motivo: 'nuevo_mensaje',
      mensaje_from: from,
      changed_by,
    });
  }

  const timezone = await getTimezoneForConversationId(fkid_conversacion);
  const nowInTz = moment().tz(timezone);
  const fecha = nowInTz.format('YYYY-MM-DD');
  const hora = nowInTz.format('HH:mm:ss');
  const nowAsDate = nowInTz.toDate();

  const metadata = (metadataBody && typeof metadataBody === 'object' && !Array.isArray(metadataBody))
    ? { ...metadataBody }
    : {};

  if (metadata.whatsapp_status_updated_at) {
    const timestamp = metadata.whatsapp_status_updated_at;
    if (typeof timestamp === 'number' || (typeof timestamp === 'string' && /^\d+$/.test(timestamp))) {
      metadata.whatsapp_status_updated_at = new Date(parseInt(timestamp, 10) * 1000).toISOString();
    }
  }

  if (metadata.whatsapp_message_id && !metadata.whatsapp_status) {
    metadata.whatsapp_status = 'pending';
    if (!metadata.whatsapp_status_updated_at) {
      metadata.whatsapp_status_updated_at = nowAsDate.toISOString();
    }
  }

  if (metadata.whatsapp_message_id && !metadata.canal) {
    metadata.canal = 'whatsapp';
  }

  const chat = await ConversacionChat.create({
    fkid_conversacion,
    fecha,
    hora,
    from,
    mensaje,
    tipo_mensaje,
    metadata,
    createdAt: nowAsDate,
    updatedAt: nowAsDate,
  });

  await Conversacion.update(
    { updatedAt: nowAsDate },
    { where: { id: fkid_conversacion } }
  );

  if (from === 'usuario') {
    await flushPendingAgentMessages(fkid_conversacion);
  }

  return ConversacionChat.findByPk(chat.id, {
    include: [
      {
        model: Conversacion,
        as: 'conversacion',
        attributes: ['id', 'from', 'status', 'tipo_usuario'],
        required: false,
      },
    ],
  });
}

module.exports = {
  createConversationChatMessage,
};
