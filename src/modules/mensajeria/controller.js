const { Conversacion, ConversacionChat, ConversacionLog, Cliente, WhatsAppPhoneNumber } = require('../../models');
const { sendWhatsAppMessage } = require('../../utils/whatsapp');

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

const normalizePhone = (value) => {
  if (!value) return null;
  const normalized = String(value).replace(/\D/g, '');
  return normalized || null;
};

const resolvePhoneNumberId = async (rawPhone) => {
  const normalized = normalizePhone(rawPhone);
  if (!normalized) return null;
  const mapping = await WhatsAppPhoneNumber.findOne({
    where: { telefono: normalized }
  });
  return mapping?.phoneid || null;
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

      // Intentar obtener el phone_number_id de la conversación
      let phoneNumberId = conversacion.whatsapp_phone_number_id;
      
      // Si no existe, intentar resolverlo desde el teléfono
      if (!phoneNumberId) {
        phoneNumberId = await resolvePhoneNumberId(telefono);
        
        // Si se encontró, actualizar la conversación
        if (phoneNumberId) {
          await conversacion.update({ whatsapp_phone_number_id: phoneNumberId });
        } else {
          // Si no se encontró, devolver error
          return res.status(400).json({
            success: false,
            message: 'No se encontró el phone_number_id para la conversación. Verifique que existe un mapeo en la tabla whatsapp_phone_numbers para el teléfono: ' + telefono
          });
        }
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

      const chat = await ConversacionChat.create({
        fkid_conversacion: conversacion.id,
        fecha,
        hora,
        from: 'agente',
        mensaje,
        tipo_mensaje: 'texto',
        metadata: {
          canal: 'whatsapp',
          status: sendResult.status
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
}

module.exports = new MensajeriaController();
